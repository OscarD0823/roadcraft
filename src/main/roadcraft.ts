import { app, dialog, shell } from 'electron'
import { copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import type { ContentEntry, ContentKind, EditableParameter, OperationResult, ParameterKind, ParameterValue, SaveGameChanges, SaveGameData, SavePayload, SaveSlotSummary, ScanResult, VehiclePreviewAsset, PreviewMaterial } from '../shared'
import { applySaveGameChanges, createSaveGameData, decodeCompleteSave, encodeCompleteSave } from './save-game'
import { readMatchingBinaryEntries, readMatchingTextEntries, replaceTextEntry, type TextArchiveEntry } from './zip-package'
import { decodeRoadCraftShopTexture, decodeRoadCraftTexture } from './shop-texture'
import { CompiledPreviewStore } from './compiled-preview'
import { arrayObjects } from './source-blocks'
import { previewAssembly, previewMobility } from './preview-assembly'

interface PackageBackupState {
  backupPath: string
  originalSignature: string
  lastWrittenSignature: string
}

interface StudioSettings {
  installPath: string
  locale: string
  customImages: Record<string, string>
  automaticImages: Record<string, string>
  imagePackageSignature: string
  originalValues: Record<string, Record<string, ParameterValue>>
  editedAt: Record<string, number>
  packageBackups: Record<string, PackageBackupState>
}

export interface ParameterSpec {
  id: string
  path: string[]
  field: string
  labelKey: string
  groupKey: string
  kind?: ParameterKind
  unit?: string
  factors?: [number, number, number]
  safeFactors?: [number, number]
  absoluteRange?: [number, number]
  linkedPaths?: string[][]
  linkedParameters?: Array<{ path: string[]; field: string }>
  displayScale?: number
  options?: Array<{ value: string; labelKey: string }>
}

interface CatalogItem {
  entry: ContentEntry
  specs: Map<string, ParameterSpec>
  sourceType: 'bro' | 'pak'
  sourcePath: string
  archiveEntryName?: string
}

export interface TruckLibraryRecord {
  name: string
  uiIcon?: string
  isBase: boolean
  buyCost?: number
  rankToUnlock?: number
}

interface PackagedVehicleMetadata {
  registered: boolean
  aiOnly: boolean
  uiIcon?: string
  buyCost?: number
  rankToUnlock?: number
}

interface TextureDescriptor {
  width: number
  height: number
}

const DEFAULT_INSTALL_PATH = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft'
// `base` is a separate SDK folder: these entities are selected by AI route pools.
const BASE_VEHICLE_PATTERN = /^ssl\/autogen_designer_wizard\/trucks\/(?:base\/)?([^/]+)\/\1\.cls$/i
const TRUCK_LIBRARY_PATTERN = /^ssl\/autogen_designer_wizard\/trucks\/auto_truck_library\.sso$/i
const COMPATIBLE_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const PACKAGED_IMAGE_ALIASES: Record<string, string> = {
  auto_5111b_dragline_building_demolisher: 'ui_veh_icon_dragline_511b',
  auto_dragline_5111b_building_demolisher_old: 'ui_veh_icon_dragline_511b_old',
  auto_minuteman_k370_explorer_res: 'ui_veh_icon_minuteman_explorer',
  auto_n_and_s_260gantry_crane_railroad: 'ui_veh_newton_and_steig_260_gantry_crane_railroad',
  auto_n_and_s_260gantry_crane_railroad_80m: 'ui_veh_newton_and_steig_260_gantry_crane_railroad',
  auto_n_and_s_700r_tower_crane_railed: 'ui_veh_newton_and_steig_700_r_tower_crane_railed',
  auto_n_and_s_700s_tower_crane: 'ui_veh_newton_and_steig_700_s_tower_crane_stat',
  auto_n_and_s_loader20g_crane_grabber: 'ui_veh_newton_and_steig_loader_20_g_crane_grabber',
  auto_wayfarer_gas_semitrailer: 'ui_veh_wayfarer_st7050_veh_trailer_gas',
  auto_wayfarer_oft96_ts_t_crane_flatbed_new: 'ui_veh_icon_wayfarer_oft96_ts_t'
}
const execFileAsync = promisify(execFile)

export function parseTruckLibrary(source: string) {
  const records = new Map<string, TruckLibraryRecord>()
  const pattern = /^ {3}"?([a-z0-9_]+)"?\s*=\s*\{/gmi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source))) {
    const open = source.indexOf('{', match.index)
    let depth = 0
    let quoted = false
    let close = source.length

    for (let index = open; index < source.length; index++) {
      const character = source[index]
      if (character === '"' && source[index - 1] !== '\\') quoted = !quoted
      if (quoted) continue
      if (character === '{') depth++
      if (character === '}') depth--
      if (depth === 0) {
        close = index
        break
      }
    }

    const name = match[1].toLowerCase()
    const block = source.slice(open + 1, close)
    const uiIcon = /^ {6}uiIcon\s*=\s*"([^"]+)"/mi.exec(block)?.[1]
    const number = (field: string) => {
      const value = new RegExp(`^ {6}${field}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`, 'mi').exec(block)?.[1]
      return value === undefined ? undefined : Number(value)
    }
    const previous = records.get(name)
    records.set(name, { name, uiIcon: uiIcon ?? previous?.uiIcon, isBase: name.startsWith('base_'),
      buyCost: number('buyCost') ?? previous?.buyCost, rankToUnlock: number('rankToUnlock') ?? previous?.rankToUnlock })
    pattern.lastIndex = close + 1
  }

  return records
}

export function resolvePackagedVehicleMetadata(stem: string, library: Map<string, TruckLibraryRecord>): PackagedVehicleMetadata {
  const name = stem.toLowerCase().replace(/^auto_/, '')
  const regular = library.get(name)
  const base = library.get(`base_${name}`)
  return {
    registered: Boolean(regular || base),
    aiOnly: name.startsWith('base_') || /(?:^|_)ai(?:_|$)/i.test(name) || Boolean(base && !regular),
    uiIcon: regular?.uiIcon ?? base?.uiIcon,
    buyCost: regular?.buyCost ?? base?.buyCost,
    rankToUnlock: regular?.rankToUnlock ?? base?.rankToUnlock
  }
}

const BRO_TRUCK_PARAMETERS: ParameterSpec[] = [
  {
    id: 'engineTorque', path: ['truckSettings', 'engine', 'params'], field: 'torque',
    labelKey: 'engineTorque', groupKey: 'engine', unit: 'N·m', factors: [1.08, 1.18, 1.3], safeFactors: [0.7, 1.35]
  },
  {
    id: 'fuelCapacity', path: ['fuelSettings'], field: 'maxFuelTankVolume',
    labelKey: 'fuelCapacity', groupKey: 'fuel', unit: 'L', factors: [1.1, 1.25, 1.5], safeFactors: [0.75, 1.5]
  },
  {
    id: 'fuelConsumption', path: ['fuelSettings'], field: 'fuelConsumption',
    labelKey: 'fuelConsumption', groupKey: 'fuel', factors: [0.9, 0.8, 0.7], safeFactors: [0.7, 1.3]
  },
  {
    id: 'frontSuspensionStrength', path: ['truckSettings', 'suspensionCollection', 'Front'], field: 'strength',
    labelKey: 'frontSuspensionStrength', groupKey: 'suspension', factors: [1.06, 1.14, 1.22], safeFactors: [0.75, 1.25]
  },
  {
    id: 'rearSuspensionStrength', path: ['truckSettings', 'suspensionCollection', 'Rear'], field: 'strength',
    labelKey: 'rearSuspensionStrength', groupKey: 'suspension', factors: [1.06, 1.14, 1.22], safeFactors: [0.75, 1.25]
  },
  {
    id: 'gearSwitchDelay', path: ['truckSettings', 'gearbox', 'params'], field: 'defaultGearSwitchDelay',
    labelKey: 'gearSwitchDelay', groupKey: 'gearbox', unit: 's', factors: [0.9, 0.8, 0.7], safeFactors: [0.7, 1.3]
  },
  {
    id: 'buyCost', path: ['uiInfo'], field: 'buyCost',
    labelKey: 'buyCost', groupKey: 'economy', factors: [0.9, 0.75, 0.5], safeFactors: [0.5, 2]
  }
]

