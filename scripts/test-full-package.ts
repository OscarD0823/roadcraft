import { copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { openPromise } from 'yauzl'
import { readMatchingTextEntries, replaceTextEntry } from '../src/main/zip-package'

async function countEntries(path: string) {
  const archive = await openPromise(path, { lazyEntries: true, validateEntrySizes: true })
  let count = 0
  try {
    for await (const entry of archive.eachEntry()) {
      if (![0, 8].includes(entry.compressionMethod)) {
        throw new Error(`Método ZIP no compatible: ${entry.compressionMethod}`)
      }
      count++
    }
  } finally {
    if (archive.isOpen) archive.close()
  }
  return count
}

async function main() {
  const source = 'E:\\SteamLibrary\\steamapps\\common\\RoadCraft\\root\\paks\\client\\default\\default_other.pak'
  await stat(source)
  const root=resolve('out');await mkdir(root,{recursive:true})
  const temporaryRoot = await mkdtemp(join(root, 'roadcraft-studio-full-pak-'))
  if (!temporaryRoot.startsWith(root+sep) || !basename(temporaryRoot).startsWith('roadcraft-studio-full-pak-')) {
    throw new Error('La carpeta temporal no pasó la validación de seguridad.')
  }
  const copy = join(temporaryRoot, 'default_other.pak')

  try {
    console.log('Copiando el paquete real a una carpeta temporal...')
    await copyFile(source, copy)
    const vehicles = await readMatchingTextEntries(
      copy,
      name => /^ssl\/autogen_designer_wizard\/trucks\/(?:base\/)?([^/]+)\/\1\.cls$/i.test(name)
    )
    const sand=process.argv.includes('--sand')
    const target = vehicles.find(entry => sand
      ? entry.entryName.endsWith('/auto_aramatsu_bowhead_heavy_dumptruck_new.cls')
      : entry.entryName.includes('/trucks/base/') && entry.content.includes('torque'))
    if (!target) throw new Error('No se encontró un vehículo válido para la prueba.')
    const field=sand?'volumeMass':'torque'
    const changed = target.content.replace(new RegExp('(\\b'+field+'\\s*=\\s*)([-+]?\\d*\\.?\\d+)'), (_match, prefix, value) => prefix + Number(value) * (sand?1.2:1.01))
    if (changed === target.content) throw new Error('No se pudo preparar la modificación de la copia temporal.')

    const beforeCount = await countEntries(copy)
    console.log(`Reconstruyendo una copia con ${beforeCount} entradas...`)
    await replaceTextEntry(copy, target.entryName, changed)
    const afterCount = await countEntries(copy)
    const verification = await readMatchingTextEntries(copy, name => name === target.entryName)

    if (beforeCount !== afterCount) throw new Error(`El paquete cambió de ${beforeCount} a ${afterCount} entradas.`)
    if (verification[0]?.content !== changed) throw new Error('La modificación no se conservó en la copia temporal.')
    console.log(`Prueba completa correcta: ${field} verificado; ${vehicles.length} clases y ${afterCount} entradas conservadas.`)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
