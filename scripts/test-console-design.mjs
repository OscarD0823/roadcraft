import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { testVehicleIcon } from './test-vehicle-icon-ui.mjs'
import { testFieldConsole } from './test-field-console-ui.mjs'

export async function testConsoleDesign({ evaluate, call, output, game = 'snowrunner' }) {
  await testVehicleIcon({ evaluate, call, output, game })
  const results = [], road = game === 'roadcraft'
  const navSelector = road ? '.primary-nav' : '.workspace-navigation'
  const contentSelector = road ? '.content-grid, .center-state' : '.list'
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  for (const width of [600, 960, 1366]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: false })
    await evaluate('document.fonts.ready.then(()=>new Promise(r=>{const timer=setTimeout(r,150);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);r()}))}))')
    const state = await evaluate(`(()=>{
      const nav=document.querySelector(${JSON.stringify(navSelector)}),content=document.querySelector(${JSON.stringify(contentSelector)});
      const header=document.querySelector('.topbar'),identity=header.querySelector('[data-workspace-identity]'),scene=identity.querySelector('.startup-journey');
      const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      return {overflow:document.documentElement.scrollWidth>innerWidth,header:rect(header),identity:rect(identity),scene:rect(scene),nav:rect(nav),content:rect(content),
        oldPanels:document.querySelectorAll('[data-game-brief],.operation-route,.game-brief').length,
        animations:document.querySelectorAll('.startup-journey').length,insideHeader:header.contains(scene),tagline:identity.querySelector('span').textContent,
        active:nav.querySelectorAll('[aria-current="page"]').length,
        controls:[...header.querySelectorAll('button,select,[data-project-link]')].map(el=>({label:el.getAttribute('aria-label')||el.textContent.trim(),...rect(el)})).filter(r=>r.width>0&&r.height>0),
        labels:[...nav.querySelectorAll('button')].map(b=>({title:b.title,display:getComputedStyle(b.querySelector('span:not(.nav-button__icon)')??b).display}))};
    })()`)
    assert.equal(state.overflow, false, 'Console overflows at '+width)
    assert.equal(state.oldPanels, 0, 'The large introduction or numbered steps are still in the library')
    assert.equal(state.animations, 1, 'The workspace must have a single animation')
    assert.equal(state.insideHeader, true)
    assert.equal(state.active, 1)
    assert(state.tagline.trim(), 'Header identity lost its translated tagline')
    assert(state.header.height <= 70, 'Header is too tall')
    assert(state.scene.width > 32 && state.scene.width <= 170 && state.scene.height <= 45, 'Animation was not compacted: '+JSON.stringify({width,...state}))
    assert(state.scene.y >= state.header.y && state.scene.bottom <= state.header.bottom + 1, 'Animation escapes the header')
    assert(state.content.height > 180, 'Library is too small')
    assert(state.content.right <= width + 1)
    assert(state.controls.every(r=>r.x>=-1 && r.right<=width+1 && r.y>=-1 && r.bottom<=state.header.bottom+1),
      'Header controls outside viewport: '+JSON.stringify({width,...state}))
    assert(state.labels.every(item=>item.title&&item.display!=='none'), 'Navigation labels hidden')
    if(width>760) assert(state.nav.right<=state.content.x, 'Desktop sidebar missing')
    else assert(state.nav.bottom<=state.content.y, 'Compact navigation covers content')
    const shot=await call('Page.captureScreenshot', {format:'png',captureBeyondViewport:false})
    await writeFile(join(output,'console-'+width+'.png'),Buffer.from(shot.data,'base64'))
    results.push({width,...state})
  }
  await call('Emulation.setDeviceMetricsOverride',{width:600,height:520,deviceScaleFactor:1,mobile:false})
  assert(await evaluate(`document.querySelector(${JSON.stringify(contentSelector)}).getBoundingClientRect().height`) > 120, 'Short split-screen unusable')
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  assert.equal(await evaluate(`document.querySelector('.workspace-journey svg').getAnimations({subtree:true}).length`),0, 'Reduced motion must stop the header animation')
  await call('Emulation.setEmulatedMedia',{features:[]})
  if (road) {
    await evaluate(`document.querySelector('[data-view="save"]').click()`)
    await evaluate('new Promise(r=>{const timer=setTimeout(r,150);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);r()}))})')
    for (const width of [600,960,1366]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:700,deviceScaleFactor:1,mobile:false})
      const layout=await evaluate(`(()=>{const r=document.querySelector('.save-shell').getBoundingClientRect();return {right:r.right,bottom:r.bottom,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth}})()`)
      assert.equal(layout.overflow,false,'Save workspace overflows at '+width)
      assert(layout.right<=width+1&&layout.bottom<=701&&layout.height>200,'Save workspace misplaced: '+JSON.stringify(layout))
      const shot=await call('Page.captureScreenshot',{format:'png'})
      await writeFile(join(output,'save-console-'+width+'.png'),Buffer.from(shot.data,'base64'))
    }
    await evaluate(`document.querySelector('[data-view="all"]').click()`)
  }
  await call('Emulation.clearDeviceMetricsOverride')
  await testFieldConsole({evaluate,call,output,game})
  await writeFile(join(output,'console-design-results.json'),JSON.stringify(results,null,2))
  return results
}
