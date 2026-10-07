import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'

const root = resolve('out'); await mkdir(root,{recursive:true})
const fixture = await mkdtemp(join(root,'roads-error-ui-'))
assert(fixture.startsWith(root+sep))
let mockGame
try {
  const pack = join(fixture,'game/root/paks/client/default/default_other.pak')
  await mkdir(join(fixture,'game/root/paks/client/default'),{recursive:true})
  await mkdir(join(fixture,'game/root/mods_source/bro'),{recursive:true})
  await writeFile(join(fixture,'game/mod_editor_release.bat'),'REM QA fixture only; never executed')
  await copyFile('E:/SteamLibrary/steamapps/common/RoadCraft/root/paks/client/default/default_other.pak',pack)
  const checksum = () => readFile(pack).then(b=>createHash('sha256').update(b).digest('hex'))
  const original = await checksum()
  const output = join(fixture,'qa'), data = join(output,'data')
  await mkdir(data,{recursive:true})
  await writeFile(join(data,'settings.json'),JSON.stringify({installPath:join(fixture,'game'),locale:'es'}))
  // Harmless Node timer bearing the game's process name; close-game guard must reject.
  const mockExe = join(fixture,'RoadCraft.exe'); await copyFile(process.execPath,mockExe)
  mockGame = spawn(mockExe,['-e','setTimeout(()=>{},120000)'],{windowsHide:true,stdio:'ignore'})
  await new Promise((resolve,reject)=>{mockGame.once('spawn',resolve);mockGame.once('error',reject)})
  const qa = spawn(process.execPath,['scripts/test-view-ui.mjs'],{cwd:resolve('.'),windowsHide:true,stdio:'inherit',env:{...process.env,ROADCRAFT_QA_OUTPUT:output,ROADCRAFT_ROADS_ERROR_ONLY:'1'}})
  const code = await new Promise((resolve,reject)=>{qa.once('exit',resolve);qa.once('error',reject)})
  assert.equal(code,0)
  assert.equal(await checksum(),original,'Negative UI test changed its copied package')
  const settings = JSON.parse(await readFile(join(data,'settings.json'),'utf8'))
  assert.deepEqual(settings.roadZoneSnapshots??{},{}); assert.deepEqual(settings.packageBackups??{},{})
  // Keep only the screenshot as diagnostic output; no retained game assets or executables.
  await copyFile(join(output,'roads-game-open-error.png'),join(root,'qa-ui/roads-game-open-error.png'))
  console.log('Game-open error visible inside modal at 600×520; synthetic installation unchanged. Live game was not modified.')
} finally {
  if(mockGame && mockGame.exitCode===null){await new Promise(resolve=>{mockGame.once('exit',resolve);mockGame.kill()})}
  await rm(fixture,{recursive:true,force:true,maxRetries:10,retryDelay:100})
}
