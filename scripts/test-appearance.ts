import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import * as THREE from 'three'
import { previewAssembly, previewMobility } from '../src/main/preview-assembly'
import { CompiledPreviewStore } from '../src/main/compiled-preview'
import { readMatchingTextEntries,readMatchingBinaryEntries } from '../src/main/zip-package'
import { objectBody } from '../src/main/source-blocks'
import { trackOutline, orientTrackStrip,wrapTrackStrip,TrackMotion } from '../src/main/track-geometry'
import { nativeWheelMount } from '../src/main/wheel-mount'
import { readTplModel } from '../src/main/tpl-model'
import { readdir } from 'node:fs/promises'
import { wheelRollingAxis,mountSourceWheel } from '../src/renderer/source-model'
assert.equal(objectBody('x = { s = "a}b" y = { n = 1 } } after = {}','x'),' s = "a}b" y = { n = 1 } ')
assert.equal(previewMobility('properties={prop_tagged={tag="UID_MODULE_TRUCK_CRANE"}}'),'road')
assert.equal(previewMobility('isStaticTruck = True'),'stationary')
assert.equal(previewMobility('prop_tagged={tag="UID_MODULE_TOWER_CRANE_RAILED"}'),'rail')
const rotatedMarker=new THREE.Matrix4().makeRotationY(Math.PI/2).scale(new THREE.Vector3(2,1,.5)).setPosition(1,2,3)
const mounted=nativeWheelMount({id:0,name:'r_wheel_truck_01',parent:-1,bindTransform:rotatedMarker.elements},[0,.1,0])
assert.deepEqual(mounted.position.toArray(),[1,2.1,3]);assert.deepEqual(mounted.scale.toArray(),[1,1,1])
assert(Math.abs(new THREE.Vector3(1,0,0).applyQuaternion(mounted.quaternion).x)>.9999,'Marker export rotation must not turn a wheel sideways')
const sourceBody=new THREE.Group(),sourceMarker=new THREE.Group(),sourceWheel=new THREE.Group()
sourceMarker.rotation.y=Math.PI/2;sourceMarker.scale.set(2,1,.5);sourceMarker.name='wheel_1_right';sourceBody.add(sourceMarker)
const sourceMounted=mountSourceWheel(sourceBody,sourceWheel,sourceMarker,.67)
assert(Math.abs(new THREE.Vector3(1,0,0).applyQuaternion(sourceMounted.getWorldQuaternion(new THREE.Quaternion())).x)>.9999)
assert(sourceMounted.getWorldScale(new THREE.Vector3()).distanceTo(new THREE.Vector3(.67,.67,.67))<.000001)
const path = trackOutline([{x:1,y:1,z:2,radius:.5},{x:1,y:1,z:-2,radius:.5}])
assert(path.length>10 && path.length<12)
assert(path.sample(0).point.distanceTo(path.sample(path.length).point)<.00001)
const link=new THREE.BoxGeometry(.4,.08,.3), guides=[{x:1,y:1,z:2,radius:.5},{x:1,y:1,z:-2,radius:.5}]
const belt=wrapTrackStrip(link,guides,.4,.08),motion=new TrackMotion(belt),original=Array.from(belt.getAttribute('position').array)
motion.update(0)
assert(original.every((n,i)=>Math.abs(n-belt.getAttribute('position').array[i])<.00001),'Track rest pose changes')
motion.update(.2)
assert(original.some((n,i)=>Math.abs(n-belt.getAttribute('position').array[i])>.05),'Tread vertices must move, not just their texture')
motion.update(trackOutline(guides,.04).length)
assert(original.every((n,i)=>Math.abs(n-belt.getAttribute('position').array[i])<.00001),'Track loop is not continuous')
const restored=new THREE.BufferGeometryLoader().parse(belt.toJSON()),restoredMotion=new TrackMotion(restored)
restoredMotion.update(.2);assert(restored.getAttribute('position').count===belt.getAttribute('position').count)
assert.throws(()=>motion.update(NaN),/Invalid/)
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
  const wheelClasses=await readMatchingTextEntries(join(packages,'default_other.pak'),n=>/\/auto_wheel_[^/]+\.cls$/i.test(n))
  const assemblies=classes.map(entry=>({name:entry.entryName,model:/nameTpl\s*=\s*"([^"]+)"/.exec(objectBody(entry.content,'geom'))![1],
    ...previewAssembly(entry.content,wheelClasses.filter(w=>w.entryName.startsWith(entry.entryName.slice(0,entry.entryName.lastIndexOf('/')+1))))}))
  const required=new Set(assemblies.filter(a=>a.wheels.length).map(a=>a.model+'.tpl')),metadata=new Map<string,ReturnType<typeof readTplModel>>()
  for(const pak of (await readdir(packages)).filter(n=>/^default_tpl_\d+\.pak$/i.test(n)).sort())
    for(const entry of await readMatchingBinaryEntries(join(packages,pak),n=>required.has(n.replace(/^.*\//,''))))metadata.set(entry.entryName.replace(/^.*\//,''),readTplModel(entry.content))
  let mounts=0
  for(const assembly of assemblies.filter(a=>a.wheels.length)) {
    const body=metadata.get(assembly.model+'.tpl');assert(body,'Missing body '+assembly.name)
    for(const slot of assembly.wheels) {
      const frame=body.nodes.find(n=>n.name.toLowerCase()===slot.frame.toLowerCase());if(!frame?.bindTransform)continue
      const mount=nativeWheelMount(frame,slot.offset),axis=new THREE.Vector3(1,0,0).applyQuaternion(mount.quaternion)
      assert(Math.abs(axis.x)>.98,'Axle turned sideways: '+assembly.name+' '+slot.frame)
      assert.deepEqual(mount.scale.toArray(),[1,1,1],'Do not inherit a marker bone scale')
      mounts++
    }
  }
  console.log('Native wheel mounting frames checked:',mounts,'in',assemblies.length,'configurations')
  const stationary=classes.filter(c=>previewMobility(c.content)!=='road')
  assert(stationary.some(c=>c.entryName.includes('auto_n_and_s_700s_tower_crane/')))
  assert(stationary.some(c=>c.entryName.includes('auto_n_and_s_loader20g_crane_grabber/')))
  assert.equal(previewMobility(classes.find(c=>c.entryName.endsWith('/auto_wayfarer_oft96_ts_t_crane_flatbed_new.cls'))!.content),'road')
  const root=resolve('out');await mkdir(root,{recursive:true})
  const shared=process.env.ROADCRAFT_QA_CACHE,temporary=shared?resolve(shared):await mkdtemp(join(root,'qa-appearance-'))
  assert(temporary.startsWith(root+sep))
  try {
    const store=new CompiledPreviewStore(game,temporary)
    for(const cls of ['auto_aramatsu_bowhead_heavy_dumptruck_new','auto_greenway_ht500_dozer_new','auto_5111b_dragline_building_demolisher','auto_n_and_s_700s_tower_crane','auto_don_71',
      'auto_zikz_605e_mobile_scalper_res','auto_zikz_605e_heavy_transporter_res','auto_zikz_612c_heavy_crane_res']) {
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
      let tracks=0;model.traverse(o=>{if(o instanceof THREE.Mesh && o.userData.track){tracks++;const animator=new TrackMotion(o.geometry);animator.update(.5)}
        if(o.userData.drivenWheel){assert(o.parent?.name.startsWith('preview_wheel_'),'The mounting frame must stay fixed');assert(Math.abs(new THREE.Vector3(1,0,0).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).x)>.98,'Mounted wheel turned sideways')}})
      const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3())
      if(cls.includes('bowhead')){assert.equal(tracks,2);assert(size.x<4.5 && size.y<4 && size.z<10);assert(Object.values(asset.materials).some(m=>m.paintable&&m.tintMask))}
      if(cls.includes('greenway')){assert.equal(tracks,2,'Five-bone tracks missing');assert(size.y<5,'Cabin indicators are outside the vehicle')}
      if(cls.includes('dragline'))assert.equal(tracks,4,'Tracks or chains missing')
      console.log(cls, {wheels:assembly.wheels.length,tracks,size:size.toArray(),mobility:previewMobility(entry.content)})
    }
    assert.deepEqual(await store.paintColor('customization_material_00'),[89,33,41])
    assert.deepEqual((await store.paintProfile('customization_material_28'))?.colors,[[43,115,200],[78,75,82],[233,233,233]])
    console.log('Stationary/rail configurations:',stationary.length)
  } finally {if(!shared)await rm(temporary,{recursive:true,force:true})}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
