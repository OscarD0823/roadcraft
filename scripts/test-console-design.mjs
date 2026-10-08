import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function testConsoleDesign({ evaluate, call, output, game }) {
  const results = []
  for (const width of [600, 960, 1366]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: false })
    await evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))')
    const state = await evaluate(`(()=>{
      const brief=document.querySelector('[data-game-brief]');
      const nav=document.querySelector(${JSON.stringify(game === 'roadcraft' ? '.primary-nav' : '.workspace-navigation')});
      const content=document.querySelector(${JSON.stringify(game === 'roadcraft' ? '.content-grid' : '.list')});
      const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      return {overflow:document.documentElement.scrollWidth>innerWidth, brief:rect(brief),nav:rect(nav),content:rect(content),steps:brief.querySelectorAll('ol li').length,
        title:brief.querySelector('h1,h2').textContent, active:nav.querySelectorAll('[aria-current="page"]').length,
        labels:[...nav.querySelectorAll('button')].map(b=>({title:b.title,text:getComputedStyle(b.querySelector('span:not(.nav-button__icon)')??b).display})),
        background:getComputedStyle(document.body).backgroundColor,cardBackground:getComputedStyle(document.querySelector(${JSON.stringify(game === 'roadcraft' ? '.content-card' : '.card') })).backgroundColor};
    })()`)
    assert.equal(state.overflow, false, 'Console overflows at '+width)
    assert.equal(state.steps, 3)
    assert.equal(state.active, 1, 'Current location is not labelled')
    assert(state.content.height > 180, 'Introduction consumes the library')
    assert(state.brief.right <= width + 1 && state.content.right <= width + 1, JSON.stringify({width,...state}))
    assert(state.labels.every(item => item.title && item.text !== 'none'), 'Navigation loses its labels')
    if(width > 760) assert(state.nav.right <= state.content.x, 'Desktop navigation is not lateral')
    else assert(state.nav.bottom <= state.content.y, 'Compact navigation covers library')
    const shot=await call('Page.captureScreenshot', { format:'png', captureBeyondViewport:false })
    await writeFile(join(output, 'console-'+width+'.png'), Buffer.from(shot.data, 'base64'))
    results.push({width,...state})
  }
  await call('Emulation.setDeviceMetricsOverride', { width:600,height:520,deviceScaleFactor:1,mobile:false })
  const compact=await evaluate(`document.querySelector(${JSON.stringify(game === 'roadcraft' ? '.content-grid' : '.list')}).getBoundingClientRect().height`)
  assert(compact > 120, 'Library is unusable on a short split screen')
  await evaluate(`document.querySelectorAll('.nav-button')[6].click()`)
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  for(const width of [600,960,1366]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:700,deviceScaleFactor:1,mobile:false})
    const saveLayout=await evaluate(`(()=>{const r=document.querySelector('.save-shell').getBoundingClientRect();return {right:r.right,bottom:r.bottom,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth}})()`)
    assert.equal(saveLayout.overflow,false,'Save console overflows at '+width)
    assert(saveLayout.right<=width+1&&saveLayout.bottom<=701&&saveLayout.height>200,'Save workspace misplaced: '+JSON.stringify(saveLayout))
    const capture=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'save-console-'+width+'.png'),Buffer.from(capture.data,'base64'))
  }
  await evaluate(`document.querySelectorAll('.nav-button')[0].click()`)
  await call('Emulation.clearDeviceMetricsOverride')
  await writeFile(join(output, 'console-design-results.json'), JSON.stringify(results,null,2))
  return results
}
