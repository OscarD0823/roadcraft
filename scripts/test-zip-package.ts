import { createWriteStream } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { finished } from 'node:stream/promises'
import { ZipFile } from 'yazl'
import { readMatchingTextEntries, replaceTextEntry } from '../src/main/zip-package'

async function main() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'roadcraft-studio-zip-'))
  const archivePath = join(temporaryRoot, 'fixture.pak')

  try {
    const archive = new ZipFile()
    const destination = createWriteStream(archivePath)
    archive.outputStream.pipe(destination)
    archive.addBuffer(Buffer.from('properties = { torque = 100 }', 'utf8'), 'ssl/trucks/vehicle.cls')
    archive.addBuffer(Buffer.from('unchanged', 'utf8'), 'ssl/data/readme.txt')
    archive.end()
    await finished(destination)

    await replaceTextEntry(archivePath, 'ssl/trucks/vehicle.cls', 'properties = { torque = 118 }')
    const entries = await readMatchingTextEntries(archivePath, () => true)
    const vehicle = entries.find(entry => entry.entryName === 'ssl/trucks/vehicle.cls')
    const untouched = entries.find(entry => entry.entryName === 'ssl/data/readme.txt')

    if (vehicle?.content !== 'properties = { torque = 118 }') {
      throw new Error('El contenido reemplazado no coincide.')
    }
    if (untouched?.content !== 'unchanged') {
      throw new Error('Un archivo ajeno cambió durante la reconstrucción.')
    }
    if ((await readFile(archivePath)).subarray(0, 2).toString('ascii') !== 'PK') {
      throw new Error('El paquete reconstruido no conserva el formato ZIP.')
    }

    const installedPackage = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft\\root\\paks\\client\\default\\default_other.pak'
    try {
      const vehicles = await readMatchingTextEntries(
        installedPackage,
        entryName => /^ssl\/autogen_designer_wizard\/trucks\/([^/]+)\/\1\.cls$/i.test(entryName)
      )
      if (vehicles.length < 50) {
        throw new Error(`Solo se detectaron ${vehicles.length} vehículos en el paquete instalado.`)
      }
      console.log(`Prueba correcta: ${vehicles.length} vehículos base detectados; escritura ZIP verificada.`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('Prueba ZIP correcta; no se encontró una instalación local para probar el catálogo base.')
      } else {
        throw error
      }
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
