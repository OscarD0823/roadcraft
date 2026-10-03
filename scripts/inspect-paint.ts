import { readFile, mkdir } from 'node:fs/promises'
import { CompiledPreviewStore } from '../src/main/compiled-preview'
import { readPNG } from 'tex-decoder'
async function main(){
 const store=new CompiledPreviewStore('E:/SteamLibrary/steamapps/common/RoadCraft','out/qa-appearance-cache')
 const asset=await store.get('aramatsu_bowhead_30t');console.log('PAINT COLOR',await store.paintColor('customization_material_00'))
 await mkdir('out/qa-appearance',{recursive:true})
 for(const [name,m] of Object.entries(asset!.materials).filter(([n])=>/cabine.*mat0|bucket|chassis/.test(n))) {
  console.log(name,m)
  for(const [kind,url] of Object.entries({albedo:m.albedo,mask:m.tintMask}))if(url){
   const png=readPNG(await readFile(new URL(url)))
   console.log(kind,{size:[png.width,png.height],url})
  }
 }
}
void main().catch(error=>{console.error(error);process.exitCode=1})
