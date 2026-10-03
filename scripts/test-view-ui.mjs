import { spawn, execFile } from 'node:child_process'
import { mkdir, writeFile, cp, readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { createWriteStream } from 'node:fs'
const root = dirname(dirname(fileURLToPath(import.meta.url))), output = join(root, 'out', 'qa-ui'), port = 9335
await mkdir(output, { recursive: true })
// Preserve this isolated cache across Vite builds; never use the user's settings.
const previous = join(root,'.vite','view-ui','data'), dataRoot=join(output,'data')
try {await readFile(join(dataRoot,'settings.json'))}catch{
  try{
    await cp(previous,dataRoot,{recursive:true})
    const settings=JSON.parse(await readFile(join(dataRoot,'settings.json'),'utf8'))
    for(const [key,path] of Object.entries(settings.automaticImages??{})) if(path.startsWith(previous)) settings.automaticImages[key]=dataRoot+path.slice(previous.length)
    await writeFile(join(dataRoot,'settings.json'),JSON.stringify(settings,null,2))
  }catch{}
}
const log=createWriteStream(join(output,'application.log'))
const child = spawn(process.env.ROADCRAFT_APP_EXE ?? join(root, 'out', 'RoadCraft Studio-win32-x64', 'RoadCraft Studio.exe'), [`--remote-debugging-port=${port}`, `--user-data-dir=${join(output, 'data')}`], { stdio:['ignore','pipe','pipe'], windowsHide:false, env: { ...process.env, ROADCRAFT_DATA_ROOT: join(output, 'data') } })
child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false})
child.on('exit',(code,signal)=>{if(!log.writableEnded)log.end(`\nApplication exit: ${code} ${signal}\n`)})
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
  socket.addEventListener('close',()=>{for(const request of pending.values())request.reject(new Error('Application debugging connection closed; inspect out/qa-ui/application.log'));pending.clear()})
  await new Promise(r=>socket.addEventListener('open',r,{once:true}))
  const call = (method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
  const evaluate = async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value}
  const wait = async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,200))}throw new Error('UI wait timed out: '+expression+' '+warnings.join('; '))}
  await call('Runtime.enable'); await call('Page.enable')
  // An occluded native window otherwise suspends its animation frames during QA.
  await call('Emulation.setFocusEmulationEnabled',{enabled:true})
  await call('Page.bringToFront')
  await wait('document.querySelectorAll(".content-card").length > 80')
  const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-Process -Id ${child.pid} | ForEach-Object { [pscustomobject]@{Visible=($_.MainWindowHandle -ne 0);Title=$_.MainWindowTitle} } | ConvertTo-Json -Compress`],{windowsHide:true})
  const nativeWindow=JSON.parse(stdout.trim())
  assert.equal(nativeWindow.Visible,true,'Application loaded but its Windows window stayed hidden')
  assert.equal(nativeWindow.Title,'RoadCraft Studio')
  const counts=await evaluate('({cards:document.querySelectorAll(".content-card").length,animation:document.querySelectorAll(".workspace-journey [data-machine]").length===6})')
  assert.ok(counts.animation)
  const animation=[]
  for(const [fraction,expected] of [[.05,['scout']],[.19,['scout','dump']],[.35,['scout','dozer']],[.51,['scout','paver']],[.67,['scout','roller']],[.82,['scout','cargo']],[.92,['scout']]]){
    await evaluate(`document.querySelectorAll('.workspace-journey .machine,.workspace-journey .road-progress').forEach(node=>node.getAnimations().forEach(a=>{a.pause();a.currentTime=28000*${fraction}}))`)
    await new Promise(r=>setTimeout(r,50))
    const visible=await evaluate(`[...document.querySelectorAll('.workspace-journey [data-machine]')].filter(n=>Number(getComputedStyle(n).opacity)>.8).map(n=>n.dataset.machine)`)
    assert.deepEqual(visible,expected,'Wrong construction stage at '+fraction)
    animation.push({fraction,visible})
  }
  await evaluate(`document.querySelectorAll('.workspace-journey .machine,.workspace-journey .road-progress').forEach(node=>node.getAnimations().forEach(a=>a.play()))`)
  const scan=await evaluate('window.roadcraft.scan()')
  const all=scan.entries, images=[]
  assert.equal(all.find(e=>e.sourceType==='bro' && e.kind==='other')?.access?.control,'unknown','A source resource is not a player vehicle')
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
  await wait('["cover","ready"].includes(document.querySelector(".vehicle-drive")?.dataset.modelState)')
  const base=await evaluate('({state:document.querySelector(".vehicle-drive").dataset.modelState,cover:!!document.querySelector(".drive-cover img")?.naturalWidth})')
  assert.equal(base.state,'ready','Native TPL model must replace the cover')
  let shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'base-cover.png'),Buffer.from(shot.data,'base64'))
  const found=await evaluate('(()=>{document.querySelector(".inspector__header button")?.click();const c=[...document.querySelectorAll(".content-card")].find(c=>c.textContent.includes("aramatsu_crayfish_wood_grapple_mod.bro"));c?.click();return !!c})()')
  if(!found)throw new Error('Missing official FBX source vehicle')
  await wait('document.querySelector(".vehicle-drive")?.dataset.modelState === "ready"')
  await wait('!!document.querySelector(".drive-scene")?.dataset.frame')
  await new Promise(r=>setTimeout(r,1000))
  shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'source-fbx.png'),Buffer.from(shot.data,'base64'))
  const source=await evaluate('({state:document.querySelector(".vehicle-drive").dataset.modelState,canvas:!!document.querySelector(".drive-scene canvas"),title:document.querySelector(".inspector h2").textContent})')
  const asset=await evaluate(`window.roadcraft.getPreview(${JSON.stringify(all.find(e=>e.internalName==='aramatsu_crayfish_wood_grapple_mod').id)})`)
  assert.equal(asset.modelImportScale,100);assert.equal(asset.wheelImportScale,100);assert.equal(asset.wheelScale,.67)
  const layout=[]
  await evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))')
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
    assert.equal(after.value,'123');assert.equal(after.sameCanvas,true);assert.ok(Math.abs(after.y-result.scene.y)<10,'Settings scrolling displaced the viewer')
    await evaluate(`(()=>{const select=document.querySelector('.drive-tools select');select.value='asphalt';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.fit-camera').click();document.querySelector('.drive-tools button').click();document.querySelector('.settings-scroll').scrollTop=0})()`)
    assert.equal(await evaluate(`document.querySelector('.settings-scroll input[type=number]').value`),'123')
    const categories=await evaluate(`document.querySelectorAll('.parameter-tabs button').length`)
    assert.ok(categories>1,'Parameters must have categories')
    await evaluate(`document.querySelectorAll('.parameter-tabs button')[1].click()`)
    assert.equal(await evaluate(`document.querySelectorAll('.parameter-group').length`),1,'Only the selected category must be visible')
    await evaluate(`document.querySelectorAll('.parameter-tabs button')[0].click()`)
    assert.equal(await evaluate(`document.querySelector('.settings-scroll input[type=number]').value`),'123','Category switch lost pending edits')
    shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'source-'+width+'.png'),Buffer.from(shot.data,'base64'))
    layout.push(result)
  }
  const previews=[]
  {
    const selected=process.env.ROADCRAFT_ALL_ENTRIES==='1' ? all : all.filter(e=>e.relativePath.endsWith('tuz_119lynx_mod.bro') || [
      'auto_aramatsu_bowhead_heavy_dumptruck_new','auto_don_71','auto_dragline_5111b_building_demolisher_old',
      'auto_n_and_s_700s_tower_crane','auto_n_and_s_loader20g_crane_grabber','auto_n_and_s_260gantry_crane_railroad',
      'auto_wayfarer_st7050_cargo_main','auto_wayfarer_st7050_trailer_cargo_ai','auto_base_alces_c400_cargo_res'
      ,'auto_greenway_ht500_dozer_new','auto_zikz_612c_heavy_crane_res','auto_base_zikz_612c_heavy_crane_res'
    ].includes(e.internalName))
    await evaluate(`document.querySelectorAll('.nav-button')[0].click()`)
    for(const entry of selected){
      await evaluate(`(()=>{document.querySelector('.inspector__header button')?.click();const card=[...document.querySelectorAll('.content-card')].find(c=>c.textContent.includes(${JSON.stringify(entry.relativePath)}));if(!card)throw new Error('Missing catalog card');card.click()})()`)
      await wait(`['ready','cover'].includes(document.querySelector('.vehicle-drive')?.dataset.modelState)`)
      const preview=await evaluate(`({name:document.querySelector('.inspector h2').textContent,state:document.querySelector('.vehicle-drive').dataset.modelState,image:document.querySelector('.drive-cover img')?.complete && document.querySelector('.drive-cover img')?.naturalWidth>0,dataset:{...document.querySelector('.drive-scene').dataset},categories:document.querySelectorAll('.parameter-tabs button').length})`)
      assert.equal(!!preview.image,false,'A cover must never replace the 3D view automatically')
      if(entry.kind!=='other') assert.equal(preview.state,'ready','Missing 3D model '+entry.internalName)
      if(preview.state==='ready') await wait(`!!document.querySelector('.drive-scene')?.dataset.frame`)
      if(preview.state==='ready' && entry.kind!=='other') {
        await new Promise(r=>setTimeout(r,600))
        const drift=await evaluate(`Number(document.querySelector('.drive-scene')?.dataset.wheelAxisDrift??0)`)
        assert(drift<.000001,'Wheel axle changes during rotation: '+entry.internalName)
      }
      if(process.env.ROADCRAFT_ALL_ENTRIES==='1' && preview.state==='ready') {
        const clip=await evaluate(`(()=>{const b=document.querySelector('.drive-scene').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,scale:1}})()`)
        await mkdir(join(output,'models'),{recursive:true})
        const captured=await call('Page.captureScreenshot',{format:'png',clip})
        await writeFile(join(output,'models',entry.internalName+'.png'),Buffer.from(captured.data,'base64'))
      }
      if(entry.internalName==='auto_aramatsu_bowhead_heavy_dumptruck_new'){
        assert.equal(preview.dataset.tracks,'2','Bowhead tracks missing')
        const bounds=JSON.parse(preview.dataset.bounds);assert(bounds[0]<4.5&&bounds[1]<4&&bounds[2]<10,'Bowhead proportions changed')
        assert.equal(preview.dataset.travelAxis,'z','Vehicle is travelling sideways')
        assert.ok(Number(preview.dataset.shadingMaps)>2,'Missing original Bowhead materials')
        shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'bowhead-native.png'),Buffer.from(shot.data,'base64'))
        await evaluate(`document.querySelector('.view-alternative').click()`)
        await wait(`document.querySelector('.drive-cover img')?.naturalWidth>0`)
        await evaluate(`document.querySelector('.view-alternative').click()`)
        assert.equal(await evaluate(`!!document.querySelector('.drive-cover')`),false,'Model/cover comparison did not return to 3D')
      }
      if(entry.mobility && entry.mobility!=='road') {
        assert.equal(preview.dataset.travel,'false','Fixed equipment is travelling')
        assert.equal(await evaluate(`!!document.querySelector('.mobility-tag')`),true)
        const before=await evaluate(`({...document.querySelector('.drive-scene').dataset})`)
        await new Promise(r=>setTimeout(r,500))
        const after=await evaluate(`({...document.querySelector('.drive-scene').dataset})`)
        assert.equal(before.frame,after.frame);assert.equal(before.groundMotion,after.groundMotion)
        shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,entry.internalName+'.png'),Buffer.from(shot.data,'base64'))
      }
      if(entry.internalName==='auto_greenway_ht500_dozer_new') assert(JSON.parse(preview.dataset.bounds)[1]<5,'Greenway cabin parts displaced')
      if(entry.internalName.includes('zikz_612c')) {
        shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,entry.internalName+'.png'),Buffer.from(shot.data,'base64'))
      }
      previews.push({id:entry.id,...preview})
      await writeFile(join(output,'preview-progress.json'),JSON.stringify(previews,null,2))
      console.log('Preview verified: '+entry.internalName+' '+preview.state)
    }
  }
  if(process.env.ROADCRAFT_ALL_ENTRIES==='1') {
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false})
    const ready=previews.filter(p=>p.state==='ready')
    for(let start=0;start<ready.length;start+=16) {
      const tiles=[]
      for(const item of ready.slice(start,start+16)) {
        const entry=all.find(e=>e.id===item.id)
        tiles.push({name:entry.internalName,image:'data:image/png;base64,'+(await readFile(join(output,'models',entry.internalName+'.png'))).toString('base64')})
      }
      await evaluate(`(async()=>{const sheet=document.createElement('div');sheet.id='qa-sheet';sheet.style.cssText='position:fixed;inset:0;z-index:99999;background:#15222c;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:240px;';for(const tile of ${JSON.stringify(tiles)}){const card=document.createElement('div');card.style.cssText='padding:8px;color:white;font:11px sans-serif;overflow:hidden;';const image=new Image();image.style.cssText='width:304px;height:202px;object-fit:contain';image.src=tile.image;await image.decode();card.append(image,document.createTextNode(tile.name));sheet.append(card)}document.body.append(sheet);await new Promise(r=>requestAnimationFrame(r))})()`)
      const sheet=await call('Page.captureScreenshot',{format:'png'})
      await writeFile(join(output,'model-contact-'+String(start/16+1).padStart(2,'0')+'.png'),Buffer.from(sheet.data,'base64'))
      await evaluate(`document.querySelector('#qa-sheet').remove()`)
    }
  }
  const classification={}
  for(const [index,kind] of [[1,'truck'],[2,'trailer'],[3,'ai']]){
    await evaluate(`document.querySelectorAll('.nav-button')[${index}].click()`)
    const cards=await evaluate(`document.querySelectorAll('.content-card').length`)
    const expected=all.filter(e=>kind==='ai' ? e.access?.logistics?.length : e.kind===kind).length
    assert.equal(cards,expected, 'Wrong '+kind+' section');classification[kind]=cards
    assert.equal(await evaluate(`!!document.querySelector('.vehicle-drive')`),false)
  }
  assert.equal(classification.ai,22,'Only confirmed delivery/test configurations belong in Logistics')
  await evaluate(`document.querySelectorAll('.nav-button')[3].click()`)
  assert.match(await evaluate(`document.querySelector('.library-note').textContent`),/A → B/)
  const shared=all.find(e=>e.access?.control==='shared')
  assert(shared,'Missing shared player/logistics configuration')
  await evaluate(`(()=>{const cards=[...document.querySelectorAll('.content-card')];cards.find(card=>card.textContent.includes(${JSON.stringify(shared.relativePath)})).click()})()`)
  await wait(`document.querySelector('.vehicle-drive')?.dataset.modelState === 'ready'`)
  assert.match(await evaluate(`document.querySelector('.access-notice').textContent`),/los cambios afectan a los dos usos/)
  await evaluate(`document.querySelector('.logistics-evidence').open=true`)
  assert.ok(await evaluate(`document.querySelectorAll('.logistics-evidence li').length > 0`))
  shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'logistics-shared.png'),Buffer.from(shot.data,'base64'))
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
  const result={nativeWindow,counts,animation,base,source,layout,classification,images,previews,languages,errors,warnings};await writeFile(join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({nativeWindow,counts,animation,base,source,layout,classification,images:images.length,missingImages:images.filter(i=>!i.image).map(i=>i.name),previews:previews.length,languages,errors,warnings},null,2))
} finally {socket?.close();child.kill()}
