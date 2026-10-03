import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, stat, rm, mkdir } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { readPNG } from 'tex-decoder'
import { CompiledPreviewStore } from '../src/main/compiled-preview'

async function main() {
  const game=process.env.ROADCRAFT_GAME_PATH ?? 'E:/SteamLibrary/steamapps/common/RoadCraft'
  if(!existsSync(join(game,'root/paks/client/default'))) { console.log('Installed-game preview checks skipped.'); return }
  const root=resolve('out'); await mkdir(root,{recursive:true})
  const temporary=await mkdtemp(join(root,'qa-native-'))
  assert(temporary.startsWith(root+sep) && temporary.includes('qa-native-'))
  try {
    const store=new CompiledPreviewStore(game,temporary)
    assert.equal(await store.get('../arbitrary'),undefined)
    for(const name of ['aramatsu_bowhead_30t','greenway_ht500_dozer_new']) {
      const asset=await store.get(name); assert(asset,name+' unavailable')
      assert.equal(asset.modelEncoding,'gzip-json')
      const compressed=await readFile(new URL(asset.modelUrl)), json=gunzipSync(compressed)
      assert(compressed.length<json.length/2, 'Model compression ineffective')
      const model=JSON.parse(json.toString('utf8'))
      assert(model.geometries.length>10)
      const maps=Object.values(asset.materials).filter(material=>material.albedo)
      assert(maps.length>3,'Missing original material maps')
      assert(Object.values(asset.materials).filter(material=>material.shading).length>3)
      for(const material of maps) {
        const png=readPNG(await readFile(new URL(material.albedo!)))
        assert(png.width>0 && png.height>0 && png.width<=1024 && png.height<=1024)
      }
      assert.strictEqual(await store.get(name),asset,'Preview memoization failed')
      console.log(name+': '+model.geometries.length+' surfaces, '+maps.length+' original textures, '+Math.round((await stat(new URL(asset.modelUrl))).size/json.length*100)+'% compressed size')
    }
  } finally { await rm(temporary,{recursive:true,force:true}) }
}
void main().catch(error=>{console.error(error);process.exitCode=1})
