import { strict as assert } from 'node:assert'
import { app } from 'electron'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseTruckLibrary, resolvePackagedVehicleMetadata, RoadCraftService, PAK_TRUCK_PARAMETERS, type ParameterSpec, type TruckLibraryRecord } from '../src/main/roadcraft.ts'
import { readMatchingTextEntries, type TextArchiveEntry } from '../src/main/zip-package.ts'
import { readLogisticsCatalog, type LogisticsCatalog } from '../src/main/logistics-catalog.ts'
import { entryInSection, type ContentEntry } from '../src/shared.ts'

interface TestableService {
  init(): Promise<void>
  scan(): Promise<{
    entries: ContentEntry[]
    logisticsScanIncomplete: boolean
  }>
  createParameters(source: string, specs: ParameterSpec[], itemId: string): {
    parameters: Array<{ id: string; value: unknown; minimum?: number; maximum?: number }>
    specMap: Map<string, ParameterSpec>
  }
  replaceParameterValue(source: string, spec: ParameterSpec, value: number): string
  replaceLinkedParameterValues(source: string, spec: ParameterSpec, value: number): string
  parsePackagedVehicle(archived: TextArchiveEntry, packagePath: string, packagedImages: string[], truckLibrary: Map<string, TruckLibraryRecord>, logistics?: LogisticsCatalog): {
    entry: { kind: string; access?: { control: string; variant: string; obtain: string } }
  }
}

const packagePath = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft\\root\\paks\\client\\default\\default_other.pak'

function fieldValue(source: string, field: string) {
  const match = new RegExp(`(?:^|\\n)\\s*${field}\\s*=\\s*([-+]?\\d*\\.?\\d+)`, 'm').exec(source)
  return match ? Number(match[1]) : undefined
}

async function loadVehicleEntry(id: string) {
  const entryName = `ssl/autogen_designer_wizard/trucks/${id}/${id}.cls`
  const [entry] = await readMatchingTextEntries(packagePath, name => name.toLowerCase() === entryName)
  assert(entry, `No se encontró ${entryName}`)
  return entry
}

async function loadVehicle(id: string) {
  return (await loadVehicleEntry(id)).content
}

async function main() {
  await app.whenReady()
  const testUserData = await mkdtemp(join(tmpdir(), 'roadcraft-studio-catalog-'))
  app.setPath('userData', testUserData)
  const service = new RoadCraftService() as unknown as TestableService
  const [libraryEntry] = await readMatchingTextEntries(packagePath, name => /\/auto_truck_library\.sso$/i.test(name))
  assert(libraryEntry, 'No se encontró auto_truck_library.sso')
  const truckLibrary = parseTruckLibrary(libraryEntry.content)
  assert(truckLibrary.size >= 190, `La biblioteca actual solo contiene ${truckLibrary.size} registros`)
  const logistics = await readLogisticsCatalog('E:\\SteamLibrary\\steamapps\\common\\RoadCraft')
  assert.equal(logistics.incomplete, false)
  assert.equal(logistics.vehicles.size, 22)

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

  for (const [id, expectedKind] of [
    ['auto_wayfarer_st7050_cargo_main', 'trailer'],
    ['auto_wayfarer_st7050_trailer_cargo_ai', 'other'],
    ['auto_don_72malamute_scout_trailer_new', 'truck'],
    ['auto_tuz_119lynx_scout_trailer_res', 'truck']
  ] as const) {
    const parsed = service.parsePackagedVehicle(await loadVehicleEntry(id), packagePath, [], truckLibrary)
    assert.equal(parsed.entry.kind, expectedKind, `${id} debe clasificarse como ${expectedKind}`)
  }

  assert.equal(resolvePackagedVehicleMetadata('auto_base_azov_4317dl_cargo_res', truckLibrary).baseVariant, true)
  assert.equal(resolvePackagedVehicleMetadata('auto_5111b_dragline_building_demolisher', truckLibrary).baseVariant, false)
  assert.equal(resolvePackagedVehicleMetadata('auto_dragline_5111b_building_demolisher_old', truckLibrary).baseVariant, false)
  const rusty = service.parsePackagedVehicle(await loadVehicleEntry('auto_dragline_5111b_building_demolisher_old'), packagePath, [], truckLibrary).entry
  assert.equal(rusty.kind, 'truck', 'Un camión recuperado no debe convertirse en unidad IA')
  assert.equal(rusty.access?.variant, 'rusty')
  assert.equal(rusty.access?.obtain, 'scenario')

  await service.init()
  const firstScan = await service.scan()
  const scan = await service.scan()
  const packaged = scan.entries.filter(entry => entry.sourceType === 'pak')
  const aiEntries = packaged.filter(entry => entryInSection(entry, 'ai'))
  const missingImages = packaged.filter(entry => !entry.imageUrl)
  const firstMissingImages = firstScan.entries.filter(entry => entry.sourceType === 'pak' && !entry.imageUrl)
  const expectedWithoutOfficialImage = [
    'auto_alces_pl30c',
    'auto_aramatsu_r1_asphalt_roller',
    'auto_epec_mag240_magnetic_crane',
    'auto_hollander_mk11_concrete_pumper',
    'auto_menzi_a91_stump_mulcher',
    'auto_qa_don',
    'auto_scout_pz14_prot'
  ]
  assert.equal(packaged.length, 194, `Se esperaban 194 clases del PAK y llegaron ${packaged.length}`)
  const baseCopies = packaged.filter(entry => entry.internalName.startsWith('auto_base_'))
  assert.equal(baseCopies.length, 73)
  assert.equal(scan.logisticsScanIncomplete, false)
  assert.deepEqual(aiEntries.map(entry => entry.internalName).sort(), [...logistics.vehicles.keys()].map(name => `auto_${name}`).sort())
  assert.equal(packaged.filter(entry => entry.kind === 'ai').length,19)
  assert.equal(packaged.filter(entry => entry.access?.control === 'shared').length,3)
  const shared = packaged.find(entry => entry.internalName === 'auto_azov_4317dl_cargo_old')!
  assert.equal(shared.kind,'truck')
  assert.equal(shared.access?.control,'shared')
  assert.equal(entryInSection(shared,'truck'),true)
  assert.equal(entryInSection(shared,'ai'),true)
  const helper = packaged.find(entry => entry.internalName === 'auto_base_aramatsu_bowhead_heavy_dumptruck_new')!
  assert(helper)
  assert.equal(helper.kind,'other')
  assert.equal(entryInSection(helper,'ai'),false,'Una variante base auxiliar no es un convoy de entrega')
  const player = packaged.find(entry => entry.internalName === 'auto_aramatsu_bowhead_heavy_dumptruck_new')!
  assert.equal(player.kind,'truck')
  assert.equal(player.access?.control,'player')
  assert.equal(entryInSection(player,'ai'),false,'Que la IA pueda ayudar a construir no convierte al camión en un convoy')
  assert.deepEqual(missingImages.filter(entry => !entry.internalName.startsWith('auto_base_')).map(entry => entry.internalName).sort(), expectedWithoutOfficialImage.sort())
  assert.equal(scan.entries.some(entry => /wheel/i.test(entry.internalName)), false, 'Las llantas no deben aparecer en el catálogo')
  await rm(testUserData, { recursive: true, force: true })

  console.log(`Catálogo verificado: ${packaged.length} clases, ${aiEntries.length} configuraciones logísticas (19 exclusivas y 3 compartidas). ${missingImages.length} clases sin imagen oficial. Primer análisis sin imagen: ${firstMissingImages.length}.`)
  app.quit()
}

void main().catch(error => {
  console.error(error)
  app.exit(1)
})
