import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(dirname(fileURLToPath(import.meta.url))), output = join(root, '.vite', 'view-ui'), port = 9335
await mkdir(output, { recursive: true })
const child = spawn(join(root, 'out', 'RoadCraft Studio-win32-x64', 'RoadCraft Studio.exe'), [`--remote-debugging-port=${port}`, `--user-data-dir=${join(output, 'data')}`], { stdio:'ignore', windowsHide:true, env: { ...process.env, ROADCRAFT_DATA_ROOT: join(output, 'data') } })
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
  const evaluate = async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value
  const wait = async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,200))}throw new Error('UI wait timed out: '+expression+' '+warnings.join('; '))}
  await call('Runtime.enable'); await call('Page.enable')
  await wait('document.querySelectorAll(".content-card").length > 80')
  const counts=await evaluate('({cards:document.querySelectorAll(".content-card").length,animation:!!document.querySelector(".workspace-journey .journey-convoy")})')
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
  if(errors.length)throw new Error(errors.join('\n'))
  const result={counts,base,source,errors,warnings};await writeFile(join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
} finally {socket?.close();child.kill()}
