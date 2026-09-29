import { app, dialog, nativeImage, shell } from 'electron'
import { copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import type { ContentEntry, ContentKind, EditableParameter, OperationResult, ParameterKind, ParameterValue, SaveGameChanges, SaveGameData, SavePayload, SaveSlotSummary, ScanResult } from '../shared'
import { applySaveGameChanges, createSaveGameData, decodeCompleteSave, encodeCompleteSave } from './save-game'
import { readMatchingBinaryEntries, readMatchingTextEntries, replaceTextEntry, type TextArchiveEntry } from './zip-package'

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

interface ParameterSpec {
  id: string
  path: string[]
  field: string
  labelKey: string
  groupKey: string
  kind?: ParameterKind
  unit?: string
  factors?: [number, number, number]
  safeFactors?: [number, number]
  options?: Array<{ value: string; labelKey: string }>
}

interface CatalogItem {
  entry: ContentEntry
  specs: Map<string, ParameterSpec>
  sourceType: 'bro' | 'pak'
  sourcePath: string
  archiveEntryName?: string
}

const DEFAULT_INSTALL_PATH = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft'
const BASE_VEHICLE_PATTERN = /^ssl\/autogen_designer_wizard\/trucks\/([^/]+)\/\1\.cls$/i
const COMPATIBLE_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const execFileAsync = promisify(execFile)

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

const PAK_TRUCK_PARAMETERS: ParameterSpec[] = [
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
    labelKey: 'dozerWidth', groupKey: 'workEquipment', factors: [1.03, 1.06, 1.1], safeFactors: [0.9, 1.12]
  },
  {
    id: 'rollerWidth', path: ['properties', 'prop_truck_asphalt_roller', 'asphaltRoller', 'size'], field: 'x',
    labelKey: 'rollerWidth', groupKey: 'workEquipment', factors: [1.03, 1.06, 1.1], safeFactors: [0.9, 1.12]
  },
  {
    id: 'paverWidth', path: ['properties', 'prop_truck_asphalter', 'asphalter', 'size'], field: 'x',
    labelKey: 'paverWidth', groupKey: 'workEquipment', factors: [1.03, 1.06, 1.1], safeFactors: [0.9, 1.12]
  }
]

