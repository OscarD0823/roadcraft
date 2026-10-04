import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Run against our isolated Electron renderer, never the user's open window.
export async function testJourney({ evaluate, call, output }) {
  const duration = await evaluate(`document.querySelector('.workspace-journey .machine').getAnimations()[0].effect.getComputedTiming().duration`)
  assert.equal(duration, 54000)
  assert.equal(await evaluate(`document.querySelectorAll('.workspace-journey .grade-clearance').length`), 2, 'Both excavator passes must remove sand mounds')
  assert.equal(await evaluate(`document.querySelectorAll('.machine--excavator .rolling-wheel').length`),0,'The excavator must use tracks, not grader wheels')
  assert.ok(await evaluate(`!!document.querySelector('.workspace-journey .scout-shoulder')`), 'Waiting scout must rest on its shoulder')
  const seek = async fraction => {
    await evaluate(`document.querySelector('.workspace-journey svg').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=${duration * fraction}})`)
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  const state = () => evaluate(`(()=>{
    const svg=document.querySelector('.workspace-journey'), matrix=n=>new DOMMatrix(getComputedStyle(n).transform);
    const machines=[...svg.querySelectorAll('[data-machine]')].map(n=>({id:n.dataset.machine,opacity:+getComputedStyle(n).opacity,x:matrix(n).e,y:matrix(n).f,tilt:matrix(n).b}));
    const road=Object.fromEntries([...svg.querySelectorAll('.road-progress')].map(n=>[n.classList[1].replace('road-progress--',''),matrix(n).a]));
    return {machines,visible:machines.filter(n=>n.opacity>.8).map(n=>n.id),road,rough:matrix(svg.querySelector('.terrain-progress')).a,mud:+getComputedStyle(svg.querySelector('.mud-splash')).opacity,wheel:getComputedStyle(svg.querySelector('.machine--scout .rolling-wheel')).transform,bed:matrix(svg.querySelector('.machine--dump-1 .dump-bed')).b,discharge:+getComputedStyle(svg.querySelector('.machine--dump-1 .sand-discharge')).opacity};
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
    }
    assert.equal(await evaluate(`document.querySelector('.machine--dump-2 .rolling-wheel').getAnimations()[0].effect.getTiming().direction`),'normal')
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.road-progress--sand-2')).transformOrigin`),'0px 220px','Forward discharge must fill left to right')
    await seek(.405); const parked = await state()
    await seek(.925); assert.equal((await state()).wheel, parked.wheel, 'Parked scout wheels must stop')
    await seek(1.04); const repeated = await state()
    assert.deepEqual(repeated.visible, ['scout']); assert.equal(repeated.rough, 1); assert.equal(repeated.road.rolled, 0)
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const reduced = await state()
    assert.deepEqual(reduced.visible, ['scout', 'cargo']); assert.equal(reduced.road.rolled, 1); assert.equal(reduced.rough, 0); assert.equal(reduced.mud, 0)
    assert.equal(await evaluate(`document.querySelector('.workspace-journey svg').getAnimations({subtree:true}).length`), 0, 'Reduced motion must disable all animations')
    return animation
  } finally {
    await call('Emulation.setEmulatedMedia', { features: [] })
    await evaluate(`(()=>{const n=document.querySelector('.workspace-journey');${originalStyle === null ? 'n.removeAttribute("style")' : `n.setAttribute('style',${JSON.stringify(originalStyle)})`};n.querySelector('svg').getAnimations({subtree:true}).forEach(a=>a.play())})()`)
  }
}
