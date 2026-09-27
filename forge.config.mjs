import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const packageInfo = JSON.parse(readFileSync(join(currentDir, 'package.json'), 'utf8'))

export default {
  packagerConfig: {
    asar: true,
    executableName: 'RoadCraft Studio',
    icon: join(currentDir, 'src/assets/app-icon.ico'),
    appBundleId: 'com.oscard0823.roadcraftstudio'
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'RoadCraftStudio',
        authors: 'OscarD0823',
        description: packageInfo.description,
        exe: 'RoadCraft Studio.exe',
        setupExe: 'RoadCraft Studio Setup.exe',
        setupIcon: join(currentDir, 'src/assets/app-icon.ico'),
        iconUrl: 'https://raw.githubusercontent.com/OscarD0823/roadcraft/main/src/assets/app-icon.ico',
        shortcutName: 'RoadCraft Studio',
        noMsi: true
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main/index.ts',
            config: 'vite.main.config.ts'
          },
          {
            entry: 'src/preload.ts',
            config: 'vite.preload.config.ts'
          }
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.ts'
          }
        ]
      }
    }
  ]
}
