import assert from 'node:assert/strict'
import { app } from 'electron'
import { createWriteStream, mkdirSync, mkdtempSync, existsSync } from 'node:fs'
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { finished } from 'node:stream/promises'
import { ZipFile } from 'yazl'
import { RoadCraftService, PAK_TRUCK_PARAMETERS } from '../src/main/roadcraft'
import { readMatchingTextEntries, replaceTextEntries } from '../src/main/zip-package'
import { entryInSection, vehicleFamilyKey } from '../src/shared'
import { translate } from '../src/renderer/i18n'

async function main() {
  assert(translate('es', 'wholeMapSand').startsWith('Suministro'))
  assert(translate('es', 'applyToVariants').startsWith('Aplicar'))
  assert(translate('es', 'protectedDumpZones').startsWith('No se desactivan'))
  const root = resolve('out'); mkdirSync(root, { recursive: true })
  const temporary = mkdtempSync(join(root, 'linked-work-fixture-'))
  assert(temporary.startsWith(root + sep))
  mkdirSync(join(temporary, 'data'))
  app.setPath('userData', join(temporary, 'data')); app.setPath('sessionData', join(temporary, 'data'))
  await app.whenReady()
  const packagePath = join(temporary, 'root/paks/client/default/default_other.pak')
  const cls = (name: string) => `ssl/autogen_designer_wizard/trucks/${name}/${name}.cls`
  const fixture = (torque: number, mass?: number, distance?: number) => `properties = {
   prop_truck_rb = {
      engine = {
         params = {
            torque = ${torque}
         }
      }
   }
${mass ? `   prop_load_volume = {
      volumeMass = ${mass}
   }
   prop_terraforming_permission_checker = {
      untouched = True
   }
   prop_load_volume_permission_checker = {
      fixture = "original component"
   }
   prop_dump_constraint_controller = {
      dumpConstraintName = "dump"
   }
` : ''}${distance ? `   prop_truck_mobile_sand_screen = {
      allowedPercent = 0.4
      materialCheckRadius = 6
      sandDistance = ${distance}
   }
   prop_usable = {
      smartsEntryPoints = {
         SandStorage = {
            checkers = {
               UsableCheckerDistance = {
                  distance = ${distance}
               }
            }
            focusDistance = ${distance}
         }
      }
   }
` : ''}   geom = {
      nameTpl = "unchanged"
   }
}
`
  const old = 'auto_wayfarer_oft96_dump_old', restored = 'auto_wayfarer_oft96_dump_res', crane = 'auto_wayfarer_oft96_crane_new'
  const base = 'auto_base_wayfarer_oft96_dump_old', ai = 'auto_wayfarer_oft96_delivery_ai'
  const trailer = 'auto_wayfarer_oft96_trailer_new', unrelated = 'auto_wayfarer_st7050_new'
  const scalperOld = 'auto_zikz_605e_mobile_scalper_old', scalperRes = 'auto_zikz_605e_mobile_scalper_res'
  const shared = 'auto_shared_st100_cargo_main'
  const originals = new Map([[old, fixture(100, 40000)], [restored, fixture(200, 50000)], [crane, fixture(300)],
    [base, fixture(100, 40000)], [ai, fixture(100, 40000)], [trailer, fixture(100, 40000)],
    [unrelated, fixture(100)], [shared, fixture(150)], [scalperOld, fixture(100, undefined, 120)],
    [scalperRes, fixture(150, undefined, 140).replace('sandDistance = 140', 'sandDistance = 150').replace('focusDistance = 140', 'focusDistance = 160')]])
  try {
    await mkdir(join(temporary, 'root/paks/client/default'), { recursive: true })
    const zip = new ZipFile(), output = createWriteStream(packagePath)
    zip.outputStream.pipe(output)
    for (const [name, source] of originals) zip.addBuffer(Buffer.from(source), cls(name))
    zip.addBuffer(Buffer.from('unrelated bytes'), 'unrelated.txt'); zip.end(); await finished(output)
    const originalPackage = await readFile(packagePath)
    await writeFile(packagePath + '.cache', 'original cache')
    const service = new RoadCraftService() as any
    service.settings.installPath = temporary
    service.assertGameIsClosed = async () => {} // Only this synthetic installation.
    const refresh = async () => {
      service.catalog.clear()
      for (const archived of await readMatchingTextEntries(packagePath, n => n.endsWith('.cls'))) {
        const name = [...originals.keys()].find(name => cls(name) === archived.entryName)!
        const parsed = service.createParameters(archived.content, PAK_TRUCK_PARAMETERS, name)
        service.catalog.set(name, { sourceType: 'pak', sourcePath: packagePath, archiveEntryName: archived.entryName, specs: parsed.specMap,
          entry: { id: name, name, internalName: name, kind: name === trailer ? 'trailer' : name === ai ? 'ai' : name === base ? 'other' : 'truck',
            sourceType: 'pak', filePath: packagePath, modified: Boolean(service.settings.originalValues[name]), parameters: parsed.parameters,
            access: { control: name === shared ? 'shared' : name === ai ? 'ai' : 'player', baseVariant: name === base,
              logistics: name === ai || name === shared ? [{ map: 'test', role: 'delivery', cargoNames: [] }] : undefined } } })
      }
    }
    service.scan = refresh; await refresh()
    assert.equal(vehicleFamilyKey(service.catalog.get(old).entry), vehicleFamilyKey(service.catalog.get(crane).entry))
    assert.equal(vehicleFamilyKey(service.catalog.get(base).entry), undefined)
    const source = async (name: string) => (await readMatchingTextEntries(packagePath, n => n === cls(name)))[0].content
    const value = (name: string, id: string) => service.catalog.get(name).entry.parameters.find((p: any) => p.id === id)?.value
    const sharedWrite = await service.save({ filePath: shared, values: { engineTorque: 165 }, applyToVariants: true })
    assert(sharedWrite.ok, sharedWrite.message); assert.deepEqual(sharedWrite.affectedIds, [shared])
    const sharedEntry = service.catalog.get(shared).entry
    assert(entryInSection(sharedEntry, 'truck')); assert(entryInSection(sharedEntry, 'ai'))
    assert.equal(sharedEntry.modified, true); assert.equal(value(shared, 'engineTorque'), 165)
    const sharedSettings = JSON.parse(await readFile(join(temporary, 'data/settings.json'), 'utf8'))
    service.settings = sharedSettings; await refresh()
    assert.equal(service.catalog.get(shared).entry.modified, true); assert.equal(value(shared, 'engineTorque'), 165)
    assert.equal(service.settings.originalValues[shared].engineTorque, 150)
    assert((await service.restore(shared)).ok); assert.equal(service.catalog.get(shared).entry.modified, false)
    assert.equal(await source(shared), originals.get(shared))
    await writeFile(packagePath + '.cache', 'original cache')
    // ZIP container metadata can change after restoration; rejected edits preserve these exact current bytes.
    const validationPackage = await readFile(packagePath)
    for (const bad of [10001, -1, Infinity, NaN, '']) {
      assert.equal((await service.save({ filePath: scalperOld, values: { sandOperatingDistance: bad }, applyToVariants: true })).ok, false)
      assert.deepEqual(await readFile(packagePath), validationPackage)
      assert(existsSync(packagePath + '.cache'))
    }
    assert.equal((await service.save({ filePath: old, values: { unknown: 1 } })).ok, false)
    assert.equal((await service.save({ filePath: old, values: { ignoreSandDumpRestrictions: true } })).ok, false, 'Unsupported component removal must not be exposed')
    const result = await service.save({ filePath: old, values: { engineTorque: 110, sandCapacity: 44 }, applyToVariants: true })
    assert(result.ok, result.message); assert.deepEqual(new Set(result.affectedIds), new Set([old, restored, crane]))
    assert.equal(value(old, 'engineTorque'), 110); assert.equal(value(restored, 'engineTorque'), 220); assert.equal(value(crane, 'engineTorque'), 330)
    assert.equal(value(restored, 'sandCapacity'), 55); assert.equal(value(crane, 'sandCapacity'), undefined)
    for (const name of [old, restored]) {
      const text = await source(name)
      assert(text.includes('prop_load_volume_permission_checker'))
      assert(text.includes('prop_terraforming_permission_checker'))
      assert.equal(value(name, 'ignoreSandDumpRestrictions'), undefined)
    }
    for (const name of [base, ai, trailer, unrelated]) assert.equal(await source(name), originals.get(name))
    assert(!existsSync(packagePath + '.cache'))
    assert.deepEqual(await readFile(service.settings.packageBackups[packagePath].backupPath), originalPackage)
    // Original values survive an app restart, with permission components untouched.
    const persisted = JSON.parse(await readFile(join(temporary, 'data/settings.json'), 'utf8'))
    service.settings = persisted; await refresh()
    assert((await service.restore(old, true)).ok)
    for (const [name, text] of originals) assert.equal(await source(name), text, 'Exact original not restored: ' + name)
    const map = await service.save({ filePath: scalperOld, values: { sandOperatingDistance: 10000, sandAllowedPercent: 0 }, applyToVariants: true })
    assert(map.ok, map.message); assert.equal(map.affectedIds.length, 2)
    for (const name of [scalperOld, scalperRes]) {
      const text = await source(name)
      for (const field of ['distance', 'focusDistance', 'sandDistance']) assert.match(text, new RegExp('\\b' + field + '\\s*=\\s*10000'))
      assert.equal(value(name, 'sandAllowedPercent'), 0)
      assert.equal(value(name, 'ignoreSandDumpRestrictions'), undefined)
    }
    assert((await service.restore(scalperOld, true)).ok)
    for (const name of [scalperOld, scalperRes]) assert.equal(await source(name), originals.get(name), 'A distinct linked distance was not restored')
    const noChangeBytes = await readFile(packagePath)
    const noChange = await service.save({ filePath: old, values: { engineTorque: 100 }, applyToVariants: true })
    assert.deepEqual(noChange.affectedIds, []); assert.deepEqual(await readFile(packagePath), noChangeBytes)
    // Reject the whole batch if a counterpart cannot accept the requested change.
    service.catalog.get(restored).entry.parameters.find((p: any) => p.id === 'engineTorque').maximum = 210
    assert.equal((await service.save({ filePath: old, values: { engineTorque: 110 }, applyToVariants: true })).ok, false)
    assert.deepEqual(await readFile(packagePath), noChangeBytes)
    await refresh()
    await replaceTextEntries(packagePath, new Map([[cls(restored), originals.get(restored)!.replace('torque = 200', 'torque = 201')]]))
    const externallyChanged = await readFile(packagePath)
    assert.equal((await service.save({ filePath: old, values: { engineTorque: 110 }, applyToVariants: true })).ok, false)
    assert.deepEqual(await readFile(packagePath), externallyChanged, 'Stale values overwrote an external edit')
    await assert.rejects(replaceTextEntries(packagePath, new Map([[cls(old), 'bad'], ['missing.cls', 'bad']])))
    assert.deepEqual(await readFile(packagePath), externallyChanged, 'Missing batch member partially changed the archive')
    console.log('Linked edits: proportional values, equipment compatibility, old/restored, convoy/base exclusion, 10km distance trio, permission components preserved, exact restore, rejection and atomic ZIP batch verified. No live game writes.')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
void main().then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1) })
