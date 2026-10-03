import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { openPromise } from 'yauzl'
import { readMatchingTextEntries, replaceTextEntry } from '../src/main/zip-package'

async function countEntries(path: string) {
  const archive = await openPromise(path, { lazyEntries: true, validateEntrySizes: true })
  let count = 0
  try {
    for await (const entry of archive.eachEntry()) {
      if (![0, 8].includes(entry.compressionMethod)) {
        throw new Error(`Método ZIP no compatible: ${entry.compressionMethod}`)
      }
      count++
    }
  } finally {
    if (archive.isOpen) archive.close()
  }
  return count
}

async function main() {
  const source = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft\\root\\paks\\client\\default\\default_other.pak'
  await stat(source)
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'roadcraft-studio-full-pak-'))
  if (!basename(temporaryRoot).startsWith('roadcraft-studio-full-pak-')) {
    throw new Error('La carpeta temporal no pasó la validación de seguridad.')
  }
  const copy = join(temporaryRoot, 'default_other.pak')

  try {
    console.log('Copiando el paquete real a una carpeta temporal...')
    await copyFile(source, copy)
    const vehicles = await readMatchingTextEntries(
      copy,
      name => /^ssl\/autogen_designer_wizard\/trucks\/(?:base\/)?([^/]+)\/\1\.cls$/i.test(name)
    )
    const target = vehicles.find(entry => entry.entryName.includes('/trucks/base/') && entry.content.includes('torque'))
    if (!target) throw new Error('No se encontró un vehículo válido para la prueba.')
    const changed = target.content.replace(/(\btorque\s*=\s*)([-+]?\d*\.?\d+)/, (_match, prefix, value) => prefix + Number(value) * 1.01)
    if (changed === target.content) throw new Error('No se pudo preparar la modificación de la copia temporal.')

    const beforeCount = await countEntries(copy)
    console.log(`Reconstruyendo una copia con ${beforeCount} entradas...`)
    await replaceTextEntry(copy, target.entryName, changed)
    const afterCount = await countEntries(copy)
    const verification = await readMatchingTextEntries(copy, name => name === target.entryName)

    if (beforeCount !== afterCount) throw new Error(`El paquete cambió de ${beforeCount} a ${afterCount} entradas.`)
    if (verification[0]?.content !== changed) throw new Error('La modificación de IA no se conservó en la copia temporal.')
    console.log(`Prueba completa correcta: modificación IA verificada; ${vehicles.length} clases y ${afterCount} entradas conservadas.`)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
