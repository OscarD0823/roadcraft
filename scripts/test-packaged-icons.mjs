import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const snow = JSON.parse(await readFile(join(root,'package.json'),'utf8')).name === 'snowrunner-studio-es'
const name = snow ? 'SnowRunner Studio' : 'RoadCraft Studio'
const source = await readFile(join(root, snow ? 'src/images/favicon.ico' : 'src/assets/app-icon.ico'))
const directory = process.env.STUDIO_PACKAGED_DIR || join(root,'out',name+'-win32-x64')
const executable = await readFile(join(directory,name+'.exe'))
for (let index = 0; index < source.readUInt16LE(4); index++) {
  const entry = 6 + index * 16, offset = source.readUInt32LE(entry+12), length = source.readUInt32LE(entry+8)
  assert(executable.includes(source.subarray(offset,offset+length)), 'Missing embedded vehicle icon at '+(source[entry]||256)+' px')
}
if (snow) {
  assert.deepEqual(await readFile(join(directory,'resources/app/.vite/favicon.ico')),source,'Stale native window icon')
} else {
  const { extractFile } = await import('@electron/asar')
  assert.deepEqual(extractFile(join(directory,'resources/app.asar'),join('.vite','build','app-icon.ico')),source,'Native icon missing from ASAR')
}
if (!process.env.STUDIO_PACKAGED_DIR) {
  const setup = await readFile(join(root,'out/make/squirrel.windows/x64',name+' Setup.exe'))
  for (let index = 0; index < source.readUInt16LE(4); index++) {
    const entry = 6 + index * 16, offset = source.readUInt32LE(entry+12), length = source.readUInt32LE(entry+8)
    assert(setup.includes(source.subarray(offset,offset+length)), 'Installer missing vehicle icon')
  }
}
console.log(name+': all seven vehicle-icon resources embedded in EXE; matching native icon bundled'+(!process.env.STUDIO_PACKAGED_DIR?' and installer checked.':'.'))

