import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function testRoadZonesUI({ evaluate, call, wait, output }) {
  const before = await evaluate('window.roadcraft.getRoadZoneStatus()')
  assert(['standard','enabled','conflict','unavailable'].includes(before.status), 'Unexpected status')
  const results = []
  await evaluate(`document.querySelector('[data-road-menu]').focus(); document.querySelector('[data-road-menu]').click()`)
  await wait(`document.querySelector('.road-dialog')?.open && !document.querySelector('.road-status')?.textContent.includes('Comprobando')`)
  assert(await evaluate(`document.querySelector('.road-dialog').textContent.includes('Carreteras libres')`))
  assert(await evaluate(`document.querySelector('.road-dialog').textContent.includes('NO deshace')`))
  assert(await evaluate(`!/experimental|beta|Sin verificar/i.test(document.querySelector('.road-dialog').textContent)`), 'Validated roads still labelled experimental')
  if(before.status==='standard') assert(await evaluate(`document.querySelector('[data-road-enable]')?.disabled === false`))
  else if(before.status==='enabled') assert(await evaluate(`!!document.querySelector('[data-road-restore]')`))
  else assert(await evaluate(`!document.querySelector('[data-road-enable]') || document.querySelector('[data-road-enable]').disabled`),'Unknown packages must not be editable')
  for (const width of [600, 960, 1366]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 520, deviceScaleFactor: 1, mobile: false })
    await new Promise(r => setTimeout(r, 250))
    const bounds = await evaluate(`(() => {
      const dialog = document.querySelector('.road-dialog'), r = dialog.getBoundingClientRect();
      const f = dialog.querySelector('footer').getBoundingClientRect();
      return { width: innerWidth, left: r.left, right: r.right, top: r.top, bottom: r.bottom, footerBottom: f.bottom,
        horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 2, pageOverflow: document.documentElement.scrollWidth > innerWidth + 2 };
    })()`)
    assert(bounds.left >= 0 && bounds.right <= width && bounds.top >= 0 && bounds.bottom <= 520)
    assert(bounds.footerBottom <= 520, 'Activation/restore controls clipped at minimum window height')
    assert.equal(bounds.horizontalOverflow, false); assert.equal(bounds.pageOverflow, false)
    const screenshot = await call('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(output, `roads-panel-${width}.png`), Buffer.from(screenshot.data, 'base64'))
    results.push(bounds)
  }
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await wait(`!document.querySelector('.road-dialog')?.open`)
  assert(await evaluate(`document.activeElement?.hasAttribute('data-road-menu')`), 'Keyboard focus not returned to opener')
  const after = await evaluate('window.roadcraft.getRoadZoneStatus()')
  assert.deepEqual(after, before, 'Opening the panel changed the game')
  return { results, status: after.status, activationNotInvoked: true }
}
