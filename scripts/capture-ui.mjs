import { writeFile } from 'node:fs/promises'
const target = (await fetch('http://127.0.0.1:9335/json').then(r=>r.json())).find(t=>t.type==='page')
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r=>socket.addEventListener('open',r,{once:true}))
const pending = new Map(); let sequence=0
socket.addEventListener('message',event=>{const item=JSON.parse(event.data); if(item.id) {pending.get(item.id)?.(item.result);pending.delete(item.id)}})
const call=(method,params={})=>new Promise(resolve=>{const id=++sequence;pending.set(id,resolve);socket.send(JSON.stringify({id,method,params}))})
if(process.argv[2]) console.log(JSON.stringify(await call('Runtime.evaluate',{expression:process.argv[2],returnByValue:true,awaitPromise:true})))
await call('Emulation.setFocusEmulationEnabled',{enabled:true}); await call('Page.bringToFront')
const shot=await call('Page.captureScreenshot',{format:'png'})
await writeFile('D:/roadcraft/out/qa-ui/inspect-current.png',Buffer.from(shot.data,'base64'))
socket.close()
