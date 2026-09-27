import { contextBridge, ipcRenderer } from 'electron'
import type { RoadCraftApi, SavePayload } from './shared'

const api: RoadCraftApi = {
  getSettings: () => ipcRenderer.invoke('roadcraft:get-settings'),
  scan: () => ipcRenderer.invoke('roadcraft:scan'),
  chooseInstall: () => ipcRenderer.invoke('roadcraft:choose-install'),
  save: (payload: SavePayload) => ipcRenderer.invoke('roadcraft:save', payload),
  restore: (filePath: string) => ipcRenderer.invoke('roadcraft:restore', filePath),
  chooseImage: (filePath: string) => ipcRenderer.invoke('roadcraft:choose-image', filePath),
  openFile: (filePath: string) => ipcRenderer.invoke('roadcraft:open-file', filePath),
  openSourceFolder: () => ipcRenderer.invoke('roadcraft:open-source-folder'),
  launchModEditor: () => ipcRenderer.invoke('roadcraft:launch-mod-editor'),
  setLocale: (locale: string) => ipcRenderer.invoke('roadcraft:set-locale', locale)
}

contextBridge.exposeInMainWorld('roadcraft', api)
