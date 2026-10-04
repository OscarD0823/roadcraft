import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { fbxMetersScale, exteriorMesh, mountSourceWheel, configureRoadShading, configureRoadPaint } from '../src/renderer/source-model'
import { visibleVehicleBounds, fitVehicleCamera, sceneryOccludesVehicle, vehicleScreenRegion } from '../src/renderer/vehicle-framing'

const manager = new THREE.LoadingManager()
// Geometry-only inspection: no DOM or game texture copies are needed in this test.
manager.addHandler(/.*/, { load: () => new THREE.Texture() } as unknown as THREE.Loader)
const source = process.env.ROADCRAFT_GAME_ROOT ?? 'E:/SteamLibrary/steamapps/common/RoadCraft'
const root = join(source,'root/mods_source/models/mods')
async function load(name: string) {
  const data = await readFile(join(root,name+'.tpl.asset',name+'.fbx'))
  const options = await readFile(join(root,name+'.tpl.asset','export_options.ps'),'utf8')
  const scale = options.match(/scale\s*=\s*([\d.]+)/)
  assert.ok(scale, 'Missing SDK import scale')
  const model = new FBXLoader(manager).parse(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer,'')
  model.userData.importScale = Number(scale[1])
  return model
}
async function main() {
const model = await load('aramatsu_crayfish_wood_grapple_mod')
const wheel = await load('wheel_aramatsu_crayfish_harvester_mod')
const meshes: string[] = [], slots: THREE.Object3D[] = []
model.traverse(object => {
  if (object instanceof THREE.Mesh) { object.visible = exteriorMesh(object.name); if(object.visible)meshes.push(object.name) }
  if (/^wheel_\d+_(left|right)$/i.test(object.name)) slots.push(object)
})
for (const slot of slots) {
  const mounted=mountSourceWheel(model,wheel,slot,.67)
  assert(Math.abs(new THREE.Vector3(1,0,0).applyQuaternion(mounted.getWorldQuaternion(new THREE.Quaternion())).x)>.9999,'Source wheel axle is not transverse')
}
console.log('FBX source axles checked:',slots.length)
model.scale.multiplyScalar(fbxMetersScale(model))
const bounds = visibleVehicleBounds(model), size = bounds.getSize(new THREE.Vector3())
assert.ok(size.toArray().every(n=>Number.isFinite(n) && n>.5 && n<30), 'Unrealistic source model scale')
assert.ok(slots.length>=6)
for(const aspect of [.4,.65,1,1.8,3]) {
  const camera = new THREE.PerspectiveCamera(36,aspect,.05,250)
  fitVehicleCamera(camera,bounds)
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const p = new THREE.Vector3(x,y,z).project(camera)
    assert.ok(Math.abs(p.x)<1 && Math.abs(p.y)<1 && Math.abs(p.z)<1, 'Source model clipped at '+aspect)
  }
}
assert.equal(exteriorMesh('body_geom'),true);assert.equal(exteriorMesh('body_lod2'),false)
assert.equal(exteriorMesh('hp_cab_interior'),false);assert.equal(exteriorMesh('BoneBodyRear_cdt'),false)
assert.equal(exteriorMesh('_load_volume'),false);assert.equal(exteriorMesh('_load_border_front'),false)
const material = new THREE.MeshStandardMaterial(), map = new THREE.Texture()
configureRoadShading(material,map)
const shader = {fragmentShader:THREE.ShaderLib.standard.fragmentShader}
material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer)
assert.ok(shader.fragmentShader.includes('texelMetalness.r') && shader.fragmentShader.includes('vAoMapUv ).b'))
assert.ok(!shader.fragmentShader.includes('#include <metalnessmap_fragment>') && !shader.fragmentShader.includes('#include <aomap_fragment>'), 'GPU shader channel remapping not expanded')
configureRoadPaint(material,{mask:map,tint:[15,47,90],tintG:[59,65,73]})
const paintShader={fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}}
material.onBeforeCompile(paintShader as never,{} as THREE.WebGLRenderer)
assert.ok(paintShader.fragmentShader.includes('roadPaintWeights.r')&&paintShader.fragmentShader.includes('texelMetalness.r'),'Paint must preserve the original PBR shader')
assert.ok((paintShader.uniforms as Record<string,unknown>).roadPaintMask)
const camera = new THREE.PerspectiveCamera(36,1,.05,250);camera.position.set(0,2,20);camera.lookAt(0,2,0);camera.updateMatrixWorld()
const region = vehicleScreenRegion(camera,new THREE.Box3(new THREE.Vector3(-8,0,-2),new THREE.Vector3(8,4,2)))
assert.ok(sceneryOccludesVehicle(camera,region,new THREE.Sphere(new THREE.Vector3(0,2,8),3)))
assert.equal(sceneryOccludesVehicle(camera,region,new THREE.Sphere(new THREE.Vector3(0,2,-12),3)),false)
console.log(JSON.stringify({unitScale:model.userData.unitScaleFactor,size:size.toArray(),meshes:meshes.length,wheelSlots:slots.map(o=>({name:o.name,position:o.getWorldPosition(new THREE.Vector3()).toArray(),rotation:o.getWorldQuaternion(new THREE.Quaternion()).toArray()}))},null,2))
}
void main().catch(error=>{console.error(error);process.exitCode=1})
