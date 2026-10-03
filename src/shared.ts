export type ContentKind = 'truck' | 'trailer' | 'ai' | 'other'
export type ContentSource = 'bro' | 'pak'
export type RecommendationLevel = 'low' | 'medium' | 'high'
export type ParameterValue = number | string | boolean
export type ParameterKind = 'number' | 'boolean' | 'select'

export interface RecommendedValues {
  low: number
  medium: number
  high: number
}

export interface EditableParameter {
  id: string
  labelKey: string
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
  parameters: EditableParameter[]
}

export interface ScanResult {
  installPath: string
  sourceRoots: string[]
  entries: ContentEntry[]
  packageCount: number
  scannedAt: number
}

export interface SavePayload {
  filePath: string
  values: Record<string, ParameterValue>
}

export interface OperationResult {
  ok: boolean
  message?: string
  backupPath?: string
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
  trucks: SaveTruckState[]
  maps: SaveMapState[]
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
}

export interface VehiclePreviewAsset {
  modelUrl: string
  modelImportScale: number
  textures: Record<string, string>
  materials: Record<string, PreviewMaterial>
  wheelUrl?: string
  wheelImportScale: number
  wheelScale: number
}

export interface RoadCraftApi {
  getPreview(id: string): Promise<VehiclePreviewAsset | undefined>
  getSettings(): Promise<{ installPath: string; locale: string; version: string }>
  scan(): Promise<ScanResult>
  chooseInstall(): Promise<ScanResult | undefined>
  save(payload: SavePayload): Promise<OperationResult>
  restore(filePath: string): Promise<OperationResult>
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
