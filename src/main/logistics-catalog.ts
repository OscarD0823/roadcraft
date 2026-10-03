import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { openPromise } from 'yauzl'
import type { LogisticsUse } from '../shared'
import { arrayObjects, objectBody } from './source-blocks'

export type LogisticsCatalog = Map<string, LogisticsUse[]>

/** Only actual delivery/test pools count; base_ and helper AI are not evidence. */
export function collectLogisticsPools(source: string, map: string, catalog: LogisticsCatalog = new Map()) {
  const pattern = /\b(regularPool|testPool)\s*=\s*\[/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) {
    const start = pattern.lastIndex
    let depth = 1, quoted = false, escaped = false, end = start
    for (; end < source.length; end++) {
      const char = source[end]
      if (char === '"' && !escaped) quoted = !quoted
      escaped = char === '\\' && !escaped
      if (quoted) continue
      if (char === '[') depth++
      if (char === ']' && !--depth) break
    }
    if (depth !== 0) break // Never classify an incomplete pool.
    pattern.lastIndex = end + 1
    const role = match[1].toLowerCase() === 'regularpool' ? 'delivery' : 'validation'
    for (const item of arrayObjects(`pool = [${source.slice(start, end)}]`, 'pool')) {
      const desc = objectBody(item, 'desc')
      if (!/\b__type\s*=\s*"PoolTruck[A-Za-z0-9_]*Desc"/.test(desc)) continue
      const name = /\btruckName\s*=\s*"([a-z0-9_]{1,150})"/i.exec(desc)?.[1]?.toLowerCase().replace(/^auto_/, '')
      if (!name) continue
      const cargo = /\bcargoName\s*=\s*"([a-z0-9_]{1,150})"/i.exec(desc)?.[1]
      const uses = catalog.get(name) ?? []
      let use = uses.find(value => value.map === map && value.role === role)
      if (!use) { use = { map, role, cargoNames: [] }; uses.push(use) }
      if (cargo && !use.cargoNames.includes(cargo)) use.cargoNames.push(cargo)
      catalog.set(name, uses)
    }
  }
  return catalog
}

async function files(root: string, extension: string, recursive = false): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const found: string[] = []
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) found.push(path)
    else if (recursive && entry.isDirectory()) found.push(...await files(path, extension, true))
  }
  return found.sort()
}

async function inspectPackage(path: string, catalog: LogisticsCatalog) {
  const archive = await openPromise(path, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true })
  let totalSize = 0
  try {
    for await (const entry of archive.eachEntry()) {
      // Compiled scenes embed their readable property records in these lists.
      if (!/\.(?:cd_list|class_list|scn)$/i.test(entry.fileName)) continue
      totalSize += entry.uncompressedSize
      if (entry.uncompressedSize > 32 * 1024 * 1024 || totalSize > 128 * 1024 * 1024) {
        throw new Error('Logistics scene exceeds size limit')
      }
      const chunks: Buffer[] = []
      for await (const chunk of await archive.openReadStreamPromise(entry)) chunks.push(chunk)
      collectLogisticsPools(Buffer.concat(chunks).toString('utf8'), basename(path, '.pak'), catalog)
    }
  } finally { if (archive.isOpen) archive.close() }
}

export async function readLogisticsCatalog(installPath: string) {
  const vehicles: LogisticsCatalog = new Map()
  let incomplete = false, packages = 0
  const sceneRoot = join(installPath, 'root', 'paks', 'client', 'default', 'scenes')
  const sourceRoot = join(installPath, 'root', 'mods_source', 'xscenes')
  try {
    for (const path of await files(sceneRoot, '.pak', true)) {
      try { await inspectPackage(path, vehicles); packages++ }
      catch { incomplete = true }
    }
    for (const path of await files(sourceRoot, '.scn', true)) {
      try {
        if ((await stat(path)).size > 32 * 1024 * 1024) throw new Error('Logistics scene exceeds size limit')
        collectLogisticsPools(await readFile(path, 'utf8'), basename(path, '.scn'), vehicles)
      } catch { incomplete = true }
    }
  } catch { incomplete = true }
  return { vehicles, incomplete, packages }
}