export const PAK_TRUCK_PARAMETERS: ParameterSpec[] = [
  {
    id: 'engineTorque', path: ['properties', 'prop_truck_rb', 'engine', 'params'], field: 'torque',
    labelKey: 'engineTorque', groupKey: 'engine', unit: 'N·m', factors: [1.08, 1.18, 1.3], safeFactors: [0.7, 1.35]
  },
  {
    id: 'engineResponsiveness', path: ['properties', 'prop_truck_rb', 'engine', 'params'], field: 'responsiveness',
    labelKey: 'engineResponsiveness', groupKey: 'engine', factors: [1.04, 1.09, 1.15], safeFactors: [0.8, 1.2]
  },
  {
    id: 'brakesDelay', path: ['properties', 'prop_truck_rb', 'engine', 'params'], field: 'brakesDelay',
    labelKey: 'brakesDelay', groupKey: 'engine', unit: 's', factors: [0.92, 0.84, 0.75], safeFactors: [0.7, 1.25]
  },
  {
    id: 'fuelCapacity', path: ['properties', 'prop_fuel_tank'], field: 'maxFuelTankVolume',
    labelKey: 'fuelCapacity', groupKey: 'fuel', unit: 'L', factors: [1.1, 1.25, 1.5], safeFactors: [0.75, 1.5]
  },
  {
    id: 'fuelConsumption', path: ['properties', 'prop_fuel_tank'], field: 'fuelConsumption',
    labelKey: 'fuelConsumption', groupKey: 'fuel', factors: [0.9, 0.8, 0.7], safeFactors: [0.7, 1.3]
  },
  {
    id: 'frontSuspensionStrength', path: ['properties', 'prop_truck_rb', 'suspensionSet', 'front'], field: 'strength',
    labelKey: 'frontSuspensionStrength', groupKey: 'suspension', factors: [1.06, 1.14, 1.22], safeFactors: [0.75, 1.25]
  },
  {
    id: 'rearSuspensionStrength', path: ['properties', 'prop_truck_rb', 'suspensionSet', 'rear'], field: 'strength',
    labelKey: 'rearSuspensionStrength', groupKey: 'suspension', factors: [1.06, 1.14, 1.22], safeFactors: [0.75, 1.25]
  },
  {
    id: 'frontSuspensionDamping', path: ['properties', 'prop_truck_rb', 'suspensionSet', 'front'], field: 'damping',
    labelKey: 'frontSuspensionDamping', groupKey: 'suspension', factors: [1.04, 1.09, 1.15], safeFactors: [0.8, 1.2]
  },
  {
    id: 'rearSuspensionDamping', path: ['properties', 'prop_truck_rb', 'suspensionSet', 'rear'], field: 'damping',
    labelKey: 'rearSuspensionDamping', groupKey: 'suspension', factors: [1.04, 1.09, 1.15], safeFactors: [0.8, 1.2]
  },
  {
    id: 'gearSwitchDelay', path: ['properties', 'prop_truck_rb', 'gearbox', 'params'], field: 'defaultGearSwitchDelay',
    labelKey: 'gearSwitchDelay', groupKey: 'gearbox', unit: 's', factors: [0.9, 0.8, 0.7], safeFactors: [0.7, 1.3]
  },
  {
    id: 'maxSteerSpeed', path: ['properties', 'prop_truck_rb'], field: 'maxSteerSpeed',
    labelKey: 'maxSteerSpeed', groupKey: 'steering', factors: [1.04, 1.08, 1.12], safeFactors: [0.8, 1.2]
  },
  {
    id: 'backSteerSpeed', path: ['properties', 'prop_truck_rb'], field: 'backSteerSpeed',
    labelKey: 'backSteerSpeed', groupKey: 'steering', factors: [1.04, 1.08, 1.12], safeFactors: [0.8, 1.2]
  },
  {
    id: 'clutchSwitchTime', path: ['properties', 'prop_truck_rb', 'gearbox', 'params'], field: 'clutchSwitchTime',
    labelKey: 'clutchSwitchTime', groupKey: 'gearbox', unit: 's', factors: [0.94, 0.88, 0.8], safeFactors: [0.75, 1.25]
  },
  {
    id: 'upperGearSwitchDelay', path: ['properties', 'prop_truck_rb', 'gearbox', 'params'], field: 'upperGearSwitchDelayBase',
    labelKey: 'upperGearSwitchDelay', groupKey: 'gearbox', unit: 's', factors: [0.94, 0.88, 0.8], safeFactors: [0.75, 1.25]
  },
  {
    id: 'downGearSwitchDelay', path: ['properties', 'prop_truck_rb', 'gearbox', 'params'], field: 'downGearSwitchDelay',
    labelKey: 'downGearSwitchDelay', groupKey: 'gearbox', unit: 's', factors: [0.94, 0.88, 0.8], safeFactors: [0.75, 1.25]
  },
  {
    id: 'neutralGearSwitchDelay', path: ['properties', 'prop_truck_rb', 'gearbox', 'params'], field: 'neutralGearSwitchingDelay',
    labelKey: 'neutralGearSwitchDelay', groupKey: 'gearbox', unit: 's', factors: [0.94, 0.88, 0.8], safeFactors: [0.75, 1.25]
  },
  {
    id: 'highGearSpeed', path: ['properties', 'prop_truck_rb', 'gearbox', 'params', 'highGear'], field: 'angularVelocity',
    labelKey: 'highGearSpeed', groupKey: 'gearbox', factors: [1.03, 1.06, 1.1], safeFactors: [0.85, 1.12]
  },
  {
    id: 'lowGearSpeed', path: ['properties', 'prop_truck_rb', 'gearbox', 'params', 'lowRangeGear'], field: 'angularVelocity',
    labelKey: 'lowGearSpeed', groupKey: 'gearbox', factors: [1.03, 1.06, 1.1], safeFactors: [0.85, 1.12]
  },
  {
    id: 'reverseGearSpeed', path: ['properties', 'prop_truck_rb', 'gearbox', 'params', 'reverseGear'], field: 'angularVelocity',
    labelKey: 'reverseGearSpeed', groupKey: 'gearbox', factors: [1.03, 1.06, 1.1], safeFactors: [0.85, 1.12]
  },
  {
    id: 'awdMode', path: ['properties', 'prop_truck_gearbox_controller'], field: 'awdMode',
    labelKey: 'awdMode', groupKey: 'drivetrain', kind: 'select', options: [
      { value: 'ALWAYS_ON', labelKey: 'alwaysOn' },
      { value: 'CONTROLLED', labelKey: 'controlled' },
      { value: 'ALWAYS_OFF', labelKey: 'alwaysOff' }
    ]
  },
  {
    id: 'difflockMode', path: ['properties', 'prop_truck_gearbox_controller'], field: 'difflockMode',
    labelKey: 'difflockMode', groupKey: 'drivetrain', kind: 'select', options: [
      { value: 'ALWAYS_ON', labelKey: 'alwaysOn' },
      { value: 'CONTROLLED', labelKey: 'controlled' },
      { value: 'ALWAYS_OFF', labelKey: 'alwaysOff' }
    ]
  },
  {
    id: 'lowGearAvailable', path: ['properties', 'prop_truck_gearbox_controller'], field: 'isLowGearAvailable',
    labelKey: 'lowGearAvailable', groupKey: 'drivetrain', kind: 'boolean'
  },
  {
    id: 'dozerWidth', path: ['properties', 'prop_truck_flattener', 'flattener', 'size'], field: 'x',
    labelKey: 'dozerWidth', groupKey: 'workEquipment', unit: 'm', factors: [1.5, 2.5, 4],
    safeFactors: [0.9, 1.12], absoluteRange: [0.5, 1000]
  },
  {
    id: 'rollerWidth', path: ['properties', 'prop_truck_asphalt_roller', 'asphaltRoller', 'size'], field: 'x',
    labelKey: 'rollerWidth', groupKey: 'workEquipment', unit: 'm', factors: [1.5, 2.5, 4],
    safeFactors: [0.9, 1.12], absoluteRange: [0.5, 1000],
    linkedPaths: [
      ['properties', 'prop_truck_asphalt_roller', 'asphaltRoller', 'rollUpRearSize'],
      ['properties', 'prop_truck_asphalt_roller', 'asphaltRoller', 'rollUpForwardSize']
    ]
  },
  {
    id: 'paverWidth', path: ['properties', 'prop_truck_asphalter', 'asphalter', 'size'], field: 'x',
    labelKey: 'paverWidth', groupKey: 'workEquipment', unit: 'm', factors: [1.5, 2.5, 4],
    safeFactors: [0.9, 1.12], absoluteRange: [0.5, 1000]
  },
  {
    id: 'dumpWorkWidth', path: ['properties', 'prop_road_plan_worker', 'loadVolumeSettings'], field: 'radius',
    labelKey: 'dumpWorkWidth', groupKey: 'workEquipment', unit: 'm', factors: [1.5, 2.5, 4],
    safeFactors: [0.9, 1.12], absoluteRange: [0.5, 1000], displayScale: 2
  },
  {
    id: 'sandAllowedPercent', path: ['properties', 'prop_truck_mobile_sand_screen'], field: 'allowedPercent',
    labelKey: 'sandAllowedPercent', groupKey: 'workEquipment', factors: [0.5, 0.25, 0],
    safeFactors: [0, 1], absoluteRange: [0, 1]
  },
  {
    id: 'sandMaterialCheckRadius', path: ['properties', 'prop_truck_mobile_sand_screen'], field: 'materialCheckRadius',
    labelKey: 'sandMaterialCheckRadius', groupKey: 'workEquipment', unit: 'm', factors: [1.33, 2, 3.33],
    safeFactors: [0.75, 1.5], absoluteRange: [1, 20]
  },
  {
    id: 'sandOperatingDistance',
    path: ['properties', 'prop_usable', 'smartsEntryPoints', 'SandStorage', 'checkers', 'UsableCheckerDistance'],
    field: 'distance', labelKey: 'sandOperatingDistance', groupKey: 'workEquipment', unit: 'm',
    factors: [1.25, 1.5, 2], safeFactors: [0.75, 1.5], absoluteRange: [20, 300],
    linkedParameters: [
      { path: ['properties', 'prop_usable', 'smartsEntryPoints', 'SandStorage'], field: 'focusDistance' },
      { path: ['properties', 'prop_truck_mobile_sand_screen'], field: 'sandDistance' }
    ]
  }
]

