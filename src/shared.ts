export type ContentKind = 'truck' | 'trailer' | 'wheel' | 'other'
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
}

export interface RoadCraftApi {
  getSettings(): Promise<{ installPath: string; locale: string }>
  scan(): Promise<ScanResult>
  chooseInstall(): Promise<ScanResult | undefined>
  save(payload: SavePayload): Promise<OperationResult>
  restore(filePath: string): Promise<OperationResult>
  chooseImage(filePath: string): Promise<string | undefined>
  openFile(filePath: string): Promise<void>
  openSourceFolder(): Promise<void>
  launchModEditor(): Promise<OperationResult>
  setLocale(locale: string): Promise<void>
}
