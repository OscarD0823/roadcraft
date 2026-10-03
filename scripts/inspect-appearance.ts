import { basename, join } from 'node:path'
import { readdir, mkdir, writeFile } from 'node:fs/promises'
import { readMatchingBinaryEntries, readMatchingTextEntries } from '../src/main/zip-package'
import { readTplModel, decodeTplSurfaces } from '../src/main/tpl-model'
import * as THREE from 'three'
const root = 'E:/SteamLibrary/steamapps/common/RoadCraft/root/paks/client/default'
const pattern = new RegExp(process.argv[2] ?? 'auto_aramatsu_bowhead_heavy_dumptruck_new', 'i')
async function main() {
await mkdir('out/qa-appearance', {recursive:true})
const classes = await readMatchingTextEntries(join(root, 'default_other.pak'), n => /trucks\/(?:base\/)?([^/]+)\/\1\.cls$/i.test(n) && pattern.test(n.replace(/\.cls$/, '')))
for (const entry of classes) {
  await writeFile('out/qa-appearance/'+basename(entry.entryName),entry.content)
  console.log('\nCLASS', entry.entryName)
  const folder = entry.entryName.slice(0, entry.entryName.lastIndexOf('/') + 1)
  const wheelDefs = await readMatchingTextEntries(join(root, 'default_other.pak'), n => n.startsWith(folder) && /auto_wheel_.*\.cls$/.test(n))
  for (const wheel of wheelDefs) { await writeFile('out/qa-appearance/'+basename(wheel.entryName),wheel.content); console.log('WHEEL', basename(wheel.entryName), /nameTpl\s*=\s*"([^"]+)"/.exec(wheel.content)?.[1]) }
  const names = new Set([entry, ...wheelDefs].map(e => /nameTpl\s*=\s*"([^"]+)"/.exec(e.content)?.[1]).filter(Boolean))
  for(const m of entry.content.matchAll(/\btpl\s*=\s*"([^"]*track[^"]*)"/g)) names.add(m[1])
  for (const file of (await readdir(root)).filter(n => /^default_tpl_\d+\.pak$/.test(n))) {
    const assets = await readMatchingBinaryEntries(join(root, file), n => names.has(basename(n).replace(/\.tpl(?:_data)?$/, '')), 64 * 1024 * 1024)
    for (const asset of assets.filter(a=>a.entryName.endsWith('.tpl'))) {
      const meta = readTplModel(asset.content)
      if(/greenway_ht500_dozer_new\.tpl$/.test(asset.entryName)) {
        console.log('HEADER',asset.content.subarray(0,192).toString('hex'),asset.content.subarray(-64).toString('hex'))
        await writeFile('out/qa-appearance/'+basename(asset.entryName),asset.content)
      }
      await writeFile('out/qa-appearance/'+basename(asset.entryName)+'.json',JSON.stringify(meta,null,2))
      const data = assets.find(a=>a.entryName===asset.entryName+'_data')?.content
      if(data) {
        const box=new THREE.Box3(), surfaces=decodeTplSurfaces(meta,data)
        for(const s of surfaces){const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(s.positions,3));g.computeBoundingBox();box.union(g.boundingBox!.applyMatrix4(new THREE.Matrix4().fromArray(s.matrix??new THREE.Matrix4().elements)))}
        console.log('BOUNDS',basename(asset.entryName), box.min.toArray(),box.max.toArray(),surfaces.map(s=>s.name))
      }
      console.log('MODEL', asset.entryName, JSON.stringify({
        nodes: meta.nodes.filter(n => /wheel|roller|trail|cater|chain|base|cab|frame|bone_[0-9]/i.test(n.name)).slice(0,15).map(n=>({name:n.name,pos:n.bindTransform?.slice(12,15), splits:n.splitCount})),
        materials: [...new Map(meta.splits.map(s => [s.material?.mayaMtl, s.material])).values()].map(m=>({name:m?.mayaMtl,texture:m?.shadingMtl_Tex})),
        skins: meta.splits.filter(s => s.skin >= 0).map(s => ({node: meta.nodes[s.node]?.name, skin:s.skin,bones:s.bones})),
      }, null, 2))
    }
  }
}
}
void main()