export class RoadCraftService {
  private readonly settingsPath = join(app.getPath('userData'), 'settings.json')
  private readonly backupsRoot = join(app.getPath('userData'), 'backups')
  private settings: StudioSettings = {
    installPath: DEFAULT_INSTALL_PATH,
    locale: 'es',
    customImages: {},
    automaticImages: {},
    imagePackageSignature: '',
    originalValues: {},
    editedAt: {},
    packageBackups: {}
  }
  private catalog = new Map<string, CatalogItem>()
  private readonly trustedSavePaths = new Set<string>()

  async init() {
    try {
      const stored = JSON.parse(await readFile(this.settingsPath, 'utf8')) as Partial<StudioSettings>
      this.settings = {
        ...this.settings,
        ...stored,
        customImages: stored.customImages ?? {},
        automaticImages: stored.automaticImages ?? {},
        imagePackageSignature: stored.imagePackageSignature ?? '',
        originalValues: stored.originalValues ?? {},
        editedAt: stored.editedAt ?? {},
        packageBackups: stored.packageBackups ?? {}
      }
    } catch {
      await this.persistSettings()
    }

    if (!this.isInstallPath(this.settings.installPath) && this.isInstallPath(DEFAULT_INSTALL_PATH)) {
      this.settings.installPath = DEFAULT_INSTALL_PATH
      await this.persistSettings()
    }
  }

  getSettings() {
    return {
      installPath: this.settings.installPath,
      locale: this.settings.locale,
      version: app.getVersion()
    }
  }

  async setLocale(locale: string) {
    this.settings.locale = locale
    await this.persistSettings()
  }

