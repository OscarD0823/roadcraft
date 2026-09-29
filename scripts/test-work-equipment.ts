import { strict as assert } from 'node:assert'
import { app } from 'electron'
import { RoadCraftService, PAK_TRUCK_PARAMETERS, type ParameterSpec } from '../src/main/roadcraft.ts'
import { readMatchingTextEntries } from '../src/main/zip-package.ts'

interface TestableService {
  createParameters(source: string, specs: ParameterSpec[], itemId: string): {
    parameters: Array<{ id: string; value: unknown; minimum?: number; maximum?: number }>
    specMap: Map<string, ParameterSpec>
  }
  replaceParameterValue(source: string, spec: ParameterSpec, value: number): string
  replaceLinkedParameterValues(source: string, spec: ParameterSpec, value: number): string
}

function fieldValue(source: string, field: string) {
  const match = new RegExp(`(?:^|\\n)\\s*${field}\\s*=\\s*([-+]?\\d*\\.?\\d+)`, 'm').exec(source)
  return match ? Number(match[1]) : undefined
}

async function loadVehicle(id: string) {
  const packagePath = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft\\root\\paks\\client\\default\\default_other.pak'
  const entryName = `ssl/autogen_designer_wizard/trucks/${id}/${id}.cls`
  const [entry] = await readMatchingTextEntries(packagePath, name => name.toLowerCase() === entryName)
  assert(entry, `No se encontró ${entryName}`)
  return entry.content
}

async function main() {
  await app.whenReady()
  const service = new RoadCraftService() as unknown as TestableService

  const zikzSource = await loadVehicle('auto_zikz_605e_mobile_scalper_res')
  const zikz = service.createParameters(zikzSource, PAK_TRUCK_PARAMETERS, 'test:zikz')
  assert.equal(zikz.parameters.find(item => item.id === 'sandAllowedPercent')?.value, 0.4)
  assert.equal(zikz.parameters.find(item => item.id === 'sandMaterialCheckRadius')?.value, 6)
  assert.equal(zikz.parameters.find(item => item.id === 'sandOperatingDistance')?.value, 140)

  let changedZikz = zikzSource
  for (const [id, value] of [['sandAllowedPercent', 0], ['sandMaterialCheckRadius', 20], ['sandOperatingDistance', 300]] as const) {
    const spec = zikz.specMap.get(id)
    assert(spec, `Falta la especificación ${id}`)
    changedZikz = service.replaceParameterValue(changedZikz, spec, value)
    changedZikz = service.replaceLinkedParameterValues(changedZikz, spec, value)
  }
  assert.equal(fieldValue(changedZikz.slice(changedZikz.indexOf('prop_truck_mobile_sand_screen')), 'allowedPercent'), 0)
  assert.equal(fieldValue(changedZikz.slice(changedZikz.indexOf('prop_truck_mobile_sand_screen')), 'materialCheckRadius'), 20)
  assert.match(changedZikz, /UsableCheckerDistance\s*=\s*\{\s*distance\s*=\s*300/m)
  assert.match(changedZikz, /SandStorage\s*=\s*\{[\s\S]*?focusDistance\s*=\s*300/m)
  assert.match(changedZikz, /prop_truck_mobile_sand_screen\s*=\s*\{[\s\S]*?sandDistance\s*=\s*300/m)

  const bowheadSource = await loadVehicle('auto_aramatsu_bowhead_heavy_dumptruck_new')
  const bowhead = service.createParameters(bowheadSource, PAK_TRUCK_PARAMETERS, 'test:bowhead')
  const width = bowhead.parameters.find(item => item.id === 'dumpWorkWidth')
  assert.equal(width?.value, 1.3)
  assert.equal(width?.maximum, 1000)
  const widthSpec = bowhead.specMap.get('dumpWorkWidth')
  assert(widthSpec)
  const changedBowhead = service.replaceParameterValue(bowheadSource, widthSpec, 1000)
  assert.match(changedBowhead, /prop_road_plan_worker\s*=\s*\{[\s\S]*?loadVolumeSettings\s*=\s*\{[\s\S]*?radius\s*=\s*500/m)

  console.log('Equipo de trabajo: Zikz 605E y ancho del Bowhead verificados contra el PAK real.')
  app.quit()
}

void main().catch(error => {
  console.error(error)
  app.exit(1)
})
