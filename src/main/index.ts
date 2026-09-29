import { app, BrowserWindow, ipcMain } from 'electron'
import squirrelStartup from 'electron-squirrel-startup'
import { UpdateSourceType, updateElectronApp } from 'update-electron-app'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SaveGameChanges, SavePayload } from '../shared'
import { RoadCraftService } from './roadcraft'

const currentDir = dirname(fileURLToPath(import.meta.url))
let mainWindow: BrowserWindow | undefined

if (squirrelStartup) {
  app.quit()
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId('com.squirrel.RoadCraftStudio.RoadCraftStudio')

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  void app.whenReady()
    .then(async () => {
      const service = new RoadCraftService()
      await service.init()
      registerHandlers(service)
      mainWindow = await createWindow()
      initUpdater()

      app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          mainWindow = await createWindow()
        }
      })
    })
    .catch((error) => {
      console.error('RoadCraft Studio could not start:', error)
      app.quit()
    })
}

function registerHandlers(service: RoadCraftService) {
  ipcMain.handle('roadcraft:get-settings', () => service.getSettings())
  ipcMain.handle('roadcraft:scan', () => service.scan())
  ipcMain.handle('roadcraft:choose-install', () => service.chooseInstall())
  ipcMain.handle('roadcraft:save', (_event, payload: SavePayload) => service.save(payload))
  ipcMain.handle('roadcraft:restore', (_event, filePath: string) => service.restore(filePath))
  ipcMain.handle('roadcraft:choose-image', (_event, filePath: string) => service.chooseImage(filePath))
  ipcMain.handle('roadcraft:open-file', (_event, filePath: string) => service.openFile(filePath))
  ipcMain.handle('roadcraft:open-source-folder', () => service.openSourceFolder())
  ipcMain.handle('roadcraft:launch-mod-editor', () => service.launchModEditor())
  ipcMain.handle('roadcraft:set-locale', (_event, locale: string) => service.setLocale(locale))
  ipcMain.handle('roadcraft:find-save-games', () => service.findSaveGames())
  ipcMain.handle('roadcraft:choose-save-game', () => service.chooseSaveGame())
  ipcMain.handle('roadcraft:read-save-game', (_event, filePath: string) => service.readSaveGame(filePath))
  ipcMain.handle('roadcraft:write-save-game', (_event, changes: SaveGameChanges) => service.writeSaveGame(changes))
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 520,
    show: false,
    backgroundColor: '#0b1220',
    title: 'RoadCraft Studio',
    icon: join(app.getAppPath(), 'src', 'assets', 'app-icon.ico'),
    webPreferences: {
      preload: join(currentDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.setMenuBarVisibility(false)

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    await window.loadFile(join(currentDir, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  window.once('ready-to-show', () => window.show())
  return window
}

function initUpdater() {
  if (!app.isPackaged) return

  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: 'OscarD0823/roadcraft'
    },
    updateInterval: '30 minutes',
    logger: console,
    notifyUser: true
  })
}
