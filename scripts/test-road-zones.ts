import assert from 'node:assert/strict'
import { app, dialog } from 'electron'
import { createWriteStream, mkdirSync, mkdtempSync, existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { finished } from 'node:stream/promises'
import { ZipFile } from 'yazl'
import { RoadCraftService } from '../src/main/roadcraft'
import { ROAD_ZONE_CLASS, freeRoadZoneClass } from '../src/main/road-zones'
import { readMatchingBinaryEntries, replaceTextEntries } from '../src/main/zip-package'
import { translate } from '../src/renderer/i18n'

const original = `properties   =   {
   prop_domain   =   {
      pointFilter   =   {
         tagFilters   =   [
            "truck_view"
         ]
         __type   =   "dom_filter_tag"
      }
      trackingMode   =   "EXIT"
   }
   prop_non_terraformable   =   {
   }
}
__type   =   "iactor"
`

async function main() {
  const root = resolve('out'); mkdirSync(root, { recursive: true })
  const temporary = mkdtempSync(join(root, 'road-zones-fixture-'))
  assert(temporary.startsWith(root + sep))
  mkdirSync(join(temporary, 'data'))
  app.setPath('userData', join(temporary, 'data')); app.setPath('sessionData', join(temporary, 'data'))
  await app.whenReady()
  const packagePath = join(temporary, 'root/paks/client/default/default_other.pak')
  const truck = 'ssl/autogen_designer_wizard/trucks/auto_test/auto_test.cls'
  const required = 'properties = { prop_terraforming_permission_checker = {}; prop_load_volume_permission_checker = {}; torque = 100; }'
  const other = Buffer.from([0, 255, 1, 127, 45, 33])
  let confirmations = 0, response = 0, closed = true
  const savedDialog = dialog.showMessageBox
  dialog.showMessageBox = (async () => { confirmations++; return { response, checkboxChecked: false } }) as typeof dialog.showMessageBox
  const readEntries = async () => new Map((await readMatchingBinaryEntries(packagePath, () => true)).map(e => [e.entryName, e.content]))
  try {
    const patched = freeRoadZoneClass(original)
    assert(!patched.includes('prop_non_terraformable'))
    assert(patched.includes('prop_domain')); assert(patched.includes('trackingMode'))
    for (const bad of [original.replace('EXIT', 'ENTER'), original.replace('truck_view', 'quest_object'),
      original.replace('prop_non_terraformable   =   {', 'prop_non_terraformable   =   { custom = True'),
      original.replace('"iactor"', '"truck_view"'), patched, original + 'prop_non_terraformable = {}']) assert.throws(() => freeRoadZoneClass(bad))
    assert.equal(translate('es', 'freeRoads'), 'Carreteras libres')
    await mkdir(join(temporary, 'root/paks/client/default'), { recursive: true })
    const zip = new ZipFile(), output = createWriteStream(packagePath)
    zip.outputStream.pipe(output)
    zip.addBuffer(Buffer.from(original), ROAD_ZONE_CLASS)
    zip.addBuffer(Buffer.from(required), truck)
    zip.addBuffer(other, 'unchanged.binary'); zip.end(); await finished(output)
    await writeFile(packagePath + '.cache', 'cache-before')
    const before = await readFile(packagePath)
    let service = new RoadCraftService() as any
    service.settings.installPath = temporary
    service.assertGameIsClosed = async () => { if (!closed) throw new Error('Game running fixture') }
    assert.equal((await service.getRoadZoneStatus()).status, 'standard')
    assert.equal((await service.setFreeRoads('true')).ok, false)
    service.changingFiles = true; assert.equal((await service.setFreeRoads(true)).ok, false); service.changingFiles = false
    closed = false; assert.equal((await service.setFreeRoads(true)).ok, false); closed = true
    assert.equal(confirmations, 0)
    assert.equal((await service.setFreeRoads(true)).ok, false, 'Cancellation must not write')
    assert.deepEqual(await readFile(packagePath), before); assert(existsSync(packagePath + '.cache'))
    assert.deepEqual(service.settings.roadZoneSnapshots, {})
    response = 1
    const enabled = await service.setFreeRoads(true)
    assert(enabled.ok, enabled.message)
    assert.equal((await service.getRoadZoneStatus()).status, 'enabled')
    assert.deepEqual(await readFile(enabled.backupPath), before)
    assert.equal(await readFile(enabled.backupPath + '.cache', 'utf8'), 'cache-before')
    let entries = await readEntries()
    assert.equal(entries.get(ROAD_ZONE_CLASS)!.toString(), patched)
    assert.equal(entries.get(truck)!.toString(), required, 'Required truck components changed')
    assert.deepEqual(entries.get('unchanged.binary'), other); assert(!existsSync(packagePath + '.cache'))
    const activeBytes = await readFile(packagePath), dialogCount = confirmations
    assert((await service.setFreeRoads(true)).ok)
    assert.equal(confirmations, dialogCount); assert.deepEqual(await readFile(packagePath), activeBytes)
    // Restart reads actual content and the journal; no auto-enable or cached checkbox state.
    const persisted = JSON.parse(await readFile(join(temporary, 'data/settings.json'), 'utf8'))
    service = new RoadCraftService() as any; service.settings = persisted
    service.assertGameIsClosed = async () => { if (!closed) throw new Error('Game running fixture') }
    assert.equal((await service.getRoadZoneStatus()).status, 'enabled')
    // Restore exactly the class, not the entire backup: retain later vehicle edits.
    const editedTruck = required.replace('100', '110')
    await replaceTextEntries(packagePath, new Map([[truck, editedTruck]]))
    assert((await service.setFreeRoads(false)).ok)
    entries = await readEntries()
    assert.equal(entries.get(ROAD_ZONE_CLASS)!.toString(), original)
    assert.equal(entries.get(truck)!.toString(), editedTruck)
    assert.deepEqual(entries.get('unchanged.binary'), other)
    assert.equal((await service.getRoadZoneStatus()).status, 'standard')
    assert((await service.setFreeRoads(true)).ok)
    // Do not silently overwrite a newer map-class mod or game update.
    await replaceTextEntries(packagePath, new Map([[ROAD_ZONE_CLASS, patched + '// external edit']]))
    const external = await readFile(packagePath)
    assert.equal((await service.getRoadZoneStatus()).status, 'conflict')
    assert.equal((await service.setFreeRoads(false)).ok, false)
    assert.equal((await service.setFreeRoads(true)).ok, false)
    assert.deepEqual(await readFile(packagePath), external)
    await replaceTextEntries(packagePath, new Map([[ROAD_ZONE_CLASS, original]]))
    // A failed journal write must prevent the archive change.
    const stable = await readFile(packagePath)
    const persist = service.persistSettings
    service.persistSettings = async () => { throw new Error('Journal failure fixture') }
    assert.equal((await service.setFreeRoads(true)).ok, false)
    assert.deepEqual(await readFile(packagePath), stable)
    service.persistSettings = persist
    service.settings.roadZoneSnapshots[resolve(packagePath)].enabledSource = 'forged'
    assert.equal((await service.getRoadZoneStatus()).status, 'conflict')
    assert.equal((await service.setFreeRoads(false)).ok, false)
    assert.deepEqual(await readFile(packagePath), stable)
    console.log('Free roads: static class only, truck permissions retained, backup/cache, exact restore with vehicle edits retained, restart, confirmation cancel, game-open lock, invalid layouts, external conflicts and journal failure verified. Synthetic package only; no live game writes.')
  } finally {
    dialog.showMessageBox = savedDialog
    await rm(temporary, { recursive: true, force: true })
  }
}
void main().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1) })
