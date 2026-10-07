import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { openPromise } from 'yauzl'
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
assert(bundle.includes('geometry-v11'),'Installer package contains an outdated model reader')
assert(bundle.includes('Preview resource exceeds size limit'),'Installer package contains the old archive loader')
assert(bundle.includes('Logistics scene exceeds size limit'),'Installer package lacks the logistics scene reader')
assert(bundle.includes('auto_materials_library.sso'),'Installer package lacks the native company paint library reader')
const renderer=entries.find(entry=>/[/\\]assets[/\\]index-[^/\\]+\.js$/.test(entry))
assert(renderer,'Missing renderer bundle')
const rendererBundle=extractFile(archive,renderer.slice(1)).toString()
for(const key of ['machine--excavator','sand-2','sand-discharge','scout-shoulder','grade-clearance','roadCompanyColor2','data-project-link','https://github.com/OscarD0823/roadcraft','sand-map-preset','data-variant-toggle'])assert(rendererBundle.includes(key),'Outdated renderer: '+key)
assert(bundle.includes('originalLinkedValues'),'Installer lacks precise linked-value restoration')
const releases = (await readFile(join(root,'out/make/squirrel.windows/x64/RELEASES'),'utf8')).trim().split(/\s+/)
const nupkg=join(root,'out/make/squirrel.windows/x64',releases[1])
assert(releases[1].includes('-'+version+'-'))
assert.equal(Number(releases[2]),(await stat(nupkg)).size)
assert.equal(releases[0].toLowerCase(),createHash('sha1').update(await readFile(nupkg)).digest('hex'))
const portableHash=createHash('sha256');for await(const chunk of createReadStream(archive))portableHash.update(chunk)
const portable=portableHash.digest('hex'),installer=await openPromise(nupkg,{lazyEntries:true,strictFileNames:true,validateEntrySizes:true})
let installerMatches=false
try {
  for await(const entry of installer.eachEntry())if(entry.fileName.endsWith('/resources/app.asar')){
    const hash=createHash('sha256');for await(const chunk of await installer.openReadStreamPromise(entry))hash.update(chunk)
    assert.equal(hash.digest('hex'),portable,'Installer and tested portable build differ');installerMatches=true;break
  }
} finally {if(installer.isOpen)installer.close()}
assert(installerMatches,'Installer lacks app.asar')
console.log(JSON.stringify({version,portable,installerMatches,noBundledGameAssets:true}))
