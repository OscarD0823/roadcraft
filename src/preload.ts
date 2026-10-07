import { contextBridge, ipcRenderer } from 'electron'
import type { RoadCraftApi, SaveGameChanges, SavePayload } from './shared'

const api: RoadCraftApi = {
  getRoadZoneStatus: () => ipcRenderer.invoke('roadcraft:road-zone-status'),
  setFreeRoads: enabled => ipcRenderer.invoke('roadcraft:free-roads', enabled),
  openProjectLink: link => ipcRenderer.invoke('roadcraft:open-project-link', link),
  getPreview: (id: string, companyMaterial?: string) => ipcRenderer.invoke('roadcraft:get-preview', id, companyMaterial),
  getCompanyPaint: (material: string) => ipcRenderer.invoke('roadcraft:get-company-paint', material),
  getSettings: () => ipcRenderer.invoke('roadcraft:get-settings'),
  scan: () => ipcRenderer.invoke('roadcraft:scan'),
  chooseInstall: () => ipcRenderer.invoke('roadcraft:choose-install'),
  save: (payload: SavePayload) => ipcRenderer.invoke('roadcraft:save', payload),
  restore: (filePath: string, applyToVariants?: boolean) => ipcRenderer.invoke('roadcraft:restore', filePath, applyToVariants),
  chooseImage: (filePath: string) => ipcRenderer.invoke('roadcraft:choose-image', filePath),
  openFile: (filePath: string) => ipcRenderer.invoke('roadcraft:open-file', filePath),
  openSourceFolder: () => ipcRenderer.invoke('roadcraft:open-source-folder'),
  launchModEditor: () => ipcRenderer.invoke('roadcraft:launch-mod-editor'),
  setLocale: (locale: string) => ipcRenderer.invoke('roadcraft:set-locale', locale),
  findSaveGames: () => ipcRenderer.invoke('roadcraft:find-save-games'),
  chooseSaveGame: () => ipcRenderer.invoke('roadcraft:choose-save-game'),
  readSaveGame: (filePath: string) => ipcRenderer.invoke('roadcraft:read-save-game', filePath),
  writeSaveGame: (changes: SaveGameChanges) => ipcRenderer.invoke('roadcraft:write-save-game', changes)
}

contextBridge.exposeInMainWorld('roadcraft', api)
