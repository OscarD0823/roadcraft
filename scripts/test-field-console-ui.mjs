import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Reads the real UI in an isolated app profile. Never presses Save or writes a game file.
export async function testFieldConsole({ evaluate, call, output, game = 'snowrunner' }) {
  const road = game === 'roadcraft', results = { game, editor: null }
  const nav = road ? '.primary-nav .nav-button' : '.workspace-navigation__item'
  const settle = () => evaluate('new Promise(r=>setTimeout(r,180))')
  const wait = async (expression, attempts = 180) => {
    for (let i = 0; i < attempts; i++) {
      if (await evaluate(expression)) return
      await new Promise(r => setTimeout(r,250))
    }
    throw new Error('Field console did not load: ' + expression)
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false})
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
  await call('DOM.enable'); await call('CSS.enable')
  const documentNode = await call('DOM.getDocument')
  const {nodeId} = await call('DOM.querySelector',{nodeId:documentNode.root.nodeId,selector:nav})
  await call('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']})
  await settle()
  results.hover = await evaluate(`(()=>{
    const el=document.querySelector(${JSON.stringify(nav)}),s=getComputedStyle(el);
    const shell=document.querySelector('${road ? '.app-frame' : '#studio-console'}');
    return {text:el.textContent.trim(),color:s.color,opacity:s.opacity,visibility:s.visibility,radius:s.borderRadius,accent:getComputedStyle(shell).getPropertyValue('--field-accent').trim()};
  })()`)
  assert(results.hover.text && results.hover.color !== 'rgba(0, 0, 0, 0)' && results.hover.opacity === '1' && results.hover.visibility === 'visible','Hover hides navigation')
  assert(results.hover.radius.includes(' '),'Material panel shape is missing')
  assert(results.hover.accent,'Field design tokens missing')
  await call('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['focus-visible']})
  results.focus = await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(nav)})).outlineStyle`)
  assert.notEqual(results.focus,'none','Keyboard focus is invisible')
  await call('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]})

  results.visibility = await evaluate(`(()=>{
    const own=Object.getOwnPropertyDescriptor(document,'hidden');
    try {
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
      const marker=document.documentElement.dataset.appHidden;
      const animations=document.querySelector('.workspace-journey svg').getAnimations({subtree:true});
      return {marker,count:animations.length,states:animations.map(a=>a.playState)};
    } finally {
      if(own) Object.defineProperty(document,'hidden',own); else delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    }
  })()`)
  assert.equal(results.visibility.marker,'true')
  assert(results.visibility.count>0 && results.visibility.states.every(s=>s==='paused'),'Hidden header still animates')
  assert.equal(await evaluate('document.documentElement.dataset.appHidden'),await evaluate('String(document.hidden)'))

  const card = road ? '.content-card' : '.card-container .card'
  if (await evaluate(`document.querySelectorAll('${card}').length`)) {
    if (road) await evaluate(`document.querySelector('[data-view="truck"]').click()`)
    await evaluate(`document.querySelector('${card}').click()`)
    const preview = '.vehicle-preview', settings = road ? '.inspector-settings' : '#editor-settings-panel'
    await wait(`document.querySelector('${settings}') && document.querySelector('${preview}')`)
    if (!road) {
      await wait("document.querySelectorAll('.table > .collapse > .ant-collapse-item').length>1")
      await evaluate("document.querySelectorAll('.table > .collapse > .ant-collapse-item')[1].querySelector('.ant-collapse-header').click()")
    }
    const preset = road ? '.recommendations button' : '.table .recommendations .ant-btn'
    await wait(`document.querySelector('${preset}')`)
    await wait("document.querySelector('.vehicle-preview [data-model-state]')?.dataset.modelState !== 'loading'",720)
    results.previewState = await evaluate("document.querySelector('.vehicle-preview [data-model-state]')?.dataset.modelState")
    const layouts = []
    for (const width of [600,960,1366]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:700,deviceScaleFactor:1,mobile:false})
      await settle()
      const layout = await evaluate(`(()=>{
        const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
        const panel=document.querySelector('${settings}'), btns=[...panel.querySelectorAll('${preset}')];
        return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,preview:rect('${preview}'),settings:rect('${settings}'),
          panelOverflow:panel.scrollWidth>panel.clientWidth+1,
          presets:btns.map(b=>({text:b.textContent.trim(),pressed:b.getAttribute('aria-pressed'),font:getComputedStyle(b).fontSize,width:b.getBoundingClientRect().width})),
          originals:panel.querySelectorAll('${road ? '.parameter-card__title span' : '.original-value'}').length};
      })()`)
      assert.equal(layout.overflow,false,'Editor overflows at '+width)
      assert.equal(layout.panelOverflow,false,'Settings overflow at '+width)
      assert(layout.preview.width>=175 && layout.preview.height>120,'Vehicle preview is not usable')
      assert(layout.preview.right<=layout.settings.x+1,'Preview overlaps settings')
      assert(layout.settings.right<=width+1 && layout.settings.width>275 && layout.settings.height>180,'Settings are cramped: '+JSON.stringify(layout))
      assert(layout.originals>0 && layout.presets.every(p=>p.text && ['true','false'].includes(p.pressed)),'Value guide or accessible preset state missing')
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
      await writeFile(join(output,'field-editor-'+width+'.png'),Buffer.from(shot.data,'base64'))
      layouts.push(layout)
    }
    results.editor=layouts
    await evaluate(road ? "document.querySelector('.inspector__header .button').click();document.querySelector('[data-view=\"all\"]').click()" : "document.querySelector('[data-editor-view] .ant-page-header-back-button').click()")
    await wait(road ? "!document.querySelector('.inspector')" : "!document.querySelector('#editor-settings-panel')")
  } else {
    results.editor={skipped:'Game catalogue unavailable on this host; no substitute models used.'}
  }
  await call('Emulation.clearDeviceMetricsOverride')
  await writeFile(join(output,'field-console-results.json'),JSON.stringify(results,null,2))
  return results
}

