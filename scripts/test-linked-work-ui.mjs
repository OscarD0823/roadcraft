import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Read-only packaged-app QA: change drafts, never click Save or Restore. */
export async function testLinkedWork({ evaluate, call, wait, all, output }) {
  async function open(name) {
    await evaluate(`document.querySelector('.inspector__header button')?.click()`)
    const found = await evaluate(`(()=>{const card=[...document.querySelectorAll('.content-card')].find(card=>card.textContent.includes(${JSON.stringify(name)}));card?.click();return !!card})()`)
    assert(found, 'Vehicle card missing: ' + name)
    await wait('!!document.querySelector(".inspector-settings")')
  }
  const old = all.find(entry => entry.internalName === 'auto_zikz_605e_mobile_scalper_old')
  const restored = all.find(entry => entry.internalName === 'auto_zikz_605e_mobile_scalper_res')
  assert(old && restored)
  await open(old.name)
  const workIndex = await evaluate(`(()=>{const buttons=[...document.querySelectorAll('.parameter-tabs button')];return buttons.findIndex(button=>/Equipo de trabajo|Work equipment/.test(button.textContent))})()`)
  assert(workIndex >= 0)
  await evaluate(`document.querySelectorAll('.parameter-tabs button')[${workIndex}].click()`)
  assert.equal(await evaluate(`document.querySelector('[data-variant-toggle]').checked`), true)
  assert(await evaluate(`document.querySelector('.variant-notice').textContent.includes(${JSON.stringify(restored.name)})`))
  assert.equal(await evaluate(`document.querySelector('[data-parameter-id="sandOperatingDistance"] input').max`), '10000')
  await evaluate(`document.querySelector('.sand-map-preset').click()`)
  assert.equal(await evaluate(`document.querySelector('[data-parameter-id="sandOperatingDistance"] input').value`), '10000')
  assert(await evaluate(`document.querySelector('.sand-map-preset').textContent.includes('experimental')`))
  assert.equal(await evaluate(`document.querySelectorAll('[data-parameter-id="ignoreSandDumpRestrictions"]').length`), 0)
  const warning = await evaluate(`({work:document.querySelector('.parameter-tabs button.active')?.textContent,text:document.querySelector('.settings-scroll').textContent})`)
  assert(warning.text.includes('No se desactivan las zonas protegidas'), JSON.stringify(warning))
  const layout = []
  for (const [width, height] of [[600, 520], [960, 620], [1366, 768]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))')
    const state = await evaluate(`(()=>{const scroll=document.querySelector('.settings-scroll'),footer=document.querySelector('.inspector__footer').getBoundingClientRect();return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,settingsOverflow:scroll.scrollWidth>scroll.clientWidth,footer:footer.bottom,value:document.querySelector('[data-parameter-id="sandOperatingDistance"] input').value}})()`)
    assert.equal(state.overflow, false); assert.equal(state.settingsOverflow, false)
    assert(state.footer <= height + 1); assert.equal(state.value, '10000')
    layout.push(state)
  }
  await evaluate(`document.querySelector('[data-variant-toggle]').click()`)
  assert.equal(await evaluate(`document.querySelector('[data-variant-toggle]').checked`), false)
  await evaluate(`document.querySelectorAll('.parameter-tabs button')[0].click();document.querySelectorAll('.parameter-tabs button')[${workIndex}].click()`)
  assert.equal(await evaluate(`document.querySelector('[data-parameter-id="sandOperatingDistance"] input').value`), '10000')
  await evaluate(`document.querySelector('[data-parameter-id="sandOperatingDistance"]').scrollIntoView({block:'center'})`)
  const shot = await call('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(output, 'linked-sand-settings.png'), Buffer.from(shot.data, 'base64'))
  const wayfarer = all.find(entry => entry.internalName === 'auto_wayfarer_st7050_trailer_cargo_new')
  assert(wayfarer); await open(wayfarer.name)
  const variants = await evaluate(`(()=>{document.querySelector('.variant-notice details').open=true;return [...document.querySelectorAll('.variant-notice li')].map(item=>item.textContent)})()`)
  assert(variants.length >= 3, 'Wayfarer trailer variants are not linked')
  assert(!variants.some(name => /Base | AI|Oft96|Oft 96/.test(name)), 'A convoy/base/different chassis was linked')
  await evaluate(`document.querySelector('.variant-notice').scrollIntoView({block:'center'})`)
  const familyShot = await call('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(output, 'linked-wayfarer-settings.png'), Buffer.from(familyShot.data, 'base64'))
  await evaluate(`document.querySelector('.inspector__header button').click()`)
  const result = { layout, variants, liveGameWrites: false }
  await writeFile(join(output, 'linked-work-results.json'), JSON.stringify(result, null, 2))
  return result
}
