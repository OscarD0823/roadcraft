import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function testOptionalUpdates({ evaluate, call, output }) {
  const settle = () => evaluate('new Promise(r=>{const timer=setTimeout(r,150);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);r()}))})')
  await evaluate(`document.querySelector('[data-update-open]').click()`); await settle()
  const initial = await evaluate(`(()=>{
    const panel=document.querySelector('[data-update-dialog]');
    return {open:panel.open,text:panel.textContent,download:!!panel.querySelector('[data-update-download]'),
      disabled:panel.querySelector('[data-update-check]').disabled,
      status:panel.querySelector('[data-update-status]').textContent.trim()};
  })()`)
  assert(initial.open); assert.equal(initial.download,false); assert.equal(initial.disabled,false)
  assert.match(initial.status,/cuando quieras|whenever you want/)
  assert.match(initial.text,/No se descargará ni instalará|Nothing is downloaded or installed/)
  const layouts=[]
  for(const [width,height] of [[600,520],[960,620],[1366,768],[600,360]]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await settle()
    const state=await evaluate(`(()=>{
      const panel=document.querySelector('[data-update-dialog]');
      const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom}};
      return {box:rect(panel),overflow:panel.scrollWidth>panel.clientWidth,
        controls:[...panel.querySelectorAll('button')].map(rect)};
    })()`)
    assert.equal(state.overflow,false)
    assert(state.box.x>=0&&state.box.y>=0&&state.box.right<=width+1&&state.box.bottom<=height+1)
    assert(state.controls.every(box=>box.x>=0&&box.y>=0&&box.right<=width+1&&box.bottom<=height+1),
      'Update controls outside the viewport: '+JSON.stringify(state))
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
    await writeFile(join(output,'optional-updates-'+width+'x'+height+'.png'),Buffer.from(shot.data,'base64'))
    layouts.push({width,height,...state})
  }
  await evaluate(`(()=>{document.querySelector('[data-update-check]').click();document.querySelector('[data-update-later]').click()})()`)
  await settle()
  assert.equal(await evaluate(`document.querySelector('[data-update-dialog]').open`),false)
  await evaluate(`document.querySelector('[data-update-open]').click()`); await settle()
  assert.equal(await evaluate(`document.querySelector('[data-update-check]').disabled`),false)
  await evaluate(`document.querySelector('[data-update-check]').click()`)
  for(let attempt=0;attempt<180;attempt++) {
    if(!await evaluate(`document.querySelector('[data-update-check]').disabled`))break
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  const checked=await evaluate(`(()=>{
    const panel=document.querySelector('[data-update-dialog]');
    return {open:panel.open,checking:panel.querySelector('[data-update-check]').disabled,
      status:panel.querySelector('[data-update-status]').textContent.trim(),
      download:!!panel.querySelector('[data-update-download]'),
      error:panel.querySelector('[data-update-status]').classList.contains('update-status--error')};
  })()`)
  assert.equal(checked.checking,false,'Optional check did not restore the controls');assert(checked.open)
  assert.match(checked.status,/versión|version|comprobar|checked/)
  await evaluate(`document.querySelector('[data-update-later]').click()`); await settle()
  assert.equal(await evaluate(`document.querySelector('[data-update-dialog]').open`),false)
  assert(await evaluate(`!!document.querySelector('.topbar')`),'Keep this version closed the app')
  await call('Emulation.clearDeviceMetricsOverride')
  await writeFile(join(output,'optional-updates-results.json'),JSON.stringify({initial,layouts,checked},null,2))
  return {initial,layouts,checked}
}
