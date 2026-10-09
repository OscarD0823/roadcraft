import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Run against our isolated Electron renderer, never the user's open window.
export async function testJourney({ evaluate, call, output }) {
  // Windows runners may default to reduced motion; exercise both modes explicitly.
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
  const duration = await evaluate(`document.querySelector('.workspace-journey .machine').getAnimations()[0].effect.getComputedTiming().duration`)
  assert.equal(duration, 54000)
  assert.equal(await evaluate(`document.querySelectorAll('.workspace-journey .grade-clearance').length`), 2, 'Both excavator passes must remove sand mounds')
  assert.equal(await evaluate(`document.querySelectorAll('.machine--excavator .rolling-wheel').length`),0,'The excavator must use tracks, not grader wheels')
  assert.ok(await evaluate(`!!document.querySelector('.workspace-journey .scout-shoulder')`), 'Waiting scout must rest on its shoulder')
  const detailing=await evaluate(`(()=>{const n=document.querySelector('.workspace-journey');const ids=[...n.querySelectorAll('[id]')].map(n=>n.id);return {unique:ids.length===new Set(ids).size,tracks:n.querySelectorAll('.track-belt').length,particles:n.querySelectorAll('.terrain-particle').length,materials:[...new Set([...n.querySelectorAll('[data-particle-material]')].map(n=>n.dataset.particleMaterial))]}})()`)
  assert.equal(detailing.unique,true,'SVG materials must not share IDs between vehicles')
  assert.equal(detailing.tracks,3,'Each tracked model owns one reusable belt definition')
  assert.equal(await evaluate(`document.querySelectorAll('.workspace-journey use[href$="-track"]').length`),5,'Five belts must be instanced across the tracked vehicles')
  assert(detailing.particles >= 80 && detailing.particles <= 140,'Bound particle count for the compact header')
  assert.deepEqual(detailing.materials.sort(),['dust','mud','sand'])
  const seek = async fraction => {
    await evaluate(`document.querySelector('.workspace-journey svg').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=${duration * fraction}})`)
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  const state = () => evaluate(`(()=>{
    const svg=document.querySelector('.workspace-journey'), matrix=n=>new DOMMatrix(getComputedStyle(n).transform);
    const machines=[...svg.querySelectorAll('[data-machine]')].map(n=>({id:n.dataset.machine,opacity:+getComputedStyle(n).opacity,x:matrix(n).e,y:matrix(n).f,tilt:matrix(n).b}));
    const road=Object.fromEntries([...svg.querySelectorAll('.road-progress')].map(n=>[n.classList[1].replace('road-progress--',''),matrix(n).a]));
    const tracks=Object.fromEntries(['dump-1','excavator'].map(id=>[id,parseFloat(getComputedStyle(svg.querySelector('.machine--'+id+' .track-belt')).strokeDashoffset)]));
    return {machines,visible:machines.filter(n=>n.opacity>.8).map(n=>n.id),road,rough:matrix(svg.querySelector('.terrain-progress')).a,mud:+getComputedStyle(svg.querySelector('.mud-splash')).opacity,wheel:getComputedStyle(svg.querySelector('.machine--scout .rolling-wheel')).transform,bed:matrix(svg.querySelector('.machine--dump-1 .dump-bed')).b,discharge:+getComputedStyle(svg.querySelector('.machine--dump-1 .sand-discharge')).opacity,tracks,dust:+getComputedStyle(svg.querySelector('.grading-dust')).opacity};
  })()`)
  const animation = []
  const originalStyle = await evaluate(`document.querySelector('.workspace-journey').getAttribute('style')`)
  try {
    // Retain Vue's company-colour variables while enlarging the QA canvas.
    await evaluate(`document.querySelector('.workspace-journey').style.cssText+=';position:fixed;top:0;left:0;z-index:999999;width:900px;height:240px;max-width:none;flex:none;margin:0;'`)
    for (const [fraction, expected, label] of [
      [.04, ['scout'], 'piedras'], [.06, ['scout'], 'barro'],
      [.16, ['scout', 'dump-1'], 'arena-cargada-ida'], [.275, ['scout', 'dump-1'], 'arena-1-reversa'],
      [.405, ['scout', 'excavator'], 'excavadora-1'], [.465, ['scout', 'excavator'], 'excavadora-regreso'],
      [.585, ['scout', 'dump-2'], 'arena-2-normal'], [.705, ['scout', 'excavator'], 'excavadora-2'],
      [.80, ['scout', 'paver'], 'asfaltadora'], [.875, ['scout', 'roller'], 'aplanadora'],
      [.925, ['scout', 'cargo'], 'camion-final'], [.97, ['scout'], 'salida-explorador']
    ]) {
      await seek(fraction)
      const result = await state()
      assert.deepEqual(result.visible, expected, 'Wrong construction stage: ' + label)
      if (fraction < .12) {
        assert.ok(Math.abs(result.machines[0].tilt) > .02, 'Scout must follow uneven terrain')
        assert.equal(result.rough, 1)
      } else if (fraction < .94) {
        assert.equal(result.machines[0].x, 812, 'Scout left before final cargo truck')
      }
      if (label === 'barro') assert.ok(result.mud > .8, 'Missing mud splash')
      if (label === 'arena-cargada-ida') { assert.equal(result.bed,0);assert.equal(result.discharge,0);assert.equal(result.road['sand-1'],0);assert.equal(result.rough,1) }
      if (label === 'arena-1-reversa') { assert.ok(result.bed < -.3);assert.equal(result.discharge,1);assert.ok(result.road['sand-1'] > .3 && result.road['sand-1'] < .9);assert.ok(result.rough > 0 && result.rough < 1) }
      if (label === 'arena-2-normal') { assert.equal(result.road['graded-1'],1);assert.ok(result.road['sand-2'] > .3 && result.road['sand-2'] < .9);assert.equal(result.road['graded-2'],0);assert.equal(await evaluate(`getComputedStyle(document.querySelector('.machine--dump-2 .sand-discharge')).opacity`),'1') }
      if (label === 'camion-final') assert.equal(result.road.rolled, 1)
      if(label==='excavadora-regreso') assert.equal(result.dust,0,'Returning excavator must not grade twice')
      if(label==='excavadora-1' || label==='excavadora-2') assert.equal(result.dust,1,'Bucket must disturb sand while grading')
      if (label === 'salida-explorador') assert.ok(result.machines[0].x > 812)
      const shot = await call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 900, height: 240, scale: 1 } })
      await writeFile(join(output, 'journey-' + label + '.png'), Buffer.from(shot.data, 'base64'))
      animation.push({ fraction, label, ...result })
    }
    for (const [start, end, id, forward] of [[.15,.19,'dump-1',true],[.25,.29,'dump-1',false],[.39,.42,'excavator',true],[.455,.48,'excavator',false],[.56,.60,'dump-2',true]]) {
      await seek(start); const before = await state()
      await seek(end); const after = await state()
      const delta=after.machines.find(n=>n.id===id).x-before.machines.find(n=>n.id===id).x
      assert.ok(forward ? delta>0 : delta<0, 'Wrong travel direction: '+id)
      assert.ok(after.machines.find(n=>n.id===id).tilt===0,'Do not mirror the body on the return trip')
      if(id!=='dump-2') assert.ok(forward ? after.tracks[id]<before.tracks[id] : after.tracks[id]>before.tracks[id],'Track belt must reverse with the vehicle: '+id)
    }
    assert.equal(await evaluate(`document.querySelector('.machine--dump-2 .rolling-wheel').getAnimations()[0].effect.getTiming().direction`),'normal')
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.road-progress--sand-2')).transformOrigin`),'0px 220px','Forward discharge must fill left to right')
    await seek(.405); const parked = await state()
    await seek(.925); assert.equal((await state()).wheel, parked.wheel, 'Parked scout wheels must stop')
    // Check real company paint on body only, without needing a user's save.
    const paint=await evaluate(`(()=>{const n=document.querySelector('.workspace-journey');n.style.setProperty('--company-primary','rgb(43,115,200)');n.style.setProperty('--company-secondary','rgb(78,75,82)');n.style.setProperty('--company-accent','rgb(233,233,233)');const fill=s=>getComputedStyle(n.querySelector(s)).fill;return {primary:fill('.machine--scout .paint-primary'),secondary:fill('.machine--dump-1 .paint-secondary'),accent:fill('.machine--scout .paint-accent'),tyre:fill('.machine--scout .rolling-wheel circle'),glass:fill('.machine--scout path[fill^="url"]')}})()`)
    assert.equal(paint.primary,'rgb(43, 115, 200)');assert.equal(paint.secondary,'rgb(78, 75, 82)');assert.equal(paint.accent,'rgb(233, 233, 233)')
    assert.notEqual(paint.tyre,paint.primary);assert.notEqual(paint.glass,paint.primary)
    const trajectory=await evaluate(`(()=>{const n=document.querySelector('.machine--scout .terrain-particle'),a=n.getAnimations()[0],duration=a.effect.getComputedTiming().duration;a.currentTime=duration*.3;const up=new DOMMatrix(getComputedStyle(n).transform);a.currentTime=duration*.96;const down=new DOMMatrix(getComputedStyle(n).transform);const sand=document.querySelector('.machine--dump-1 .terrain-particle'),b=sand.getAnimations()[0];b.currentTime=b.effect.getComputedTiming().duration*.96;return {up:{x:up.e,y:up.f},down:{x:down.e,y:down.f},sand:new DOMMatrix(getComputedStyle(sand).transform).f}})()`)
    assert(trajectory.up.x<0 && trajectory.up.y<0 && trajectory.down.y>0,'Splash must rise then fall under gravity')
    assert(trajectory.sand>30,'Sand must fall from the dump tail towards the ground')
    await seek(1.04); const repeated = await state()
    assert.deepEqual(repeated.visible, ['scout']); assert.equal(repeated.rough, 1); assert.equal(repeated.road.rolled, 0)
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const reduced = await state()
    assert.deepEqual(reduced.visible, ['scout', 'cargo']); assert.equal(reduced.road.rolled, 1); assert.equal(reduced.rough, 0); assert.equal(reduced.mud, 0)
    assert.equal(await evaluate(`document.querySelector('.workspace-journey svg').getAnimations({subtree:true}).length`), 0, 'Reduced motion must disable all animations')
    return animation
  } finally {
    await call('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'no-preference'}] })
    await evaluate(`(()=>{const n=document.querySelector('.workspace-journey');${originalStyle === null ? 'n.removeAttribute("style")' : `n.setAttribute('style',${JSON.stringify(originalStyle)})`};n.querySelector('svg').getAnimations({subtree:true}).forEach(a=>a.play())})()`)
  }
}
