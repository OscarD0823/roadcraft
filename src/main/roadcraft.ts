import { app, dialog, shell } from 'electron'
import { copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { ContentEntry, ContentKind, EditableParameter, OperationResult, SavePayload, ScanResult } from '../shared'
import { readMatchingTextEntries, replaceTextEntry, type TextArchiveEntry } from './zip-package'

interface PackageBackupState {
  backupPath: string
  originalSignature: string
  lastWrittenSignature: string
}

interface StudioSettings {
  installPath: string
  locale: string
  customImages: Record<string, string>
  originalValues: Record<string, Record<string, number>>
  editedAt: Record<string, number>
  packageBackups: Record<string, PackageBackupState>
}

interface ParameterSpec {
  id: string
  path: string[]
  field: string
  labelKey: string
  groupKey: string
  unit?: string
  factors: [number, number, number]
  safeFactors: [number, number]
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
    id: 'sideFriction', path: ['truckWheel'], field: 'sidewaysFrictionMultiplier',
    labelKey: 'sideFriction', groupKey: 'traction', factors: [1.04, 1.08, 1.12], safeFactors: [0.8, 1.15]
  },
  {
    id: 'softForce', path: ['truckWheel'], field: 'softForceScale',
    labelKey: 'softForce', groupKey: 'traction', factors: [1.03, 1.07, 1.12], safeFactors: [0.8, 1.15]
  }
]

export class RoadCraftService {
  private readonly settingsPath = join(app.getPath('userData'), 'settings.json')
  private readonly backupsRoot = join(app.getPath('userData'), 'backups')
  private settings: StudioSettings = {
    installPath: DEFAULT_INSTALL_PATH,
    locale: 'es',
    customImages: {},
    originalValues: {},
    editedAt: {},
    packageBackups: {}
  }
  private catalog = new Map<string, CatalogItem>()

  async init() {
    try {
      const stored = JSON.parse(await readFile(this.settingsPath, 'utf8')) as Partial<StudioSettings>
      this.settings = {
        ...this.settings,
        ...stored,
        customImages: stored.customImages ?? {},
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
    const compatibleImages = await this.walkFiles(sourceRoot, new Set(['.png', '.jpg', '.jpeg', '.webp']))
    const modDefinitions = await this.walkFiles(sourceRoot, new Set(['.mod']))
    const packagedVehicles = existsSync(basePackage)
      ? await readMatchingTextEntries(basePackage, entryName => BASE_VEHICLE_PATTERN.test(entryName))
      : []
    const entries: ContentEntry[] = []

    this.catalog.clear()

    for (const filePath of broFiles) {
      const parsed = await this.parseBroEntry(filePath, broRoot, compatibleImages)
      entries.push(parsed.entry)
      this.catalog.set(parsed.entry.id, parsed)
    }

    for (const archivedVehicle of packagedVehicles) {
      const parsed = this.parsePackagedVehicle(archivedVehicle, basePackage)
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

        if (!spec || !parameter || !Number.isFinite(requestedValue)) continue
        if (requestedValue < parameter.minimum || requestedValue > parameter.maximum) {
          throw new Error(`El valor de ${parameter.labelKey} está fuera del rango seguro.`)
        }

        originalValues[parameterId] ??= parameter.original
        source = this.replaceNumericValue(source, spec.path, spec.field, requestedValue)
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
        if (spec) source = this.replaceNumericValue(source, spec.path, spec.field, originalValue)
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
    const fileStats = await stat(filePath)
    const customImage = this.settings.customImages[id]
    const imagePath = customImage && existsSync(customImage) ? customImage : this.matchImage(filePath, images)

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
        parameters
      }
    }
  }

  private parsePackagedVehicle(archived: TextArchiveEntry, packagePath: string): CatalogItem {
    const stem = basename(archived.entryName, '.cls')
    const id = `pak:${resolve(packagePath)}::${archived.entryName}`
    const lowerName = stem.toLowerCase()
    const kind: ContentKind = /(?:^|_)(?:semi)?trailer(?:_|$)/i.test(lowerName) ? 'trailer' : 'truck'
    const { parameters, specMap } = this.createParameters(archived.content, PAK_TRUCK_PARAMETERS, id)
    const truckType = this.readStringValue(archived.content, ['properties', 'prop_truck_view'], 'truckType') ?? kind
    const customImage = this.settings.customImages[id]

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
        imageUrl: customImage && existsSync(customImage) ? pathToFileURL(customImage).href : undefined,
        parameters
      }
    }
  }

  private createParameters(source: string, specs: ParameterSpec[], itemId: string) {
    const parameters: EditableParameter[] = []
    const specMap = new Map<string, ParameterSpec>()
    const storedOriginals = this.settings.originalValues[itemId] ?? {}

    for (const spec of specs) {
      const current = this.readNumericValue(source, spec.path, spec.field)
      if (current === undefined) continue

      const original = storedOriginals[spec.id] ?? current
      const recommendations = spec.factors.map(factor => this.roundFor(original, original * factor)) as [number, number, number]
      const safeValues = spec.safeFactors.map(factor => original * factor)
      parameters.push({
        id: spec.id,
        labelKey: spec.labelKey,
        groupKey: spec.groupKey,
        value: current,
        original,
        unit: spec.unit,
        minimum: Math.min(...safeValues),
        maximum: Math.max(...safeValues),
        recommended: {
          low: recommendations[0],
          medium: recommendations[1],
          high: recommendations[2]
        }
      })
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

  private readNumericValue(source: string, path: string[], field: string) {
    const range = this.findNestedRange(source, path)
    const segment = source.slice(range.start, range.end)
    const match = new RegExp(`(?:^|\\n)\\s*${this.escapeRegExp(field)}\\s*=\\s*([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)`, 'm').exec(segment)
    return match ? Number(match[1]) : undefined
  }

  private readStringValue(source: string, path: string[], field: string) {
    const range = this.findNestedRange(source, path)
    const segment = source.slice(range.start, range.end)
    const match = new RegExp(`(?:^|\\n)\\s*${this.escapeRegExp(field)}\\s*=\\s*"([^"]*)"`, 'm').exec(segment)
    return match?.[1]
  }

  private replaceNumericValue(source: string, path: string[], field: string, value: number) {
    const range = this.findNestedRange(source, path)
    const segment = source.slice(range.start, range.end)
    const pattern = new RegExp(`(^|\\n)(\\s*${this.escapeRegExp(field)}\\s*=\\s*)([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)`, 'm')
    if (!pattern.test(segment)) throw new Error(`No se encontró el parámetro ${field}.`)

    const updated = segment.replace(pattern, (_match, lineStart: string, prefix: string) => `${lineStart}${prefix}${value}`)
    return source.slice(0, range.start) + updated + source.slice(range.end)
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
    if (/"Roadcraft(?: - Retail)?\.exe"/i.test(stdout)) {
      throw new Error('Cierra RoadCraft antes de guardar cambios en default_other.pak.')
    }
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

  private matchImage(filePath: string, images: string[]) {
    const stem = basename(filePath, extname(filePath)).toLowerCase()
    return images.find(image => basename(image, extname(image)).toLowerCase().includes(stem))
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
