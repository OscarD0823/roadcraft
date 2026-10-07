export type ContentKind = 'truck' | 'trailer' | 'ai' | 'other'
export type ContentSource = 'bro' | 'pak'
export type RecommendationLevel = 'low' | 'medium' | 'high'
export type ParameterValue = number | string | boolean
export type ParameterKind = 'number' | 'boolean' | 'select'

export interface LogisticsUse {
  map: string
  role: 'delivery' | 'validation'
  cargoNames: string[]
}

export interface RecommendedValues {
  low: number
  medium: number
  high: number
}

export interface EditableParameter {
  id: string
  labelKey: string
  helpKey?: string
  groupKey: string
  kind: ParameterKind
  value: ParameterValue
  original: ParameterValue
  unit?: string
  minimum?: number
  maximum?: number
  recommended?: RecommendedValues
  options?: Array<{ value: string; labelKey: string }>
}

export interface ContentEntry {
  id: string
  kind: ContentKind
  sourceType: ContentSource
  name: string
  internalName: string
  category: string
  filePath: string
  relativePath: string
  modified: boolean
  modifiedAt: number
  imageUrl?: string
  imageKind?: 'custom' | 'shop' | 'related' | 'mod'
  mobility?: 'road' | 'rail' | 'stationary'
  access?: {
    control: 'player' | 'ai' | 'shared' | 'unknown'
    baseVariant?: boolean
    logistics?: LogisticsUse[]
    variant: 'rusty' | 'standard'
    obtain: 'shop' | 'scenario' | 'unknown'
    buyCost?: number
    rankToUnlock?: number
  }
  parameters: EditableParameter[]
}

export interface ScanResult {
  installPath: string
  sourceRoots: string[]
  entries: ContentEntry[]
  packageCount: number
  scannedAt: number
  logisticsScanIncomplete?: boolean
}

export function entryInSection(entry: ContentEntry, kind: ContentKind) {
  return kind === 'ai' ? Boolean(entry.access?.logistics?.length) : entry.kind === kind
}

export interface SavePayload {
  filePath: string
  values: Record<string, ParameterValue>
  applyToVariants?: boolean
}

export interface OperationResult {
  ok: boolean
  message?: string
  backupPath?: string
  affectedIds?: string[]
}

export interface RoadZoneStatus {
  status: 'standard' | 'enabled' | 'conflict' | 'unavailable'
  message?: string
  backupPath?: string
}

/** Same chassis, not same brand. Base/mission copies stay out of linked edits. */
export function vehicleFamilyKey(entry: Pick<ContentEntry, 'internalName' | 'kind' | 'sourceType' | 'access'>): string | undefined {
  if (entry.sourceType !== 'pak' || entry.access?.baseVariant || entry.access?.logistics?.length
    || !['truck', 'trailer'].includes(entry.kind) || /(?:^|_)ai(?:_|$)/i.test(entry.internalName)) return
  const name = entry.internalName.toLowerCase().replace(/^auto_/, '')
  const chassis = /^([a-z]+_[a-z]*\d[a-z0-9]*)_/.exec(name)?.[1]
  // Unknown identifiers only join their exact old/restored/new counterpart.
  return `${entry.kind}:${chassis ?? name.replace(/_(?:old|res|new)$/, '')}`
}

export interface SaveSlotSummary {
  filePath: string
  slotName: string
  profileId: string
  modifiedAt: number
  size: number
}

export interface SaveTruckState {
  id: string
  unlocked: boolean
}

export interface SaveMapResources {
  logs: number
  steelBeams: number
  concreteSlabs: number
  steelPipes: number
}

export interface SaveMapState {
  id: string
  unlocked: boolean
  completed: boolean
  progress: number
  recoveryCoins: number
  resources: SaveMapResources
}

export interface SaveGameData {
  filePath: string
  slotName: string
  profileId: string
  modifiedAt: number
  money: number
  xp: number
  companyName: string
  companyCustomization?: CompanyCustomization
  trucks: SaveTruckState[]
  maps: SaveMapState[]
}

export interface CompanyCustomization {
  truckMaterialName: string
  graffitiBackgound?: string
  graffitiLogotype?: string
  BackgoundMaterialName?: string
  LogotypeMaterialName?: string
}

export interface CompanyPaint {
  id: string
  materialName: string
  colors: number[][]
  isLivery: boolean
}

export interface SaveGameChanges {
  filePath: string
  money: number
  xp: number
  companyName: string
  trucks: SaveTruckState[]
  maps: SaveMapState[]
}

export interface PreviewMaterial {
  albedo?: string
  normal?: string
  shading?: string
  emissive?: string
  type: string
  transparent: boolean
  tintMask?: string
  tint?: number[]
  tintG?: number[]
  maskFromAlbedoAlpha?: boolean
  paintable?: boolean
  customizationMasks?: Record<string, string>
  customizationMask?: string
}

export interface VehiclePreviewAsset {
  format?: 'fbx' | 'tpl'
  modelEncoding?: 'gzip-json'
  modelUrl: string
  modelImportScale: number
  textures: Record<string, string>
  materials: Record<string, PreviewMaterial>
  wheelUrl?: string
  wheelImportScale: number
  wheelScale: number
  paintColor?: number[]
  paint?: CompanyPaint
  paintSource?: 'company' | 'original'
  paintPartial?: boolean
}

export interface RoadCraftApi {
  getRoadZoneStatus(): Promise<RoadZoneStatus>
  setFreeRoads(enabled: boolean): Promise<OperationResult>
  openProjectLink(link: import('./project-links').ProjectLink): Promise<void>
  getPreview(id: string, companyMaterial?: string): Promise<VehiclePreviewAsset | undefined>
  getCompanyPaint(material: string): Promise<CompanyPaint | undefined>
  getSettings(): Promise<{ installPath: string; locale: string; version: string }>
  scan(): Promise<ScanResult>
  chooseInstall(): Promise<ScanResult | undefined>
  save(payload: SavePayload): Promise<OperationResult>
  restore(filePath: string, applyToVariants?: boolean): Promise<OperationResult>
  chooseImage(filePath: string): Promise<string | undefined>
  openFile(filePath: string): Promise<void>
  openSourceFolder(): Promise<void>
  launchModEditor(): Promise<OperationResult>
  setLocale(locale: string): Promise<void>
  findSaveGames(): Promise<SaveSlotSummary[]>
  chooseSaveGame(): Promise<SaveGameData | undefined>
  readSaveGame(filePath: string): Promise<SaveGameData>
  writeSaveGame(changes: SaveGameChanges): Promise<OperationResult>
}