  async getPreview(id: string): Promise<VehiclePreviewAsset | undefined> {
    const item = this.catalog.get(id)
    if (!item) return
    if (item.sourceType === 'pak') {
      const source = await this.readItemSource(item)
      const name = this.readStringValue(source, ['properties', 'geom'], 'nameTpl')
      if (!name) return
      const folder = item.archiveEntryName!.slice(0, item.archiveEntryName!.lastIndexOf('/') + 1)
      const wheels = await readMatchingTextEntries(item.sourcePath, entry => entry.startsWith(folder) && /\/auto_wheel_[^/]+\.cls$/i.test(entry))
      const assembly = previewAssembly(source, wheels)
      const asset = await this.compiledPreviews().get(name, undefined, assembly.wheels, assembly.tracks)
      const material = this.readStringValue(source, ['properties','prop_customization_materials'],'defaultMaterial')
      return asset ? { ...asset, paintColor: await this.compiledPreviews().paintColor(material) } : undefined
    }
    const root = join(this.settings.installPath, 'root', 'mods_source')
    const source = await readFile(item.sourcePath, 'utf8')
    const ref = this.readStringValue(source, [], 'tpl')
    if (!ref || !/^[a-z0-9_-]{1,150}$/i.test(ref)) return
    const fbx = join(root, 'models', 'mods', ref + '.tpl.asset', ref + '.fbx')
    if (existsSync(fbx) && (await stat(fbx)).size > 64 * 1024 * 1024) return
    const textures: Record<string, string> = {}
    for (const path of await this.walkFiles(join(root, 'textures'), new Set(['.tga', '.png', '.jpg', '.jpeg', '.dds']))) {
      textures[basename(path).toLowerCase()] = pathToFileURL(path).href
    }
    let wheelRef = this.readStringValue(source, ['wheelPool', 'Wheel', 'wheel'], 'tpl')
    if (!wheelRef) {
      const type = this.readStringValue(source, ['wheelPool', 'Wheel', 'wheel'], '__type')
      const wheelBro = type && (await this.walkFiles(join(root, 'bro', 'wheels'), new Set(['.bro'])))
        .find(path => basename(path, '.bro').replaceAll('_', '').toLowerCase() === type.toLowerCase())
      if (wheelBro) wheelRef = this.readStringValue(await readFile(wheelBro, 'utf8'), [], 'tpl')
    }
    const wheel = wheelRef && /^[a-z0-9_-]{1,150}$/i.test(wheelRef) ? join(root, 'models', 'mods', wheelRef + '.tpl.asset', wheelRef + '.fbx') : undefined
    const materials: Record<string, PreviewMaterial> = {}
    const textureUrl = (name?: string) => name ? ['.tga','.dds','.png','.jpg','.jpeg'].map(ext=>textures[name.toLowerCase()+ext]).find(Boolean) : undefined
    const importScale = async (name?: string) => {
      if (!name || !/^[a-z0-9_-]{1,150}$/i.test(name)) return 1
      const optionsPath = join(root,'models','mods',name+'.tpl.asset','export_options.ps')
      if (!existsSync(optionsPath)) return 1
      const options = await readFile(optionsPath,'utf8')
      const value = this.readParameterValue(options,{id:'scale',path:['options','fbx'],field:'scale',labelKey:'',groupKey:''})
      return typeof value==='number' && value>0 && value<=10000 ? value : 1
    }
    for (const name of [ref, wheelRef]) {
      if (!name || !/^[a-z0-9_-]{1,150}$/i.test(name)) continue
      const markupPath = join(root, 'models', 'mods', name + '.tpl.asset', name + '.tpl_markup')
      if (!existsSync(markupPath)) continue
      const markup = await readFile(markupPath, 'utf8')
      for (const match of markup.matchAll(/([a-z0-9_]+)\s*=\s*\{\s*materialName\s*=\s*"([a-z0-9_-]+)"/gi)) {
        const path = join(root, 'material_instances', match[2] + '.mi')
        if (!existsSync(path)) continue
        const definition = await readFile(path, 'utf8')
        const albedo = /(?:texDiff|albedo)\s*=\s*"([a-z0-9_-]+)"/i.exec(definition)?.[1]
        const normal = /(?:texNM|NM)\s*=\s*"([a-z0-9_-]+)"/i.exec(definition)?.[1]
        const shading = /(?:texSpec|spec)\s*=\s*"([a-z0-9_-]+)"/i.exec(definition)?.[1]
        const emissive = /(?:texEm|emissive)\s*=\s*"([a-z0-9_-]+)"/i.exec(definition)?.[1]
        const type = /__type\s*=\s*"([a-z0-9_-]+)"/i.exec(definition)?.[1] ?? ''
        materials[match[1]] = { albedo: textureUrl(albedo), normal: textureUrl(normal), shading: textureUrl(shading), emissive: textureUrl(emissive), type, transparent: /glass|transparent/i.test(type) }
      }
    }
    const scale = this.readParameterValue(source,{id:'scale',path:['wheelPool','Wheel'],field:'scale',labelKey:'',groupKey:''})
    if (!existsSync(fbx)) {
      const directory = join(root, 'models', 'mods', ref + '.tpl.asset', 'tpl')
      const wheelDirectory = wheelRef && /^[a-z0-9_-]{1,150}$/i.test(wheelRef) ? join(root, 'models', 'mods', wheelRef + '.tpl.asset', 'tpl') : undefined
      const slots = wheelDirectory && existsSync(join(wheelDirectory, wheelRef + '.tpl')) ? arrayObjects(source, 'wheelSlots').flatMap(slot => {
        const frame = /geomName\s*=\s*"([^"]+)"/.exec(slot)?.[1]
        return frame ? [{ frame, model: wheelRef!, directory: wheelDirectory, scale: typeof scale === 'number' ? scale : 1, right: /isRightSided\s*=\s*True/i.test(slot) }] : []
      }) : []
      const compiled = existsSync(join(directory, ref + '.tpl')) ? await this.compiledPreviews().get(ref, directory, slots) : undefined
      return compiled ? { ...compiled, textures, materials: { ...compiled.materials, ...materials } } : undefined
    }
    return { modelUrl: pathToFileURL(fbx).href, textures, materials, modelImportScale: await importScale(ref), wheelImportScale: await importScale(wheelRef), wheelScale: typeof scale==='number' && scale>0 && scale<=10 ? scale : 1, wheelUrl: wheel && existsSync(wheel) ? pathToFileURL(wheel).href : undefined }
  }

  private previewStore?: { path: string; store: CompiledPreviewStore }
  private compiledPreviews() {
    if (this.previewStore?.path !== this.settings.installPath) this.previewStore = { path: this.settings.installPath,
      store: new CompiledPreviewStore(this.settings.installPath, join(app.getPath('userData'), 'preview-cache')) }
    return this.previewStore.store
  }

  async chooseInstall(): Promise<ScanResult | undefined> {
    const result = await dialog.showOpenDialog({
      title: 'Seleccionar la carpeta de RoadCraft',
      defaultPath: dirname(this.settings.installPath),
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths[0]) return

    const selected = this.normalizeInstallPath(result.filePaths[0])
    if (!selected) {
      throw new Error('La carpeta seleccionada no contiene una instalación de RoadCraft compatible.')
    }

    this.settings.installPath = selected
    await this.persistSettings()
    return this.scan()
  }

  async scan(): Promise<ScanResult> {
    if (!this.isInstallPath(this.settings.installPath)) {
      throw new Error('No se encontró RoadCraft. Selecciona la carpeta donde está instalado el juego.')
    }

    const sourceRoot = join(this.settings.installPath, 'root', 'mods_source')
    const broRoot = join(sourceRoot, 'bro')
    const basePackage = this.getBasePackagePath()
    const broFiles = (await this.walkFiles(broRoot, new Set(['.bro'])))
      .filter(filePath => !relative(broRoot, filePath).split(sep).some(part => part.toLowerCase() === 'wheels'))
    const compatibleImages = await this.walkFiles(sourceRoot, COMPATIBLE_IMAGE_EXTENSIONS)
    const modDefinitions = await this.walkFiles(sourceRoot, new Set(['.mod']))
    const packagedSources = existsSync(basePackage)
      ? await readMatchingTextEntries(basePackage, entryName => BASE_VEHICLE_PATTERN.test(entryName) || TRUCK_LIBRARY_PATTERN.test(entryName))
      : []
    const packagedVehicles = packagedSources.filter(item => BASE_VEHICLE_PATTERN.test(item.entryName))
    const truckLibrary = parseTruckLibrary(packagedSources.find(item => TRUCK_LIBRARY_PATTERN.test(item.entryName))?.content ?? '')
    const packagedImages = await this.findPackagedVehicleImages(packagedVehicles, truckLibrary)
    const entries: ContentEntry[] = []

    this.catalog.clear()

    for (const filePath of broFiles) {
      const parsed = await this.parseBroEntry(filePath, broRoot, compatibleImages)
      entries.push(parsed.entry)
      this.catalog.set(parsed.entry.id, parsed)
    }

    for (const archivedVehicle of packagedVehicles) {
      const parsed = this.parsePackagedVehicle(archivedVehicle, basePackage, packagedImages, truckLibrary)
      entries.push(parsed.entry)
      this.catalog.set(parsed.entry.id, parsed)
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))
    // Rescans can follow game or mod updates. Do not retain stale asset indexes.
    this.previewStore = undefined

    return {
      installPath: this.settings.installPath,
      sourceRoots: [broRoot, basePackage],
      entries,
      packageCount: modDefinitions.length,
      scannedAt: Date.now()
    }
  }

  async save(payload: SavePayload): Promise<OperationResult> {
    try {
      const item = this.catalog.get(payload.filePath)
      if (!item || !this.isTrustedItem(item)) {
        throw new Error('El archivo ya no pertenece a la biblioteca analizada.')
      }

      let source = await this.readItemSource(item)
      const originalValues = this.settings.originalValues[item.entry.id] ?? {}

      for (const [parameterId, requestedValue] of Object.entries(payload.values)) {
        const spec = item.specs.get(parameterId)
        const parameter = item.entry.parameters.find(value => value.id === parameterId)

        if (!spec || !parameter || !this.isValidParameterValue(spec, requestedValue)) continue
        if (typeof requestedValue === 'number'
          && (requestedValue < (parameter.minimum ?? Number.NEGATIVE_INFINITY)
            || requestedValue > (parameter.maximum ?? Number.POSITIVE_INFINITY))
        ) {
          throw new Error(`El valor de ${parameter.labelKey} está fuera del rango seguro.`)
        }

        originalValues[parameterId] ??= parameter.original
        source = this.replaceParameterValue(source, spec, requestedValue)
        source = this.replaceLinkedParameterValues(source, spec, requestedValue)
      }

      await this.writeItemSource(item, source)
      this.settings.originalValues[item.entry.id] = originalValues
      this.settings.editedAt[item.entry.id] = Date.now()
      await this.persistSettings()
      await this.scan()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async restore(itemId: string): Promise<OperationResult> {
    try {
      const item = this.catalog.get(itemId)
      const originalValues = this.settings.originalValues[itemId]
      if (!item || !originalValues || !this.isTrustedItem(item)) return { ok: true }

      let source = await this.readItemSource(item)
      for (const [parameterId, originalValue] of Object.entries(originalValues)) {
        const spec = item.specs.get(parameterId)
        if (spec) {
          source = this.replaceParameterValue(source, spec, originalValue)
          source = this.replaceLinkedParameterValues(source, spec, originalValue)
        }
      }

      await this.writeItemSource(item, source)
      delete this.settings.originalValues[itemId]
      delete this.settings.editedAt[itemId]
      await this.persistSettings()
      await this.scan()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async chooseImage(itemId: string) {
    const item = this.catalog.get(itemId)
    if (!item) throw new Error('Primero vuelve a analizar la biblioteca.')

    const result = await dialog.showOpenDialog({
      title: 'Seleccionar imagen del mod',
      properties: ['openFile'],
      filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })

    if (result.canceled || !result.filePaths[0]) return

    this.settings.customImages[item.entry.id] = result.filePaths[0]
    await this.persistSettings()
    return pathToFileURL(result.filePaths[0]).href
  }

  async openFile(itemId: string) {
    const item = this.catalog.get(itemId)
    if (item) shell.showItemInFolder(item.sourcePath)
  }

  async openSourceFolder() {
    await shell.openPath(join(this.settings.installPath, 'root', 'mods_source', 'bro'))
  }

  async launchModEditor(): Promise<OperationResult> {
    const launcher = join(this.settings.installPath, 'mod_editor_release.bat')
    if (!existsSync(launcher)) return { ok: false, message: 'No se encontró mod_editor_release.bat.' }

    try {
      const child = spawn(launcher, [], {
        cwd: this.settings.installPath,
        detached: true,
        shell: true,
        stdio: 'ignore'
      })
      child.unref()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async findSaveGames(): Promise<SaveSlotSummary[]> {
    const localAppData = process.env.LOCALAPPDATA ?? join(app.getPath('home'), 'AppData', 'Local')
    const candidateRoots = [join(localAppData, 'Saber'), join(localAppData, 'Saber Interactive')]
    const files = [...new Set((await Promise.all(candidateRoots.map(root => this.findCompleteSaveFiles(root, 10)))).flat())]
    const slots: SaveSlotSummary[] = []

    for (const filePath of files) {
      try {
        const fileStats = await stat(filePath)
        const normalized = resolve(filePath)
        this.trustedSavePaths.add(normalized.toLowerCase())
        slots.push({
          filePath: normalized,
          slotName: basename(dirname(normalized)),
          profileId: basename(dirname(dirname(dirname(dirname(normalized))))),
          modifiedAt: fileStats.mtimeMs,
          size: fileStats.size
        })
      } catch {
        // A cloud sync can remove a slot while it is being enumerated.
      }
    }

    return slots.sort((a, b) => b.modifiedAt - a.modifiedAt)
  }

  async chooseSaveGame(): Promise<SaveGameData | undefined> {
    const localAppData = process.env.LOCALAPPDATA ?? join(app.getPath('home'), 'AppData', 'Local')
    const result = await dialog.showOpenDialog({
      title: 'Seleccionar CompleteSave de RoadCraft',
      defaultPath: join(localAppData, 'Saber'),
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return
    const filePath = resolve(result.filePaths[0])
    if (basename(filePath).toLowerCase() !== 'completesave') {
      throw new Error('Selecciona el archivo llamado CompleteSave dentro de una carpeta SLOT_.')
    }
    this.trustedSavePaths.add(filePath.toLowerCase())
    try {
      return await this.readSaveGame(filePath)
    } catch (error) {
      this.trustedSavePaths.delete(filePath.toLowerCase())
      throw error
    }
  }

  async readSaveGame(filePath: string): Promise<SaveGameData> {
    const normalized = resolve(filePath)
    if (basename(normalized).toLowerCase() !== 'completesave') {
      throw new Error('El archivo elegido no se llama CompleteSave.')
    }
    if (!this.trustedSavePaths.has(normalized.toLowerCase())) {
      const discovered = await this.findSaveGames()
      if (!discovered.some(item => item.filePath.toLowerCase() === normalized.toLowerCase())) {
        throw new Error('Vuelve a buscar las partidas o selecciónala manualmente.')
      }
    }
    const [content, fileStats] = await Promise.all([readFile(normalized), stat(normalized)])
    const decoded = decodeCompleteSave(content)
    return createSaveGameData(decoded, {
      filePath: normalized,
      slotName: basename(dirname(normalized)),
      profileId: basename(dirname(dirname(dirname(dirname(normalized))))),
      modifiedAt: fileStats.mtimeMs
    })
  }

  async writeSaveGame(changes: SaveGameChanges): Promise<OperationResult> {
    const filePath = resolve(changes.filePath)
    const trustedKey = filePath.toLowerCase()
    let backupPath: string | undefined
    const temporaryPath = join(dirname(filePath), `.CompleteSave.roadcraft-studio-${process.pid}.tmp`)

    try {
      if (basename(filePath).toLowerCase() !== 'completesave' || !this.trustedSavePaths.has(trustedKey)) {
        throw new Error('La partida debe abrirse desde RoadCraft Studio antes de guardarla.')
      }
      await this.assertGameIsClosed()
      const decoded = decodeCompleteSave(await readFile(filePath))
      const document = applySaveGameChanges(decoded, changes)
      const encoded = encodeCompleteSave(decoded, document)
      decodeCompleteSave(encoded)

      const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
      backupPath = join(dirname(filePath), `CompleteSave.roadcraft-studio-${timestamp}.bak`)
      await copyFile(filePath, backupPath)
      await writeFile(temporaryPath, encoded)
      decodeCompleteSave(await readFile(temporaryPath))
      await rename(temporaryPath, filePath)
      decodeCompleteSave(await readFile(filePath))
      return { ok: true, backupPath }
    } catch (error) {
      if (backupPath && existsSync(backupPath)) {
        try {
          decodeCompleteSave(await readFile(filePath))
        } catch {
          await copyFile(backupPath, filePath)
        }
      }
      return { ok: false, message: error instanceof Error ? error.message : String(error), backupPath }
    } finally {
      if (existsSync(temporaryPath)) await unlink(temporaryPath).catch(() => undefined)
    }
  }

  private async parseBroEntry(filePath: string, broRoot: string, images: string[]): Promise<CatalogItem> {
    const source = await readFile(filePath, 'utf8')
    const id = resolve(filePath)
    const folder = basename(dirname(filePath)).toLowerCase()
    const internalName = this.readStringValue(source, ['chassisInfo'], 'name')
      ?? this.readStringValue(source, [], 'tpl')
      ?? basename(filePath, extname(filePath))
    const rawCategory = this.readStringValue(source, ['uiInfo'], 'uiType') ?? folder
    const kind: ContentKind = /(?:^|_)ai(?:_|$)/i.test(internalName) || folder === 'ai'
      ? 'ai'
      : /trailer|semitruck/i.test(`${folder} ${rawCategory}`)
        ? 'trailer'
        : folder === 'trucks'
          ? 'truck'
          : 'other'
    const specs = kind === 'truck' || kind === 'trailer' || kind === 'ai'
      ? BRO_TRUCK_PARAMETERS
      : []
    const { parameters, specMap } = this.createParameters(source, specs, id)
    const uiName = this.readStringValue(source, ['chassisInfo'], 'uiName')
      ?? this.readStringValue(source, ['uiInfo'], 'uiName')
      ?? this.readStringValue(source, [], 'tpl')
      ?? basename(filePath, extname(filePath))
    const shopIconReference = this.readStringValue(source, ['chassisInfo'], 'uiCustomShopIcon')
      ?? this.readStringValue(source, ['uiInfo'], 'uiCustomIcon')
    const fileStats = await stat(filePath)
    const customImage = this.settings.customImages[id]
    const imagePath = customImage && existsSync(customImage)
      ? customImage
      : this.matchImage(filePath, images, shopIconReference)

    return {
      specs: specMap,
      sourceType: 'bro',
      sourcePath: id,
      entry: {
        id,
        kind,
        sourceType: 'bro',
        name: this.humanize(uiName),
        internalName,
        category: this.humanize(rawCategory.replace('UID_TRUCKS_TYPE_', '')),
        filePath: id,
        relativePath: relative(broRoot, filePath),
        modified: Boolean(this.settings.originalValues[id]),
        modifiedAt: this.settings.editedAt[id] ?? fileStats.mtimeMs,
        imageUrl: imagePath ? pathToFileURL(imagePath).href : undefined,
        imageKind: imagePath
          ? customImage === imagePath ? 'custom' : 'mod'
          : undefined,
        parameters
      }
    }
  }

  private parsePackagedVehicle(
    archived: TextArchiveEntry,
    packagePath: string,
    packagedImages: string[],
    truckLibrary = new Map<string, TruckLibraryRecord>()
  ): CatalogItem {
    const stem = basename(archived.entryName, '.cls')
    const id = `pak:${resolve(packagePath)}::${archived.entryName}`
    const lowerName = stem.toLowerCase()
    const metadata = resolvePackagedVehicleMetadata(stem, truckLibrary)
    const moduleTag = this.readStringValue(archived.content, ['properties', 'prop_tagged'], 'tag') ?? ''
    const rusty = /(?:^|_)old(?:_|$)/i.test(stem) || /RUSTY/i.test(moduleTag)
    const isTrailer = /^UID_MODULE_SEMITRUCK_(?:TRAILER|FUEL)$/i.test(moduleTag)
      || (/wayfarer/i.test(lowerName) && /(?:semi)?trailer|cargo_main/i.test(lowerName))
    const kind: ContentKind = metadata.aiOnly
      ? 'ai'
      : isTrailer
        ? 'trailer'
        : metadata.registered || truckLibrary.size === 0
          ? 'truck'
          : 'other'
    const { parameters, specMap } = this.createParameters(archived.content, PAK_TRUCK_PARAMETERS, id)
    const truckType = this.readStringValue(archived.content, ['properties', 'prop_truck_view'], 'truckType') ?? kind
    const customImage = this.settings.customImages[id]
    const automaticImage = this.settings.automaticImages[id]
    const imagePath = customImage && existsSync(customImage)
      ? customImage
      : automaticImage && existsSync(automaticImage)
        ? automaticImage
        : this.matchPackagedImage(stem, packagedImages, metadata.uiIcon)

    return {
      specs: specMap,
      sourceType: 'pak',
      sourcePath: resolve(packagePath),
      archiveEntryName: archived.entryName,
      entry: {
        id,
        kind,
        sourceType: 'pak',
        name: this.humanize(stem.replace(/^auto_(?:base_)?/, '')),
        internalName: stem,
        category: this.humanize(moduleTag.replace(/^UID_MODULE_/, '') || truckType),
        filePath: resolve(packagePath),
        relativePath: `default_other.pak › ${archived.entryName}`,
        modified: Boolean(this.settings.originalValues[id]),
        modifiedAt: this.settings.editedAt[id] ?? archived.modifiedAt,
        imageUrl: imagePath ? pathToFileURL(imagePath).href : undefined,
        imageKind: imagePath
          ? customImage === imagePath
            ? 'custom'
            : this.isDirectShopImage(stem, imagePath) ? 'shop' : 'related'
          : undefined,
        parameters,
        mobility: previewMobility(archived.content),
        access: {
          control: metadata.aiOnly ? 'ai' : metadata.registered ? 'player' : 'unknown',
          variant: rusty ? 'rusty' : 'standard',
          obtain: metadata.aiOnly ? 'unknown' : rusty
            || metadata.buyCost === -1 ? 'scenario' : metadata.buyCost !== undefined && metadata.buyCost >= 0 ? 'shop' : 'unknown',
          buyCost: metadata.buyCost, rankToUnlock: metadata.rankToUnlock
        }
      }
    }
  }

  private createParameters(source: string, specs: ParameterSpec[], itemId: string) {
    const parameters: EditableParameter[] = []
    const specMap = new Map<string, ParameterSpec>()
    const storedOriginals = this.settings.originalValues[itemId] ?? {}

    for (const spec of specs) {
      const kind = spec.kind ?? 'number'
      const current = this.readParameterValue(source, spec)
      if (current === undefined) continue

      const original = storedOriginals[spec.id] ?? current
      const parameter: EditableParameter = {
        id: spec.id,
        labelKey: spec.labelKey,
        groupKey: spec.groupKey,
        kind,
        value: current,
        original,
        unit: spec.unit,
        options: spec.options
      }

      if (typeof original === 'number' && spec.factors && spec.safeFactors) {
        const [minimum, maximum] = spec.absoluteRange
          ?? [Math.min(...spec.safeFactors.map(factor => original * factor)), Math.max(...spec.safeFactors.map(factor => original * factor))]
        const recommendations = spec.factors.map(factor => (
          this.roundFor(original, Math.min(maximum, Math.max(minimum, original * factor)))
        )) as [number, number, number]
        parameter.minimum = minimum
        parameter.maximum = maximum
        parameter.recommended = {
          low: recommendations[0],
          medium: recommendations[1],
          high: recommendations[2]
        }
      }

      parameters.push(parameter)
      specMap.set(spec.id, spec)
    }

    return { parameters, specMap }
  }

  private async readItemSource(item: CatalogItem) {
    if (item.sourceType === 'bro') return readFile(item.sourcePath, 'utf8')
    if (!item.archiveEntryName) throw new Error('El vehículo no tiene una ruta interna válida.')

    const entries = await readMatchingTextEntries(item.sourcePath, name => name === item.archiveEntryName)
    if (entries.length !== 1) throw new Error('No se encontró el vehículo dentro de default_other.pak.')
    return entries[0].content
  }

  private async writeItemSource(item: CatalogItem, source: string) {
    if (item.sourceType === 'bro') {
      await this.createBroBackup(item.sourcePath)
      await writeFile(item.sourcePath, source, 'utf8')
      return
    }

    if (!item.archiveEntryName) throw new Error('El vehículo no tiene una ruta interna válida.')
    await this.assertGameIsClosed()
    await this.ensurePackageBackup(item.sourcePath)
    await replaceTextEntry(item.sourcePath, item.archiveEntryName, source)
    await this.invalidatePackageCache(item.sourcePath)

    const packageState = this.settings.packageBackups[item.sourcePath]
    if (packageState) packageState.lastWrittenSignature = await this.fileSignature(item.sourcePath)
  }

  private readParameterValue(source: string, spec: ParameterSpec): ParameterValue | undefined {
    const range = this.findNestedRange(source, spec.path)
    if (range.end <= range.start) return

    const segment = source.slice(range.start, range.end)
    const field = this.escapeRegExp(spec.field)
    const kind = spec.kind ?? 'number'

    if (kind === 'number') {
      const match = new RegExp(`(?:^|\\n)\\s*${field}\\s*=\\s*([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)`, 'm').exec(segment)
      return match ? Number(match[1]) * (spec.displayScale ?? 1) : undefined
    }

    if (kind === 'boolean') {
      const match = new RegExp(`(?:^|\\n)\\s*${field}\\s*=\\s*(true|false)`, 'mi').exec(segment)
      return match ? match[1].toLowerCase() === 'true' : undefined
    }

    const match = new RegExp(`(?:^|\\n)\\s*${field}\\s*=\\s*(?:"([^"]*)"|([A-Z][A-Z0-9_]*))`, 'm').exec(segment)
    return match?.[1] ?? match?.[2]
  }

  private readStringValue(source: string, path: string[], field: string) {
    const range = this.findNestedRange(source, path)
    const segment = source.slice(range.start, range.end)
    const match = new RegExp(`(?:^|\\n)\\s*${this.escapeRegExp(field)}\\s*=\\s*"([^"]*)"`, 'm').exec(segment)
    return match?.[1]
  }

  private replaceParameterValue(source: string, spec: ParameterSpec, value: ParameterValue) {
    const range = this.findNestedRange(source, spec.path)
    const segment = source.slice(range.start, range.end)
    const kind = spec.kind ?? 'number'
    const rawValuePattern = kind === 'number'
      ? '[-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?'
      : kind === 'boolean'
        ? '(?:true|false)'
        : '(?:"[^"]*"|[A-Z][A-Z0-9_]*)'
    const pattern = new RegExp(`(^|\\n)(\\s*${this.escapeRegExp(spec.field)}\\s*=\\s*)(${rawValuePattern})`, kind === 'boolean' ? 'mi' : 'm')
    if (!pattern.test(segment)) throw new Error(`No se encontró el parámetro ${spec.field}.`)

    const currentRaw = pattern.exec(segment)?.[3] ?? ''
    const storedValue = kind === 'number' && typeof value === 'number'
      ? value / (spec.displayScale ?? 1)
      : value
    const replacement = kind === 'select' && /^"/.test(currentRaw)
      ? `"${value}"`
      : kind === 'boolean' && /^[A-Z]/.test(currentRaw)
        ? value ? 'True' : 'False'
        : String(storedValue)

    const updated = segment.replace(pattern, (_match, lineStart: string, prefix: string) => `${lineStart}${prefix}${replacement}`)
    return source.slice(0, range.start) + updated + source.slice(range.end)
  }

  private replaceLinkedParameterValues(source: string, spec: ParameterSpec, value: ParameterValue) {
    for (const path of spec.linkedPaths ?? []) {
      const linkedSpec: ParameterSpec = { ...spec, path, linkedPaths: undefined }
      if (this.readParameterValue(source, linkedSpec) !== undefined) {
        source = this.replaceParameterValue(source, linkedSpec, value)
      }
    }
    for (const linked of spec.linkedParameters ?? []) {
      const linkedSpec: ParameterSpec = {
        ...spec,
        path: linked.path,
        field: linked.field,
        linkedPaths: undefined,
        linkedParameters: undefined
      }
      if (this.readParameterValue(source, linkedSpec) !== undefined) {
        source = this.replaceParameterValue(source, linkedSpec, value)
      }
    }
    return source
  }

  private isValidParameterValue(spec: ParameterSpec, value: ParameterValue) {
    const kind = spec.kind ?? 'number'
    if (kind === 'number') return typeof value === 'number' && Number.isFinite(value)
    if (kind === 'boolean') return typeof value === 'boolean'
    return typeof value === 'string' && Boolean(spec.options?.some(option => option.value === value))
  }

  private findNestedRange(source: string, path: string[]) {
    let start = 0
    let end = source.length

    for (const key of path) {
      const segment = source.slice(start, end)
      const pattern = new RegExp(`(?:^|\\n)\\s*${this.escapeRegExp(key)}\\s*=\\s*\\{`, 'mi')
      const match = pattern.exec(segment)
      if (!match) return { start: 0, end: 0 }

      const open = start + match.index + match[0].lastIndexOf('{')
      const close = this.findClosingBrace(source, open)
      start = open + 1
      end = close
    }

    return { start, end }
  }

  private findClosingBrace(source: string, open: number) {
    let depth = 0
    let quote = false

    for (let index = open; index < source.length; index++) {
      const char = source[index]
      if (char === '"' && source[index - 1] !== '\\') quote = !quote
      if (quote) continue
      if (char === '{') depth++
      if (char === '}') depth--
      if (depth === 0) return index
    }

    return source.length
  }

  private async createBroBackup(filePath: string) {
    const date = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
    const relativePath = relative(join(this.settings.installPath, 'root', 'mods_source'), filePath)
    const target = join(this.backupsRoot, 'source', date, relativePath)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(filePath, target)
  }

  private async ensurePackageBackup(packagePath: string) {
    const signature = await this.fileSignature(packagePath)
    const existing = this.settings.packageBackups[packagePath]
    const packageWasExternallyChanged = existing
      && signature !== existing.lastWrittenSignature
      && signature !== existing.originalSignature

    if (existing && existsSync(existing.backupPath) && !packageWasExternallyChanged) return

    const backupDirectory = join(this.backupsRoot, 'packages')
    const backupPath = join(backupDirectory, `${basename(packagePath)}.${signature.replace(':', '-')}.bak`)
    await mkdir(backupDirectory, { recursive: true })
    if (!existsSync(backupPath)) await copyFile(packagePath, backupPath)

    const cachePath = `${packagePath}.cache`
    if (existsSync(cachePath)) {
      const cacheBackup = `${backupPath}.cache`
      if (!existsSync(cacheBackup)) await copyFile(cachePath, cacheBackup)
    }

    this.settings.packageBackups[packagePath] = {
      backupPath,
      originalSignature: signature,
      lastWrittenSignature: signature
    }
  }

  private async invalidatePackageCache(packagePath: string) {
    const cachePath = `${packagePath}.cache`
    if (existsSync(cachePath)) await unlink(cachePath)
  }

  private async assertGameIsClosed() {
    if (process.platform !== 'win32') return
    const { stdout } = await execFileAsync('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      windowsHide: true,
      encoding: 'utf8'
    })
    if (/"(?:RoadCraft(?: - Retail)?|RoadCraft-Win64-Shipping)\.exe"/i.test(stdout)) {
      throw new Error('Cierra RoadCraft antes de guardar cambios.')
    }
  }

  private async findCompleteSaveFiles(root: string, remainingDepth: number): Promise<string[]> {
    if (remainingDepth < 0 || !existsSync(root)) return []
    const files: string[] = []
    let entries
    try {
      entries = await readdir(root, { withFileTypes: true })
    } catch {
      return []
    }
    for (const entry of entries) {
      const fullPath = join(root, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === 'completesave') files.push(fullPath)
      else if (entry.isDirectory()) files.push(...await this.findCompleteSaveFiles(fullPath, remainingDepth - 1))
    }
    return files
  }

  private async fileSignature(filePath: string) {
    const fileStats = await stat(filePath)
    return `${fileStats.size}:${Math.trunc(fileStats.mtimeMs)}`
  }

  private async persistSettings() {
    await mkdir(dirname(this.settingsPath), { recursive: true })
    await writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8')
  }

  private normalizeInstallPath(selected: string) {
    const candidates = [selected, join(selected, 'RoadCraft')]
    return candidates.find(candidate => this.isInstallPath(candidate))
  }

  private isInstallPath(path: string) {
    return existsSync(join(path, 'root', 'mods_source', 'bro'))
      && existsSync(join(path, 'mod_editor_release.bat'))
  }

  private isTrustedItem(item: CatalogItem) {
    if (item.sourceType === 'bro') return this.isInsideSource(item.sourcePath)
    return resolve(item.sourcePath) === resolve(this.getBasePackagePath())
      && Boolean(item.archiveEntryName && BASE_VEHICLE_PATTERN.test(item.archiveEntryName))
  }

  private isInsideSource(filePath: string) {
    const root = resolve(this.settings.installPath, 'root', 'mods_source', 'bro')
    const target = resolve(filePath)
    return target === root || target.startsWith(`${root}${sep}`)
  }

  private getBasePackagePath() {
    return join(this.settings.installPath, 'root', 'paks', 'client', 'default', 'default_other.pak')
  }

  private async walkFiles(root: string, extensions: Set<string>): Promise<string[]> {
    if (!existsSync(root)) return []
    const result: string[] = []

    for (const entry of await readdir(root, { withFileTypes: true })) {
      const fullPath = join(root, entry.name)
      if (entry.isDirectory()) result.push(...await this.walkFiles(fullPath, extensions))
      else if (extensions.has(extname(entry.name).toLowerCase())) result.push(fullPath)
    }

    return result
  }

  private matchImage(filePath: string, images: string[], reference?: string) {
    const stem = this.normalizeImageKey(basename(filePath, extname(filePath)))
    const referenceKey = reference
      ? this.normalizeImageKey(basename(reference, extname(reference)))
      : ''

    return images
      .map(image => {
        const key = this.normalizeImageKey(basename(image, extname(image)))
        const score = referenceKey && key === referenceKey
          ? 0
          : key === stem
            ? 1
            : referenceKey && key.includes(referenceKey)
              ? 2
              : key.includes(stem)
                ? 3
                : Number.POSITIVE_INFINITY
        return { image, score }
      })
      .filter(candidate => Number.isFinite(candidate.score))
      .sort((a, b) => a.score - b.score)[0]?.image
  }

  private async findPackagedVehicleImages(
    vehicles: TextArchiveEntry[],
    truckLibrary: Map<string, TruckLibraryRecord>
  ) {
    const cacheRoot = join(app.getPath('userData'), 'vehicle-images')
    const packageRoot = join(this.settings.installPath, 'root', 'paks', 'client')
    const packageCandidates = (await this.walkFiles(packageRoot, new Set(['.pak'])))
      .filter(packagePath => /^default_pct_\d+\.pak$/i.test(basename(packagePath)))
    const packageByName = new Map<string, string>()
    for (const packagePath of packageCandidates) {
      const key = basename(packagePath).toLowerCase()
      const current = packageByName.get(key)
      if (!current || relative(packageRoot, packagePath).split(sep).length < relative(packageRoot, current).split(sep).length) {
        packageByName.set(key, packagePath)
      }
    }
    const packages = [...packageByName.values()]
    const resourcesPath = join(packageRoot, 'resources.pak')
    const signatureParts: string[] = []

    for (const packagePath of packages) {
      const packageStats = await stat(packagePath)
      signatureParts.push(`${relative(packageRoot, packagePath)}:${packageStats.size}:${Math.trunc(packageStats.mtimeMs)}`)
    }
    if (existsSync(resourcesPath)) {
      const resourcesStats = await stat(resourcesPath)
      signatureParts.push(`resources.pak:${resourcesStats.size}:${Math.trunc(resourcesStats.mtimeMs)}`)
    }

    const signature = createHash('sha256')
      .update(`vehicle-textures-v5-official-icons|${signatureParts.sort().join('|')}`)
      .digest('hex')
    const cachedImages = await this.walkFiles(cacheRoot, COMPATIBLE_IMAGE_EXTENSIONS)

    if (signature && signature !== this.settings.imagePackageSignature) {
      const vehicleKeys = vehicles.map(vehicle => (
        this.normalizeImageKey(basename(vehicle.entryName, '.cls'))
      ))
      const textureDescriptors = await this.readVehicleTextureDescriptors(resourcesPath)
      await mkdir(cacheRoot, { recursive: true })

      for (const packagePath of packages) {
        let images
        try {
          images = await readMatchingBinaryEntries(packagePath, entryName => {
            const extension = extname(entryName).toLowerCase()
            if (extension !== '.pct_mip' && !COMPATIBLE_IMAGE_EXTENSIONS.has(extension)) return false
            if (extension === '.pct_mip' && !/_0\.pct_mip$/i.test(entryName)) return false

            const textureName = basename(entryName, extension).replace(/_0$/i, '')
            const key = this.normalizeImageKey(textureName)
            const isRegisteredIcon = /package_ui_vehicles_icons/i.test(entryName)
            const isMatchingShopImage = /ui_shop_/i.test(entryName)
              && vehicleKeys.some(vehicleKey => key.includes(vehicleKey) || vehicleKey.includes(key))
            return isRegisteredIcon || isMatchingShopImage
          })
        } catch {
          // Algunos paquetes del juego no son ZIP estándar. Se omiten sin
          // impedir que el catálogo y los paquetes compatibles se analicen.
          continue
        }

        for (const image of images) {
          const extension = extname(image.entryName).toLowerCase()
          const key = basename(image.entryName, extension)
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
          const digest = createHash('sha1').update(image.entryName).digest('hex').slice(0, 10)
          const target = join(cacheRoot, `${key}-${digest}.${extension === '.pct_mip' ? 'png' : extension.slice(1)}`)
          if (extension === '.pct_mip') {
            const textureName = basename(image.entryName, extension).replace(/_0$/i, '').toLowerCase()
            const descriptor = textureDescriptors.get(textureName)
            const png = descriptor
              ? decodeRoadCraftTexture(image.content, descriptor.width, descriptor.height)
              : /ui_shop_/i.test(image.entryName)
                ? decodeRoadCraftShopTexture(image.content)
                : undefined
            if (png) await writeFile(target, png)
          } else if (!existsSync(target) && this.hasSupportedImageSignature(image.content, extension)) {
            await writeFile(target, image.content)
          }
        }
      }

      const allImages = await this.walkFiles(cacheRoot, COMPATIBLE_IMAGE_EXTENSIONS)
      for (const vehicle of vehicles) {
        const stem = basename(vehicle.entryName, '.cls')
        const id = `pak:${resolve(this.getBasePackagePath())}::${vehicle.entryName}`
        const metadata = resolvePackagedVehicleMetadata(stem, truckLibrary)
        const match = this.matchPackagedImage(stem, allImages, metadata.uiIcon)
        if (match) this.settings.automaticImages[id] = match
      }

      this.settings.imagePackageSignature = signature
      await this.persistSettings()
      return allImages
    }

    return cachedImages
  }

  private async readVehicleTextureDescriptors(resourcesPath: string) {
    const descriptors = new Map<string, TextureDescriptor>()
    if (!existsSync(resourcesPath)) return descriptors

    let resources: TextArchiveEntry[]
    try {
      resources = await readMatchingTextEntries(resourcesPath, entryName => (
        /package_ui_(?:vehicles_icons|garage)/i.test(entryName)
        && /\.pct\.resource$/i.test(entryName)
      ))
    } catch {
      return descriptors
    }

    for (const resource of resources) {
      const width = Number(/^\s*sx:\s*(\d+)\s*$/mi.exec(resource.content)?.[1])
      const height = Number(/^\s*sy:\s*(\d+)\s*$/mi.exec(resource.content)?.[1])
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) continue
      descriptors.set(basename(resource.entryName, '.pct.resource').toLowerCase(), { width, height })
    }

    return descriptors
  }

  private matchPackagedImage(stem: string, images: string[], iconReference?: string) {
    stem = stem.replace(/^auto_base_/i, 'auto_')
    const vehicleKey = this.normalizeImageKey(stem)
    const vehicleTokens = this.imageTokens(stem)
    const preferredImage = iconReference ?? PACKAGED_IMAGE_ALIASES[stem.toLowerCase()]
    const iconKey = preferredImage ? this.normalizeImageKey(preferredImage) : ''
    const isTrailer = /(?:^|_)(?:semi)?trailer(?:_|$)/i.test(stem)
    return images
      .map(image => {
        const imageKey = this.normalizeImageKey(basename(image, extname(image)))
        const imageTokens = this.imageTokens(basename(image, extname(image)))
        const sameFamily = vehicleTokens.length >= 2
          && imageTokens.length >= 2
          && vehicleTokens[0] === imageTokens[0]
          && vehicleTokens[1] === imageTokens[1]
        const score = iconKey && imageKey === iconKey
          ? 0
          : imageKey === vehicleKey
            ? 1
            : imageKey.includes(vehicleKey)
              ? imageKey.length - vehicleKey.length + 2
              : vehicleKey.includes(imageKey)
                ? vehicleKey.length - imageKey.length + 21
                : !isTrailer && sameFamily
                  ? 100 + Math.abs(vehicleTokens.length - imageTokens.length)
                  : Number.POSITIVE_INFINITY
        return { image, score }
      })
      .filter(candidate => Number.isFinite(candidate.score))
      .sort((a, b) => a.score - b.score)[0]?.image
  }

  private normalizeImageKey(value: string) {
    return value
      .toLowerCase()
      .replace(/_\d+(?:-[a-f0-9]{10})?$/, '')
      .replace(/^ui_(?:shop|veh|vehicle)_/, '')
      .replace(/^auto_/, '')
      .replace(/_(?:new|shop|icon)$/, '')
      .replace(/[^a-z0-9]/g, '')
  }

  private imageTokens(value: string) {
    return value
      .toLowerCase()
      .replace(/^ui_(?:shop|veh|vehicle)_/, '')
      .replace(/^auto_/, '')
      .replace(/_\d+(?:-[a-f0-9]{10})?$/, '')
      .split(/[^a-z0-9]+/)
      .filter(token => token && !['old', 'new', 'res', 'alt'].includes(token))
  }

  private isDirectShopImage(stem: string, imagePath: string) {
    const vehicleKey = this.normalizeImageKey(stem)
    const imageKey = this.normalizeImageKey(basename(imagePath, extname(imagePath)))
    return imageKey.includes(vehicleKey) || vehicleKey.includes(imageKey)
  }

  private hasSupportedImageSignature(content: Buffer, extension: string) {
    if (extension === '.png') return content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    if (extension === '.jpg' || extension === '.jpeg') return content[0] === 0xff && content[1] === 0xd8
    if (extension === '.webp') return content.toString('ascii', 0, 4) === 'RIFF' && content.toString('ascii', 8, 12) === 'WEBP'
    return false
  }

  private humanize(value: string) {
    return value
      .replace(/^UID_/, '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\p{L}/gu, letter => letter.toUpperCase())
  }

  private roundFor(original: number, value: number) {
    return Number.isInteger(original) ? Math.round(value) : Number(value.toFixed(4))
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
