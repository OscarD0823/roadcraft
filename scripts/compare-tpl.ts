import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { readTplModel, decodeTplSurfaces } from '../src/main/tpl-model'
const name='aramatsu_crayfish_wood_grapple_mod', root=`E:/SteamLibrary/steamapps/common/RoadCraft/root/mods_source/models/mods/${name}.tpl.asset`
const manager=new THREE.LoadingManager(); manager.addHandler(/.*/, {load:()=>new THREE.Texture()} as never)
const fbx=await readFile(root+'/'+name+'.fbx'), obj=new FBXLoader(manager).parse(fbx.buffer.slice(fbx.byteOffset,fbx.byteOffset+fbx.byteLength) as ArrayBuffer,'')
obj.updateMatrixWorld(true)
const model=readTplModel(await readFile(root+'/tpl/'+name+'.tpl')), surfaces=decodeTplSurfaces(model,await readFile(root+'/tpl/'+name+'.tpl_data'))
for(const n of ['glass_arrow_1','_lp_cab_glass_10','body_frame','frame_geom','cab','base']) {
  const s=surfaces.find(s=>s.name.includes(n)), mesh=obj.getObjectByName(s?.name??n)
  if(!s)continue
  if(mesh instanceof THREE.Mesh && mesh.geometry.getAttribute('uv')) {
    const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv'),matrix=new THREE.Matrix4().fromArray(s.matrix??new THREE.Matrix4().elements)
    const pairs=[]
    for(let i=0;i<Math.min(p.count,10);i++) {
      const world=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld)
      let best=Infinity,j=0
      for(let k=0;k<s.positions.length/3;k++) {const delta=new THREE.Vector3().fromArray(s.positions,k*3).applyMatrix4(matrix).distanceToSquared(world);if(delta<best){best=delta;j=k}}
      pairs.push({distance:Math.sqrt(best),fbx:[uv.getX(i),uv.getY(i)],tpl:s.uvs.slice(j*2,j*2+2)})
    }
    console.log('UV PAIRS',s.name,pairs)
  }
  const geometry=new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(s.positions,3))
  geometry.computeBoundingBox()
  console.log(s.name, 'TPL raw',geometry.boundingBox?.min.toArray(),geometry.boundingBox?.max.toArray(), 'FBX world', mesh&&new THREE.Box3().setFromObject(mesh).min.toArray(),mesh&&new THREE.Box3().setFromObject(mesh).max.toArray())
  const node=model.nodes.find(x=>x.name===s.name)!
  for(const [key,matrix] of Object.entries({lt:node.bindTransform,model:node.dccTransform}))if(matrix)console.log(key,geometry.boundingBox?.clone().applyMatrix4(new THREE.Matrix4().fromArray(matrix)).min.toArray(),geometry.boundingBox?.clone().applyMatrix4(new THREE.Matrix4().fromArray(matrix)).max.toArray())
}
