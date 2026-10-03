import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { listPackage, extractFile } from '@electron/asar'

const root = process.cwd(), archive = join(root,'out/RoadCraft Studio-win32-x64/resources/app.asar')
const version = JSON.parse(await readFile(join(root,'package.json'),'utf8')).version
assert.equal(JSON.parse(extractFile(archive,'package.json').toString()).version,version)
const entries=listPackage(archive)
assert.deepEqual(entries.filter(entry=>/\.(?:tpl(?:_data)?|pct(?:_mip)?|fbx|blend|pak|dds|tga)$/i.test(entry)),[],'Game assets must not be distributed')
const main = entries.find(entry=>entry.replaceAll('\\','/').endsWith('/.vite/build/index.js'))
assert(main,'Missing main bundle')
const bundle=extractFile(archive,main.slice(1)).toString()
assert(bundle.includes('geometry-v9'),'Installer package contains an outdated model reader')
assert(bundle.includes('Preview resource exceeds size limit'),'Installer package contains the old archive loader')
const releases = (await readFile(join(root,'out/make/squirrel.windows/x64/RELEASES'),'utf8')).trim().split(/\s+/)
const nupkg=join(root,'out/make/squirrel.windows/x64',releases[1])
assert(releases[1].includes('-'+version+'-'))
assert.equal(Number(releases[2]),(await stat(nupkg)).size)
assert.equal(releases[0].toLowerCase(),createHash('sha1').update(await readFile(nupkg)).digest('hex'))
console.log('Distribution verified: '+version+', correct package hash, no bundled game models or textures.')
