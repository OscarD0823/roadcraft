import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function testVehicleIcon({ evaluate, call, output, game = 'snowrunner' }) {
  const road = game === 'roadcraft'
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const expected = createHash('sha256').update(await readFile(join(root, road ? 'src/assets/app-icon.png' : 'src/images/app-icon.png'))).digest('hex')
  const selector = road ? '.brand__icon' : '.brand-mark img'
  const state = await evaluate(`(async()=>{
    const icon=document.querySelector(${JSON.stringify(selector)});
    if(!icon)throw new Error('Missing vehicle identity');
    await icon.decode();
    const source=icon.currentSrc||icon.src;
    const data=await (await fetch(source)).arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
    const ctx=canvas.getContext('2d');ctx.drawImage(icon,0,0,32,32);
    const pixels=ctx.getImageData(0,0,32,32).data;
    const style=getComputedStyle(icon),rect=icon.getBoundingClientRect();
    const journey=document.querySelector('.startup-journey image');
    return {hash,source,width:icon.naturalWidth,height:icon.naturalHeight,visible:rect.width>0&&rect.height>0,
      transparent:pixels[3]===0&&pixels[pixels.length-1]===0,objectFit:style.objectFit,borderRadius:style.borderRadius,
      animationSource:journey?.getAttribute('href')};
  })()`)
  assert.equal(state.hash, expected, 'Renderer loads stale emblem instead of vehicle icon')
  assert.equal(state.width, 512); assert.equal(state.height, 512)
  assert.equal(state.visible, true); assert.equal(state.transparent, true)
  assert.equal(state.objectFit, 'contain'); assert.equal(state.borderRadius, '0px', 'Vehicle silhouette is clipped by a badge mask')
  assert.equal(state.animationSource, state.source, 'Startup animation uses a different icon')
  await call('Emulation.setDeviceMetricsOverride', {width:1000,height:900,deviceScaleFactor:1,mobile:false})
  await evaluate(`(async()=>{
    const sheet=document.createElement('section');sheet.id='qa-vehicle-icon-sheet';
    sheet.style.cssText='position:fixed;inset:0;z-index:99999;background:#14212c;color:#f1f5f9;padding:28px;font:15px Segoe UI;overflow:auto;box-sizing:border-box';
    const title=document.createElement('h1');title.textContent=${JSON.stringify(road?'RoadCraft Studio':'SnowRunner Studio')};sheet.append(title);
    for(const [background,color] of [['#f3f5f7','#18212f'],['#0b1220','#f1f5f9']]){
      const row=document.createElement('div');row.style.cssText='display:flex;gap:16px;align-items:end;margin:12px 0;padding:18px;border-radius:12px;background:'+background+';color:'+color;
      for(const size of [16,24,32,48,64,128,256]){
        const item=document.createElement('div'),image=new Image(),label=document.createElement('div');
        image.src=${JSON.stringify(state.source)};image.width=image.height=size;image.style.objectFit='contain';await image.decode();
        label.textContent=size+' px';label.style.cssText='margin-top:8px;font-size:12px;text-align:center';
        item.append(image,label);row.append(item);
      }
      sheet.append(row);
    }
    document.body.append(sheet);
  })()`)
  try {
    const screenshot = await call('Page.captureScreenshot', {format:'png',captureBeyondViewport:false})
    await writeFile(join(output,'vehicle-icon-sizes.png'),Buffer.from(screenshot.data,'base64'))
  } finally {await evaluate("document.querySelector('#qa-vehicle-icon-sheet')?.remove()")}
  await writeFile(join(output,'vehicle-icon-results.json'),JSON.stringify(state,null,2))
  return state
}

