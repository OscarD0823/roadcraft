import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import * as THREE from 'three'
import { previewAssembly, previewMobility } from '../src/main/preview-assembly'
import { CompiledPreviewStore } from '../src/main/compiled-preview'
import { readMatchingTextEntries } from '../src/main/zip-package'
import { objectBody } from '../src/main/source-blocks'
import { trackOutline, orientTrackStrip } from '../src/main/track-geometry'
import { wheelRollingAxis } from '../src/renderer/source-model'
assert.equal(objectBody('x = { s = "a}b" y = { n = 1 } } after = {}','x'),' s = "a}b" y = { n = 1 } ')
assert.equal(previewMobility('properties={prop_tagged={tag="UID_MODULE_TRUCK_CRANE"}}'),'road')
assert.equal(previewMobility('isStaticTruck = True'),'stationary')
assert.equal(previewMobility('prop_tagged={tag="UID_MODULE_TOWER_CRANE_RAILED"}'),'rail')
const path = trackOutline([{x:1,y:1,z:2,radius:.5},{x:1,y:1,z:-2,radius:.5}])
assert(path.length>10 && path.length<12)
assert(path.sample(0).point.distanceTo(path.sample(path.length).point)<.00001)
const fixture=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([.3,.1,-.55,.3,.1,.55],3))
const transforms=[new THREE.Matrix4().makeTranslation(0,0,-.55).elements,new THREE.Matrix4().makeTranslation(0,0,.275).elements]
const oriented=orientTrackStrip(fixture,transforms).getAttribute('position')
assert(Math.abs(oriented.getX(1)+1.1)<.00001 && Math.abs(oriented.getZ(1)-.3)<.00001,'Wrong longitudinal track axis')
for(const steering of [-.6,0,.6])for(const mirrored of [false,true])for(const scale of [.4,1,1.8]) {
  const frame=new THREE.Group(),wheel=new THREE.Group();frame.rotation.y=steering;frame.scale.set(scale,1,.7);frame.add(wheel);if(mirrored)wheel.rotateY(Math.PI)
  frame.updateMatrixWorld(true)
  const initial=wheel.quaternion.clone(),before=new THREE.Vector3(1,0,0).transformDirection(wheel.matrixWorld),axis=wheelRollingAxis(wheel)
  for(const phase of [.3,1,2,3,4,5]) {
    wheel.quaternion.copy(initial).multiply(new THREE.Quaternion().setFromAxisAngle(axis,phase));frame.updateMatrixWorld(true)
    assert(before.dot(new THREE.Vector3(1,0,0).transformDirection(wheel.matrixWorld))>.999999,'Wheel tilts inside its mounting frame')
  }
}

async function main() {
  const game=process.env.ROADCRAFT_GAME_PATH??'E:/SteamLibrary/steamapps/common/RoadCraft',packages=join(game,'root/paks/client/default')
  if(!existsSync(packages)){console.log('Appearance boundary checks passed; game checks skipped.');return}
  const classes=await readMatchingTextEntries(join(packages,'default_other.pak'),n=>/trucks\/(?:base\/)?([^/]+)\/\1\.cls$/i.test(n))
  const stationary=classes.filter(c=>previewMobility(c.content)!=='road')
  assert(stationary.some(c=>c.entryName.includes('auto_n_and_s_700s_tower_crane/')))
  assert(stationary.some(c=>c.entryName.includes('auto_n_and_s_loader20g_crane_grabber/')))
  assert.equal(previewMobility(classes.find(c=>c.entryName.endsWith('/auto_wayfarer_oft96_ts_t_crane_flatbed_new.cls'))!.content),'road')
  const root=resolve('out');await mkdir(root,{recursive:true})
  const shared=process.env.ROADCRAFT_QA_CACHE,temporary=shared?resolve(shared):await mkdtemp(join(root,'qa-appearance-'))
  assert(temporary.startsWith(root+sep))
  try {
    const store=new CompiledPreviewStore(game,temporary)
    for(const cls of ['auto_aramatsu_bowhead_heavy_dumptruck_new','auto_greenway_ht500_dozer_new','auto_5111b_dragline_building_demolisher','auto_n_and_s_700s_tower_crane','auto_don_71']) {
      const entry=classes.find(c=>c.entryName.endsWith('/'+cls+'.cls'))
      if(!entry){console.log('Class not in installation:',cls);continue}
      const folder=entry.entryName.slice(0,entry.entryName.lastIndexOf('/')+1)
      const wheels=await readMatchingTextEntries(join(packages,'default_other.pak'),n=>n.startsWith(folder)&&/\/auto_wheel_[^/]+\.cls$/.test(n))
      const assembly=previewAssembly(entry.content,wheels)
      if(cls.includes('bowhead')) {
        assert.equal(assembly.tracks.length,2)
        assert.equal(assembly.wheels.length,24,'Missing visual rollers')
        assert.equal(assembly.wheels.find(w=>w.frame==='roller_front_l')?.scale,.322)
        assert.equal(assembly.wheels.find(w=>w.frame==='roller_middle_l_0')?.scale,.314)
      }
      const name=/nameTpl\s*=\s*"([^"]+)"/.exec(entry.content)![1]
      const asset=await store.get(name,undefined,assembly.wheels,assembly.tracks);assert(asset,cls+' failed to load')
      const model=new THREE.ObjectLoader().parse(JSON.parse(gunzipSync(await readFile(new URL(asset.modelUrl))).toString('utf8')))
      model.traverse(o=>{if(o instanceof THREE.Mesh)assert(asset.materials[(o.material as THREE.Material).name],'Missing namespaced material')})
      let tracks=0;model.traverse(o=>{if(o.userData.track)tracks++;if(o.userData.drivenWheel)assert(o.parent?.name.startsWith('preview_wheel_'),'The mounting frame must stay fixed')})
      const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3())
      if(cls.includes('bowhead')){assert.equal(tracks,2);assert(size.x<4.5 && size.y<4 && size.z<10);assert(Object.values(asset.materials).some(m=>m.paintable&&m.tintMask))}
      if(cls.includes('greenway')){assert.equal(tracks,2,'Five-bone tracks missing');assert(size.y<5,'Cabin indicators are outside the vehicle')}
      if(cls.includes('dragline'))assert.equal(tracks,4,'Tracks or chains missing')
      console.log(cls, {wheels:assembly.wheels.length,tracks,size:size.toArray(),mobility:previewMobility(entry.content)})
    }
    assert.deepEqual(await store.paintColor('customization_material_00'),[15,47,90])
    console.log('Stationary/rail configurations:',stationary.length)
  } finally {if(!shared)await rm(temporary,{recursive:true,force:true})}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
