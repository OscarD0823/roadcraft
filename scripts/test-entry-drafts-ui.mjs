import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Native application QA: drafts/discard/rescan only; never calls Save or Restore. */
export async function testEntryDrafts({ evaluate, call, wait, all, output }) {
  const shared = all.filter(entry => entry.kind === 'truck' && entry.access?.control === 'shared')
  assert(shared.length > 0, 'No confirmed player/logistics source to test')
  const initialModified = all.filter(entry => entry.modified).length
  const results = []
  async function section(view) {
    await evaluate(`document.querySelector('.inspector__header button')?.click()`)
    await evaluate(`document.querySelector('[data-view="${view}"]').click()`)
    await wait(`!document.querySelector('.inspector') && document.querySelector('[data-view="${view}"]')?.getAttribute('aria-current') === 'page'`)
  }
  async function open(entry) {
    assert(await evaluate(`(()=>{const card=document.querySelector('.content-card[data-entry-id='+CSS.escape(${JSON.stringify(entry.id)})+']');card?.click();return !!card})()`), 'Source card missing: ' + entry.internalName)
    await wait(`document.querySelector('.inspector')?.dataset.entryId === ${JSON.stringify(entry.id)}`)
  }
  async function group(parameter) {
    // Group names are translated; select by source parameter ID, not display name.
    await evaluate(`(()=>{for(const button of document.querySelectorAll('.parameter-tabs button')){if(button.textContent.includes(${JSON.stringify(parameter.groupKey === 'engine' ? 'Motor' : 'Combustible')}))button.click()}})()`)
    await wait(`!!document.querySelector('[data-parameter-id="${parameter.id}"] input[type=number]')`)
  }
  for (const entry of shared) {
    const parameter = entry.parameters.find(parameter => parameter.kind === 'number' && parameter.groupKey === 'engine')
      ?? entry.parameters.find(parameter => parameter.kind === 'number' && parameter.groupKey === 'fuel')
    assert(parameter, 'Shared truck has no numeric mechanical field')
    const value = parameter.value === parameter.recommended?.low ? parameter.recommended.medium : parameter.recommended?.low
    assert.equal(typeof value, 'number'); assert.notEqual(value, parameter.value)
    await section('truck'); await open(entry); await group(parameter)
    await evaluate(`(()=>{const input=document.querySelector('[data-parameter-id="${parameter.id}"] input');input.value=${JSON.stringify(String(value))};input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await wait(`document.querySelector('[data-draft-notice]')?.textContent.includes('Sin guardar')`)
    results.push({ name: entry.internalName, id: entry.id, parameter: parameter.id, value })
    for (const view of ['ai', 'modified', 'truck']) {
      await section(view)
      assert.equal(await evaluate(`document.querySelector('.content-card[data-entry-id='+CSS.escape(${JSON.stringify(entry.id)})+'] [data-edit-state]')?.dataset.editState`), 'pending')
      await open(entry); await group(parameter)
      assert.equal(Number(await evaluate(`document.querySelector('[data-parameter-id="${parameter.id}"] input').value`)), value, `${view} lost shared draft`)
    }
  }
  await section('modified')
  assert.equal(Number(await evaluate(`document.querySelector('[data-view="modified"] small').textContent`)), initialModified + shared.filter(entry => !entry.modified).length)
  // Actual UI rescan, not only an IPC read. The game file must still contain the original values.
  await evaluate(`document.querySelector('.workspace-nav__tools .button').click()`)
  await wait(`!document.querySelector('.workspace-nav__tools .button').disabled`)
  const onDisk = await evaluate('window.roadcraft.scan()')
  for (const entry of shared) {
    const parameterId = results.find(result => result.id === entry.id).parameter
    assert.equal(onDisk.entries.find(current => current.id === entry.id).parameters.find(parameter => parameter.id === parameterId).value,
      entry.parameters.find(parameter => parameter.id === parameterId).value, 'Draft modified the live package')
  }
  const entry = shared[0], result = results[0], parameter = entry.parameters.find(parameter => parameter.id === result.parameter)
  await section('ai'); await open(entry); await group(parameter)
  await wait(`document.querySelector('.vehicle-drive')?.dataset.modelState === 'ready'`)
  const layout = []
  for (const [width, height] of [[600, 520], [960, 620], [1366, 768]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))')
    const bounds = await evaluate(`(()=>{const scroll=document.querySelector('.settings-scroll'),footer=document.querySelector('.inspector__footer').getBoundingClientRect();return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,settingsOverflow:scroll.scrollWidth>scroll.clientWidth,footer:footer.bottom,value:document.querySelector('[data-parameter-id="${parameter.id}"] input').value}})()`)
    assert.equal(bounds.overflow, false); assert.equal(bounds.settingsOverflow, false); assert(bounds.footer <= height + 1)
    assert.equal(Number(bounds.value), result.value)
    assert(await evaluate(`document.querySelector('[data-draft-notice]').getBoundingClientRect().height < 140`), 'Draft notice consumes the settings pane')
    layout.push(bounds)
    await evaluate(`document.querySelector('.settings-scroll').scrollTop=0`)
    const shot = await call('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(output, `shared-draft-${width}.png`), Buffer.from(shot.data, 'base64'))
  }
  await evaluate(`document.querySelector('.topbar__actions > button:last-child').click()`)
  await wait(`document.querySelector('.toast--error')?.textContent.includes('Guarda o descarta')`)
  assert.equal(Number(await evaluate(`document.querySelector('[data-parameter-id="${parameter.id}"] input').value`)), result.value)
  // Discard resets only the selected exact source, leaving other pending vehicles intact.
  for (const entry of shared) {
    await section('ai'); await open(entry)
    assert(await evaluate(`!!document.querySelector('[data-draft-notice]')`))
    await evaluate(`document.querySelector('[data-discard-draft]').click()`)
    await wait(`!document.querySelector('[data-draft-notice]')`)
    const parameter = entry.parameters.find(parameter => parameter.id === results.find(result => result.id === entry.id).parameter)
    await group(parameter)
    assert.equal(Number(await evaluate(`document.querySelector('[data-parameter-id="${parameter.id}"] input').value`)), parameter.value)
  }
  await section('modified')
  assert.equal(Number(await evaluate(`document.querySelector('[data-view="modified"] small').textContent`)), initialModified)
  await section('all')
  const summary = { shared: results, layout, originalGameValuesRetained: true, saveNotInvoked: true, restoreNotInvoked: true }
  await writeFile(join(output, 'entry-draft-results.json'), JSON.stringify(summary, null, 2))
  return summary
}
