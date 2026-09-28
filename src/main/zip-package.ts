import { createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { finished } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { openPromise, type Entry } from 'yauzl'
import { ZipFile, type DirectoryOptions, type ReadStreamOptions } from 'yazl'

export interface TextArchiveEntry {
  entryName: string
  content: string
  modifiedAt: number
}

export async function readMatchingTextEntries(
  archivePath: string,
  matches: (entryName: string) => boolean
): Promise<TextArchiveEntry[]> {
  const archive = await openPromise(archivePath, {
    lazyEntries: true,
    decodeStrings: true,
    validateEntrySizes: true,
    strictFileNames: true
  })
  const result: TextArchiveEntry[] = []

  try {
    for await (const entry of archive.eachEntry()) {
      if (entry.fileName.endsWith('/') || !matches(entry.fileName)) continue
      const stream = await archive.openReadStreamPromise(entry)
      const chunks: Buffer[] = []

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }

      result.push({
        entryName: entry.fileName,
        content: Buffer.concat(chunks).toString('utf8'),
        modifiedAt: entry.getLastModDate().getTime()
      })
    }
  } finally {
    if (archive.isOpen) archive.close()
  }

  return result
}

export async function replaceTextEntry(
  archivePath: string,
  targetEntryName: string,
  replacement: string
) {
  const temporaryPath = join(dirname(archivePath), `.roadcraft-studio-${randomUUID()}.tmp`)
  const rollbackPath = join(dirname(archivePath), `.roadcraft-studio-${randomUUID()}.rollback`)
  const sourceArchive = await openPromise(archivePath, {
    lazyEntries: true,
    decodeStrings: true,
    validateEntrySizes: true,
    strictFileNames: true
  })
  const outputArchive = new ZipFile()
  const destination = createWriteStream(temporaryPath, { flags: 'wx' })
  outputArchive.outputStream.on('error', error => destination.destroy(error))
  outputArchive.outputStream.pipe(destination)
  const destinationFinished = finished(destination)
  let replaced = false

  try {
    for await (const entry of sourceArchive.eachEntry()) {
      if (entry.fileName.endsWith('/')) {
        outputArchive.addEmptyDirectory(entry.fileName, directoryOptions(entry))
        continue
      }

      if (entry.fileName === targetEntryName) {
        outputArchive.addBuffer(Buffer.from(replacement, 'utf8'), entry.fileName, entryOptions(entry))
        replaced = true
        continue
      }

      const stream = await sourceArchive.openReadStreamPromise(entry)
      outputArchive.addReadStream(stream, entry.fileName, {
        ...entryOptions(entry),
        size: entry.uncompressedSize,
        fileComment: entry.fileComment
      })
      await finished(stream)
    }

    outputArchive.end({ comment: sourceArchive.comment || '', forceZip64Format: false })
    await destinationFinished

    if (!replaced) {
      throw new Error(`No se encontró ${targetEntryName} dentro del paquete.`)
    }

    const verification = await readMatchingTextEntries(temporaryPath, name => name === targetEntryName)
    if (verification.length !== 1 || verification[0].content !== replacement) {
      throw new Error('La verificación del paquete reconstruido no coincidió con el contenido guardado.')
    }

    await rename(archivePath, rollbackPath)
    try {
      await rename(temporaryPath, archivePath)
      await rm(rollbackPath, { force: true })
    } catch (error) {
      await rename(rollbackPath, archivePath)
      throw error
    }
  } catch (error) {
    destination.destroy()
    await rm(temporaryPath, { force: true })
    throw error
  } finally {
    if (sourceArchive.isOpen) sourceArchive.close()
  }
}

function entryOptions(entry: Entry): Partial<ReadStreamOptions> {
  const mode = entry.externalFileAttributes >>> 16
  return {
    mtime: entry.getLastModDate(),
    ...(mode ? { mode } : {}),
    compress: entry.compressionMethod !== 0,
    forceDosTimestamp: true,
    forceZip64Format: entry.uncompressedSize > 0xffffffff,
    fileComment: entry.fileComment
  }
}

function directoryOptions(entry: Entry): Partial<DirectoryOptions> {
  const mode = entry.externalFileAttributes >>> 16
  return {
    mtime: entry.getLastModDate(),
    ...(mode ? { mode } : {}),
    forceDosTimestamp: true
  }
}
