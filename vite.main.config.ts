import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const iconSource = fileURLToPath(new URL('./src/assets/app-icon.ico', import.meta.url))

export default defineConfig({
  plugins: [{
    name: 'bundle-window-icon',
    writeBundle(options) {
      if (!options.dir) throw new Error('Missing main-process output directory')
      const destination = join(options.dir, 'app-icon.ico')
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(iconSource, destination)
    }
  }],
  build: {
    rollupOptions: {
      external: ['electron']
    }
  }
})
