import assert from 'node:assert/strict'
import { app } from 'electron'
import { createWriteStream, existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { finished } from 'node:stream/promises'
import { ZipFile } from 'yazl'
import { RoadCraftService, PAK_TRUCK_PARAMETERS } from '../src/main/roadcraft'
import { readMatchingTextEntries } from '../src/main/zip-package'

async function main() {
  const root=resolve('out');mkdirSync(root,{recursive:true})
  const temporary=mkdtempSync(join(root,'sand-fixture-'))
  assert(temporary.startsWith(root+sep))
  mkdirSync(join(temporary,'data'))
  app.setPath('userData',join(temporary,'data'));app.setPath('sessionData',join(temporary,'data'))
  await app.whenReady()
  const packagePath=join(temporary,'root/paks/client/default/default_other.pak')
  const cls='ssl/autogen_designer_wizard/trucks/auto_fixture_dump/auto_fixture_dump.cls',id='test:dump'
  const source='properties = {\n prop_load_volume = {\n  volumeMass = 20000\n  volumeMesh = "_load_volume"\n  pourMultiplier = 1.5\n }\n prop_fuel = {\n  volumeMass = 123\n }\n}\n'
  try {
    await mkdir(join(temporary,'root/paks/client/default'),{recursive:true})
    const zip=new ZipFile(),output=createWriteStream(packagePath)
    zip.outputStream.pipe(output);zip.addBuffer(Buffer.from(source),cls);zip.addBuffer(Buffer.from('keep'), 'unrelated.txt');zip.end();await finished(output)
    await writeFile(packagePath+'.cache','fixture cache')
    // Internal access is restricted to this synthetic installation and its isolated user data.
    const service=new RoadCraftService() as any
    service.settings.installPath=temporary
    service.assertGameIsClosed=async()=>{} // A fixture is not the live game's package.
    const refresh=async()=>{
      const entries=await readMatchingTextEntries(packagePath,()=>true),text=entries.find(e=>e.entryName===cls)!.content
      assert.equal(entries.find(e=>e.entryName==='unrelated.txt')!.content,'keep')
      const parsed=service.createParameters(text,PAK_TRUCK_PARAMETERS,id)
      service.catalog.set(id,{sourceType:'pak',sourcePath:packagePath,archiveEntryName:cls,specs:parsed.specMap,
        entry:{id,sourceType:'pak',parameters:parsed.parameters}})
      return parsed.parameters.find((p:any)=>p.id==='sandCapacity')
    }
    service.scan=refresh
    let parameter=await refresh()
    assert.equal(parameter.value,20);assert.equal(parameter.original,20);assert.equal(parameter.unit,'t')
    assert.deepEqual(parameter.recommended,{low:21,medium:22,high:24})
    assert.equal(parameter.minimum,15);assert.equal(parameter.maximum,25)
    const originalPackage=await readFile(packagePath)
    for(const bad of [-1,0,14.99,25.01,100000,NaN,Infinity,'']) {
      assert.equal((await service.save({filePath:id,values:{sandCapacity:bad}})).ok,false,'Unsafe or invalid mass accepted')
      assert.deepEqual(await readFile(packagePath),originalPackage,'Rejected capacity wrote the package')
      assert(existsSync(packagePath+'.cache'),'Rejected capacity deleted the cache')
    }
    assert.equal((await service.save({filePath:id,values:{sandCapacity:24}})).ok,true)
    const [written]=await readMatchingTextEntries(packagePath,n=>n===cls)
    assert.equal(written.content,source.replace('volumeMass = 20000','volumeMass = 24000'))
    assert(!existsSync(packagePath+'.cache'))
    const backup=service.settings.packageBackups[packagePath].backupPath
    assert(backup.startsWith(temporary+sep));assert.deepEqual(await readFile(backup),originalPackage)
    parameter=await refresh();assert.equal(parameter.original,20);assert.equal(parameter.maximum,25)
    assert.equal((await service.save({filePath:id,values:{sandCapacity:26}})).ok,false,'Repeated edits must not increase the original limit')
    assert.equal((await service.restore(id)).ok,true)
    assert.equal((await readMatchingTextEntries(packagePath,n=>n===cls))[0].content,source)
    console.log('Sand capacity: units, presets, invalid/oversized rejection, exact ZIP save, backup, original limit and restore verified on a synthetic package.')
  } finally {await rm(temporary,{recursive:true,force:true})}
}
void main().then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1)})