const WHEEL_PARAMETERS: ParameterSpec[] = [
  {
    id: 'wheelMass', path: ['truckWheel'], field: 'mass',
    labelKey: 'wheelMass', groupKey: 'wheelGeometry', unit: 'kg', factors: [1.02, 1.05, 1.1], safeFactors: [0.8, 1.15]
  },
  {
    id: 'wheelRadius', path: ['truckWheel'], field: 'radius',
    labelKey: 'wheelRadius', groupKey: 'wheelGeometry', unit: 'm', factors: [1.02, 1.04, 1.06], safeFactors: [0.94, 1.06]
  },
  {
    id: 'wheelWidth', path: ['truckWheel'], field: 'width',
    labelKey: 'wheelWidth', groupKey: 'wheelGeometry', unit: 'm', factors: [1.02, 1.04, 1.06], safeFactors: [0.94, 1.06]
  },
  {
    id: 'wheelRadiusOffset', path: ['truckWheel'], field: 'radiusOffset',
    labelKey: 'wheelRadiusOffset', groupKey: 'wheelGeometry', unit: 'm', factors: [1.01, 1.02, 1.03], safeFactors: [0.97, 1.03]
  },
  {
    id: 'rimRadius', path: ['truckWheel'], field: 'rimRadius',
    labelKey: 'rimRadius', groupKey: 'wheelGeometry', unit: 'm', factors: [1.01, 1.02, 1.03], safeFactors: [0.97, 1.03]
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
      locale: this.settings.locale
    }
  }

  async setLocale(locale: string) {
    this.settings.locale = locale
    await this.persistSettings()
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
    const broFiles = await this.walkFiles(broRoot, new Set(['.bro']))
    const compatibleImages = await this.walkFiles(sourceRoot, COMPATIBLE_IMAGE_EXTENSIONS)
    const modDefinitions = await this.walkFiles(sourceRoot, new Set(['.mod']))
    const packagedVehicles = existsSync(basePackage)
      ? await readMatchingTextEntries(basePackage, entryName => BASE_VEHICLE_PATTERN.test(entryName))
      : []
    const packagedImages = await this.findPackagedVehicleImages(packagedVehicles)
    const entries: ContentEntry[] = []

    this.catalog.clear()

    for (const filePath of broFiles) {
      const parsed = await this.parseBroEntry(filePath, broRoot, compatibleImages)
      entries.push(parsed.entry)
      this.catalog.set(parsed.entry.id, parsed)
    }

    for (const archivedVehicle of packagedVehicles) {
      const parsed = this.parsePackagedVehicle(archivedVehicle, basePackage, packagedImages)
      entries.push(parsed.entry)
      this.catalog.set(parsed.entry.id, parsed)
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

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
        if (spec) source = this.replaceParameterValue(source, spec, originalValue)
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
    const kind: ContentKind = folder === 'trucks' ? 'truck' : folder === 'wheels' ? 'wheel' : 'other'
    const specs = kind === 'truck' ? BRO_TRUCK_PARAMETERS : kind === 'wheel' ? WHEEL_PARAMETERS : []
    const { parameters, specMap } = this.createParameters(source, specs, id)
    const uiName = this.readStringValue(source, ['chassisInfo'], 'uiName')
      ?? this.readStringValue(source, ['uiInfo'], 'uiName')
      ?? this.readStringValue(source, [], 'tpl')
      ?? basename(filePath, extname(filePath))
    const internalName = this.readStringValue(source, ['chassisInfo'], 'name')
      ?? this.readStringValue(source, [], 'tpl')
      ?? basename(filePath, extname(filePath))
    const rawCategory = this.readStringValue(source, ['uiInfo'], 'uiType') ?? kind
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

  private parsePackagedVehicle(archived: TextArchiveEntry, packagePath: string, packagedImages: string[]): CatalogItem {
    const stem = basename(archived.entryName, '.cls')
    const id = `pak:${resolve(packagePath)}::${archived.entryName}`
    const lowerName = stem.toLowerCase()
    const kind: ContentKind = /(?:^|_)(?:semi)?trailer(?:_|$)/i.test(lowerName) ? 'trailer' : 'truck'
    const { parameters, specMap } = this.createParameters(archived.content, PAK_TRUCK_PARAMETERS, id)
    const truckType = this.readStringValue(archived.content, ['properties', 'prop_truck_view'], 'truckType') ?? kind
    const customImage = this.settings.customImages[id]
    const automaticImage = this.settings.automaticImages[id]
    const imagePath = customImage && existsSync(customImage)
      ? customImage
      : automaticImage && existsSync(automaticImage)
        ? automaticImage
        : this.matchPackagedImage(stem, packagedImages)

    return {
      specs: specMap,
      sourceType: 'pak',
      sourcePath: resolve(packagePath),
      archiveEntryName: archived.entryName,
      entry: {
        id,
        kind,
        sourceType: 'pak',
        name: this.humanize(stem.replace(/^auto_/, '')),
        internalName: stem,
        category: this.humanize(truckType),
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
        parameters
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
        const recommendations = spec.factors.map(factor => this.roundFor(original, original * factor)) as [number, number, number]
        const safeValues = spec.safeFactors.map(factor => original * factor)
        parameter.minimum = Math.min(...safeValues)
        parameter.maximum = Math.max(...safeValues)
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
      return match ? Number(match[1]) : undefined
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
    const replacement = kind === 'select' && /^"/.test(currentRaw)
      ? `"${value}"`
      : kind === 'boolean' && /^[A-Z]/.test(currentRaw)
        ? value ? 'True' : 'False'
        : String(value)

    const updated = segment.replace(pattern, (_match, lineStart: string, prefix: string) => `${lineStart}${prefix}${replacement}`)
    return source.slice(0, range.start) + updated + source.slice(range.end)
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

  private async findPackagedVehicleImages(vehicles: TextArchiveEntry[]) {
    const cacheRoot = join(app.getPath('userData'), 'vehicle-images')
    const packageRoot = join(this.settings.installPath, 'root', 'paks', 'client')
    const packages = (await this.walkFiles(packageRoot, new Set(['.pak'])))
      .filter(packagePath => /^default_pct_\d+\.pak$/i.test(basename(packagePath)))
    const signatureParts: string[] = []

    for (const packagePath of packages) {
      const packageStats = await stat(packagePath)
      signatureParts.push(`${relative(packageRoot, packagePath)}:${packageStats.size}:${Math.trunc(packageStats.mtimeMs)}`)
    }

    const signature = createHash('sha256')
      .update(`shop-textures-v2|${signatureParts.sort().join('|')}`)
      .digest('hex')
    const cachedImages = await this.walkFiles(cacheRoot, COMPATIBLE_IMAGE_EXTENSIONS)

    if (signature && signature !== this.settings.imagePackageSignature) {
      const vehicleKeys = vehicles.map(vehicle => (
        this.normalizeImageKey(basename(vehicle.entryName, '.cls'))
      ))
      await mkdir(cacheRoot, { recursive: true })

      for (const packagePath of packages) {
        let images
        try {
          images = await readMatchingBinaryEntries(packagePath, entryName => {
            const extension = extname(entryName).toLowerCase()
            if (extension !== '.pct_mip' && !COMPATIBLE_IMAGE_EXTENSIONS.has(extension)) return false

            const key = this.normalizeImageKey(basename(entryName, extension))
            return /ui_shop_/i.test(entryName)
              && vehicleKeys.some(vehicleKey => key.includes(vehicleKey) || vehicleKey.includes(key))
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
          if (existsSync(target)) continue

          if (extension === '.pct_mip') {
            const png = this.decodeShopTexture(image.content)
            if (png) await writeFile(target, png)
          } else if (this.hasSupportedImageSignature(image.content, extension)) {
            await writeFile(target, image.content)
          }
        }
      }

      const allImages = await this.walkFiles(cacheRoot, COMPATIBLE_IMAGE_EXTENSIONS)
      for (const vehicle of vehicles) {
        const stem = basename(vehicle.entryName, '.cls')
        const id = `pak:${resolve(this.getBasePackagePath())}::${vehicle.entryName}`
        const match = this.matchPackagedImage(stem, allImages)
        if (match) this.settings.automaticImages[id] = match
      }

      this.settings.imagePackageSignature = signature
      await this.persistSettings()
      return allImages
    }

    return cachedImages
  }

  private matchPackagedImage(stem: string, images: string[]) {
    const vehicleKey = this.normalizeImageKey(stem)
    const vehicleTokens = this.imageTokens(stem)
    const isTrailer = /(?:^|_)(?:semi)?trailer(?:_|$)/i.test(stem)
    return images
      .map(image => {
        const imageKey = this.normalizeImageKey(basename(image, extname(image)))
        const imageTokens = this.imageTokens(basename(image, extname(image)))
        const sameFamily = vehicleTokens.length >= 2
          && imageTokens.length >= 2
          && vehicleTokens[0] === imageTokens[0]
          && vehicleTokens[1] === imageTokens[1]
        const score = imageKey === vehicleKey
          ? 0
          : imageKey.includes(vehicleKey)
            ? imageKey.length - vehicleKey.length + 1
            : vehicleKey.includes(imageKey)
              ? vehicleKey.length - imageKey.length + 20
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

  private decodeShopTexture(content: Buffer) {
    const width = 368
    const height = 308
    const blockCount = Math.ceil(width / 4) * Math.ceil(height / 4)
    const format = content.length === blockCount * 8
      ? 'bc1'
      : content.length === blockCount * 16
        ? 'bc3'
        : undefined
    if (!format) return

    const rgba = Buffer.alloc(width * height * 4)
    const bytesPerBlock = format === 'bc1' ? 8 : 16
    const blocksWide = Math.ceil(width / 4)
    const blocksHigh = Math.ceil(height / 4)

    for (let blockY = 0; blockY < blocksHigh; blockY++) {
      for (let blockX = 0; blockX < blocksWide; blockX++) {
        const offset = (blockY * blocksWide + blockX) * bytesPerBlock
        const alpha = format === 'bc3'
          ? this.decodeBc3Alpha(content, offset)
          : undefined
        const colorOffset = offset + (format === 'bc3' ? 8 : 0)
        const colors = this.decodeBcColors(content, colorOffset, format === 'bc1')
        const colorBits = content.readUInt32LE(colorOffset + 4)

        for (let pixel = 0; pixel < 16; pixel++) {
          const x = blockX * 4 + (pixel % 4)
          const y = blockY * 4 + Math.floor(pixel / 4)
          if (x >= width || y >= height) continue

          const color = colors[(colorBits >>> (pixel * 2)) & 0x3]
          const target = (y * width + x) * 4
          rgba[target] = color[0]
          rgba[target + 1] = color[1]
          rgba[target + 2] = color[2]
          rgba[target + 3] = alpha?.[pixel] ?? color[3]
        }
      }
    }

    // Electron recibe los mapas de bits en orden BGRA en Windows.
    for (let index = 0; index < rgba.length; index += 4) {
      const red = rgba[index]
      rgba[index] = rgba[index + 2]
      rgba[index + 2] = red
    }
    return nativeImage.createFromBitmap(rgba, { width, height }).toPNG()
  }

  private decodeBcColors(content: Buffer, offset: number, allowTransparent: boolean) {
    const color0 = content.readUInt16LE(offset)
    const color1 = content.readUInt16LE(offset + 2)
    const first = this.rgb565(color0)
    const second = this.rgb565(color1)
    const colors: Array<[number, number, number, number]> = [
      [...first, 255],
      [...second, 255],
      [0, 0, 0, 255],
      [0, 0, 0, 255]
    ]

    if (color0 > color1 || !allowTransparent) {
      colors[2] = first.map((value, index) => Math.round((2 * value + second[index]) / 3)).concat(255) as [number, number, number, number]
      colors[3] = first.map((value, index) => Math.round((value + 2 * second[index]) / 3)).concat(255) as [number, number, number, number]
    } else {
      colors[2] = first.map((value, index) => Math.round((value + second[index]) / 2)).concat(255) as [number, number, number, number]
      colors[3] = [0, 0, 0, 0]
    }
    return colors
  }

  private decodeBc3Alpha(content: Buffer, offset: number) {
    const alpha0 = content[offset]
    const alpha1 = content[offset + 1]
    const table = [alpha0, alpha1, 0, 0, 0, 0, 0, 0]

    if (alpha0 > alpha1) {
      for (let index = 1; index <= 6; index++) {
        table[index + 1] = Math.round(((7 - index) * alpha0 + index * alpha1) / 7)
      }
    } else {
      for (let index = 1; index <= 4; index++) {
        table[index + 1] = Math.round(((5 - index) * alpha0 + index * alpha1) / 5)
      }
      table[6] = 0
      table[7] = 255
    }

    let bits = 0n
    for (let index = 0; index < 6; index++) {
      bits |= BigInt(content[offset + 2 + index]) << BigInt(index * 8)
    }
    return Array.from({ length: 16 }, (_, index) => table[Number((bits >> BigInt(index * 3)) & 0x7n)])
  }

  private rgb565(value: number): [number, number, number] {
    const red = (value >> 11) & 0x1f
    const green = (value >> 5) & 0x3f
    const blue = value & 0x1f
    return [
      Math.round(red * 255 / 31),
      Math.round(green * 255 / 63),
      Math.round(blue * 255 / 31)
    ]
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
