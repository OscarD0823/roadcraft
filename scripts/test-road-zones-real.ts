import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve, sep } from 'node:path'
import { openPromise } from 'yauzl'
import { ROAD_ZONE_CLASS, freeRoadZoneClass } from '../src/main/road-zones'
import { readMatchingTextEntries, replaceTextEntries } from '../src/main/zip-package'

async function directory(path: string) {
  const zip = await openPromise(path, { lazyEntries: true, validateEntrySizes: true })
  const entries = new Map<string, string>()
  try {
    for await (const entry of zip.eachEntry()) {
      assert(!entries.has(entry.fileName), 'Duplicate path in real package')
      entries.set(entry.fileName, `${entry.crc32}:${entry.uncompressedSize}`)
    }
  } finally { if (zip.isOpen) zip.close() }
  return entries
}

async function main() {
  const source = 'E:/SteamLibrary/steamapps/common/RoadCraft/root/paks/client/default/default_other.pak'
  const hash = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex')
  const sourceHash = await hash(source)
  const root = resolve('out'); await mkdir(root, { recursive: true })
  const temporary = await mkdtemp(join(root, 'roads-real-copy-'))
  assert(temporary.startsWith(root + sep))
  try {
    const copy = join(temporary, 'default_other.pak'); await copyFile(source, copy)
    const before = await directory(copy)
    const original = (await readMatchingTextEntries(copy, n => n === ROAD_ZONE_CLASS))[0].content
    const changed = freeRoadZoneClass(original)
    await replaceTextEntries(copy, new Map([[ROAD_ZONE_CLASS, changed]]))
    const after = await directory(copy)
    assert.equal(after.size, before.size)
    for (const [path, checksum] of before) if (path !== ROAD_ZONE_CLASS) assert.equal(after.get(path), checksum, 'Unrelated entry changed: ' + path)
    assert.equal((await readMatchingTextEntries(copy, n => n === ROAD_ZONE_CLASS))[0].content, changed)
    await replaceTextEntries(copy, new Map([[ROAD_ZONE_CLASS, original]]))
    assert.deepEqual(await directory(copy), before, 'Class restore changed original entry contents')
    assert.equal(await hash(source), sourceHash, 'The real game package changed during QA')
    console.log(JSON.stringify({ copiedPackageOnly: true, preservedEntries: before.size, restoredOriginalClass: true, liveGameUnchanged: sourceHash, liveGameplayVerified: false }))
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
