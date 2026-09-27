export type ContentKind = 'truck' | 'wheel' | 'other'
export type RecommendationLevel = 'low' | 'medium' | 'high'

export interface RecommendedValues {
  low: number
  medium: number
  high: number
}

export interface EditableParameter {
  id: string
  labelKey: string
  groupKey: string
  value: number
  original: number
  unit?: string
  minimum: number
  maximum: number
  recommended: RecommendedValues
}

export interface ContentEntry {
  id: string
  kind: ContentKind
  name: string
  internalName: string
  category: string
  filePath: string
  relativePath: string
  modified: boolean
  modifiedAt: number
  imageUrl?: string
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
  values: Record<string, number>
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
