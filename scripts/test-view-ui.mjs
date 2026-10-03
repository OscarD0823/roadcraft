import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const root = dirname(dirname(fileURLToPath(import.meta.url))), output = join(root, '.vite', 'view-ui'), port = 9335
await mkdir(output, { recursive: true })
const child = spawn(process.env.ROADCRAFT_APP_EXE ?? join(root, 'out', 'RoadCraft Studio-win32-x64', 'RoadCraft Studio.exe'), [`--remote-debugging-port=${port}`, `--user-data-dir=${join(output, 'data')}`], { stdio:'ignore', windowsHide:true, env: { ...process.env, ROADCRAFT_DATA_ROOT: join(output, 'data') } })
let socket
try {
  let target
  for (let i = 0; i < 120; i++) {
    try { target = (await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json())).find(t=>t.type==='page'); if (target) break } catch {}
    await new Promise(r=>setTimeout(r,200))
  }
  if (!target) throw new Error('App did not start')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map(), errors = [], warnings = []
  let sequence=0
  socket.addEventListener('message', event=>{
    const item = JSON.parse(event.data)
    if (!item.id) {
      if (item.method==='Runtime.exceptionThrown') errors.push(item.params.exceptionDetails.text)
      if (item.method==='Runtime.consoleAPICalled' && item.params.type==='warning') warnings.push(item.params.args.map(a=>a.value??a.description).join(' '))
      return
    }
    const request=pending.get(item.id); pending.delete(item.id)
    if(item.error) request?.reject(new Error(item.error.message)); else request?.resolve(item.result)
  })
  await new Promise(r=>socket.addEventListener('open',r,{once:true}))
  const call = (method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
  const evaluate = async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value}
  const wait = async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,200))}throw new Error('UI wait timed out: '+expression+' '+warnings.join('; '))}
  await call('Runtime.enable'); await call('Page.enable')
  await wait('document.querySelectorAll(".content-card").length > 80')
  const counts=await evaluate('({cards:document.querySelectorAll(".content-card").length,animation:!!document.querySelector(".workspace-journey .journey-convoy")})')
  assert.ok(counts.animation)
  const scan=await evaluate('window.roadcraft.scan()')
  const all=scan.entries, images=[]
  // Read every cover independently of lazy loading. No game or save writes.
  for(const entry of all){
    if(!entry.imageUrl){images.push({id:entry.id,name:entry.name,kind:entry.kind,image:false});continue}
    const image=await evaluate(`new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>resolve(null);image.src=${JSON.stringify(entry.imageUrl)}})`)
    assert.ok(image, 'Broken cover '+entry.internalName)
    images.push({id:entry.id,name:entry.name,kind:entry.kind,image})
  }
  for (const width of [600,960,1366]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:620,deviceScaleFactor:1,mobile:false})
    if(await evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error('Horizontal overflow at '+width)
  }
  await evaluate('document.querySelector(".content-card").click()')
  await wait('document.querySelector(".vehicle-drive")?.dataset.modelState === "cover"')
  const base=await evaluate('({state:document.querySelector(".vehicle-drive").dataset.modelState,cover:!!document.querySelector(".drive-cover img")?.naturalWidth})')
  let shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'base-cover.png'),Buffer.from(shot.data,'base64'))
  const found=await evaluate('(()=>{const c=[...document.querySelectorAll(".content-card")].find(c=>c.textContent.includes("aramatsu_crayfish_wood_grapple_mod.bro"));c?.click();return !!c})()')
  if(!found)throw new Error('Missing official FBX source vehicle')
  await wait('document.querySelector(".vehicle-drive")?.dataset.modelState === "ready"')
  await new Promise(r=>setTimeout(r,1000))
  shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'source-fbx.png'),Buffer.from(shot.data,'base64'))
  const source=await evaluate('({state:document.querySelector(".vehicle-drive").dataset.modelState,canvas:!!document.querySelector(".drive-scene canvas"),title:document.querySelector(".inspector h2").textContent})')
  const asset=await evaluate(`window.roadcraft.getPreview(${JSON.stringify(all.find(e=>e.internalName==='aramatsu_crayfish_wood_grapple_mod').id)})`)
  assert.equal(asset.modelImportScale,100);assert.equal(asset.wheelImportScale,100);assert.equal(asset.wheelScale,.67)
  const layout=[]
  for(const [width,height] of [[600,520],[960,620],[1366,768]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await new Promise(r=>setTimeout(r,250))
    const result=await evaluate(`(()=>{const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};const scene=document.querySelector('.drive-scene'), scroll=document.querySelector('.settings-scroll');return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,preview:rect('.vehicle-preview'),settings:rect('.inspector-settings'),scene:rect('.drive-scene'),footer:rect('.inspector__footer'),settingsOverflow:scroll.scrollWidth>scroll.clientWidth,dataset:{...scene.dataset}}})()`)
    assert.equal(result.overflow,false);assert.equal(result.settingsOverflow,false)
    assert.ok(result.preview.right<=result.settings.x+.5, 'Viewer not alongside settings')
    assert.ok(result.scene.height>=90 && result.footer.bottom<=height)
    assert.equal(result.dataset.framed,'true', 'Source model clipped at '+width)
    assert.equal(result.dataset.wheels,'8');assert.equal(result.dataset.wheelScale,'0.67')
    assert.ok(Number(result.dataset.shadingMaps)>=3)
    await evaluate(`(()=>{const input=document.querySelector('.settings-scroll input[type=number]');input.value='123';input.dispatchEvent(new Event('input',{bubbles:true}));window.qaCanvas=document.querySelector('.drive-scene canvas');document.querySelector('.settings-scroll').scrollTop=10000})()`)
    const after=await evaluate(`({value:document.querySelector('.settings-scroll input[type=number]').value,sameCanvas:window.qaCanvas===document.querySelector('.drive-scene canvas'),y:document.querySelector('.drive-scene').getBoundingClientRect().y})`)
    assert.equal(after.value,'123');assert.equal(after.sameCanvas,true);assert.equal(after.y,result.scene.y)
    await evaluate(`(()=>{const select=document.querySelector('.drive-tools select');select.value='asphalt';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.fit-camera').click();document.querySelector('.drive-tools button').click();document.querySelector('.settings-scroll').scrollTop=0})()`)
    assert.equal(await evaluate(`document.querySelector('.settings-scroll input[type=number]').value`),'123')
    shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'source-'+width+'.png'),Buffer.from(shot.data,'base64'))
    layout.push(result)
  }
  const previews=[]
  if(process.env.ROADCRAFT_ALL_ENTRIES==='1'){
    await evaluate(`document.querySelectorAll('.nav-button')[0].click()`)
    for(const entry of all){
      await evaluate(`(()=>{document.querySelector('.inspector__header button')?.click();const card=[...document.querySelectorAll('.content-card')].find(c=>c.textContent.includes(${JSON.stringify(entry.relativePath)}));if(!card)throw new Error('Missing catalog card');card.click()})()`)
      await wait(`['ready','cover'].includes(document.querySelector('.vehicle-drive')?.dataset.modelState)`)
      const preview=await evaluate(`({name:document.querySelector('.inspector h2').textContent,state:document.querySelector('.vehicle-drive').dataset.modelState,image:document.querySelector('.drive-cover img')?.complete && document.querySelector('.drive-cover img')?.naturalWidth>0})`)
      if(entry.imageUrl && preview.state==='cover') await wait(`document.querySelector('.drive-cover img')?.naturalWidth>0`)
      previews.push({id:entry.id,...preview})
    }
  }
  const classification={}
  for(const [index,kind] of [[1,'truck'],[2,'trailer'],[3,'ai']]){
    await evaluate(`document.querySelectorAll('.nav-button')[${index}].click()`)
    const cards=await evaluate(`document.querySelectorAll('.content-card').length`)
    const expected=all.filter(e=>e.kind===kind).length
    assert.equal(cards,expected, 'Wrong '+kind+' section');classification[kind]=cards
    assert.equal(await evaluate(`!!document.querySelector('.vehicle-drive')`),false)
  }
  const languages=[]
  await evaluate(`document.querySelectorAll('.nav-button')[1].click();document.querySelector('.content-card').click()`)
  await call('Emulation.setDeviceMetricsOverride',{width:600,height:520,deviceScaleFactor:1,mobile:false})
  for(const locale of await evaluate(`[...document.querySelector('.language-select select').options].map(o=>o.value)`)){
    await evaluate(`(()=>{const select=document.querySelector('.language-select select');select.value=${JSON.stringify(locale)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await new Promise(r=>setTimeout(r,100))
    const result=await evaluate(`({locale:document.querySelector('.language-select select').value,overflow:document.documentElement.scrollWidth>innerWidth,settingsOverflow:document.querySelector('.settings-scroll').scrollWidth>document.querySelector('.settings-scroll').clientWidth,languageRight:document.querySelector('.language-select').getBoundingClientRect().right})`)
    assert.equal(result.overflow,false,locale+' layout overflow');assert.equal(result.settingsOverflow,false,locale+' field overflow');assert.ok(result.languageRight<=600)
    languages.push(result.locale)
  }
  await evaluate(`(()=>{const select=document.querySelector('.language-select select');select.value='es';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  if(errors.length)throw new Error(errors.join('\n'))
  const result={counts,base,source,layout,classification,images,previews,languages,errors,warnings};await writeFile(join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({counts,base,source,layout,classification,images:images.length,missingImages:images.filter(i=>!i.image).map(i=>i.name),previews:previews.length,languages,errors,warnings},null,2))
} finally {socket?.close();child.kill()}
