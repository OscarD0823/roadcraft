import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { collectLogisticsPools, readLogisticsCatalog } from '../src/main/logistics-catalog'
import { ZipFile } from 'yazl'
import { createWriteStream } from 'node:fs'
import { finished } from 'node:stream/promises'

async function main() {
const desc = (name: string, cargo?: string) => `{desc = {truckName = "${name}";${cargo ? `cargoName = "${cargo}";` : ''}__type = "PoolTruckWithCargoDesc";};customizationSettings = {array = ["quoted ] }"];};}`
const source = `SpawnTruck = {truckName = "player_reward";};prop_ai_helper = {truckName = "base_dozer_helper";};
regularPool = [${desc('base_delivery','steel')},${desc('base_delivery','steel')},${desc('shared_player','logs')}];
testPool = [${desc('base_validation')}];
regularPool = [${desc('base_delivery','cement')}];
prop_ai_route_presentation = {truckHolder = ${desc('base_background_traffic')};};`
const catalog = collectLogisticsPools(source, 'map_one')
assert.deepEqual([...catalog.keys()].sort(), ['base_delivery','base_validation','shared_player'])
assert.deepEqual(catalog.get('base_delivery'), [{map:'map_one',role:'delivery',cargoNames:['steel','cement']}])
assert.equal(catalog.get('base_validation')?.[0].role, 'validation')
collectLogisticsPools(`testPool = [${desc('base_delivery')}];`, 'map_two', catalog)
assert.equal(catalog.get('base_delivery')?.length, 2)
assert.equal(collectLogisticsPools(`regularPool = [${desc('unclosed')}`).size, 0)
assert.equal(collectLogisticsPools('testPool = [{desc = {truckName = "not_a_truck";__type = "ResourceDesc";};}];').size, 0)
assert.equal(collectLogisticsPools('testPool = [{desc = {truckName = "../bad";__type = "PoolTruckDesc";};}];').size, 0)

const temporary = await mkdtemp(join(tmpdir(), 'roadcraft-logistics-'))
try {
  const folder = join(temporary,'root','mods_source','xscenes','mods','test_route')
  await mkdir(folder,{recursive:true})
  await writeFile(join(folder,'test_route.scn'),source)
  let scan = await readLogisticsCatalog(temporary)
  assert.equal(scan.incomplete,false)
  assert.equal(scan.vehicles.size,3)
  assert.equal(scan.vehicles.get('base_delivery')?.[0].map,'test_route')
  await writeFile(join(folder,'test_route.scn'),`regularPool = [${desc('new_mod_delivery')}];`)
  scan = await readLogisticsCatalog(temporary)
  assert.deepEqual([...scan.vehicles.keys()],['new_mod_delivery'],'Rescan must not retain stale convoy roles')
  const packages = join(temporary,'root','paks','client','default','scenes')
  await mkdir(packages,{recursive:true})
  const zip = new ZipFile()
  zip.addBuffer(Buffer.concat([Buffer.from([0,7,0,0]), Buffer.from(`regularPool = [${desc('base_packaged_delivery','steel')}];`)]),'scenes/test.scn/test.cd_list')
  zip.addBuffer(Buffer.from(`regularPool = [${desc('ignored_texture_reference')}];`),'textures/unrelated.pct')
  const destination = createWriteStream(join(packages,'new_scene.pak'))
  zip.outputStream.pipe(destination)
  zip.end()
  await finished(destination)
  scan = await readLogisticsCatalog(temporary)
  assert.equal(scan.incomplete,false)
  assert.deepEqual([...scan.vehicles.keys()].sort(),['base_packaged_delivery','new_mod_delivery'])
  assert.deepEqual(scan.vehicles.get('base_packaged_delivery'),[{map:'new_scene',role:'delivery',cargoNames:['steel']}])
  await writeFile(join(packages,'bad_scene.pak'),'invalid zip')
  assert.equal((await readLogisticsCatalog(temporary)).incomplete,true)
} finally {
  assert(basename(temporary).startsWith('roadcraft-logistics-'))
  await rm(temporary,{recursive:true,force:true})
}
console.log('Logistics parser verified: delivery/test pools, shared use, helpers excluded, malformed pools, mod rescan and corrupt-package warning.')
}

void main().catch(error => { console.error(error); process.exitCode = 1 })
