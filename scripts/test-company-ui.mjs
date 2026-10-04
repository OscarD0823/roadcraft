import assert from 'node:assert/strict'
export async function testCompanyPaint({evaluate,wait,all}) {
  await wait(`document.querySelector('.workspace-journey')?.dataset.paint==='customization_material_28'`)
  const saves=await evaluate('window.roadcraft.findSaveGames()')
  assert.equal(saves.length,1);assert.match(saves[0].filePath,/TEST_FIXTURE/)
  const profile=await evaluate(`window.roadcraft.getCompanyPaint('customization_material_28')`)
  assert.deepEqual(profile.colors,[[43,115,200],[78,75,82],[233,233,233]])
  assert.equal(await evaluate(`window.roadcraft.getCompanyPaint('customization_material_unknown')`),undefined)
  const original=all.find(e=>e.internalName==='auto_aramatsu_bowhead_heavy_dumptruck_new')
  const factory=await evaluate(`window.roadcraft.getPreview(${JSON.stringify(original.id)})`)
  const company=await evaluate(`window.roadcraft.getPreview(${JSON.stringify(original.id)},'customization_material_28')`)
  assert.equal(company.modelUrl,factory.modelUrl,'Paint must not rewrite geometry')
  assert.equal(factory.paintSource,'original');assert.equal(company.paintSource,'company')
  assert.deepEqual(factory.paint?.colors[0],[89,33,41])
  assert.deepEqual(company.paint,profile)
  const masks=Object.values(company.materials).filter(m=>m.customizationMask)
  assert(masks.length>=2,'Cabin and bed must use original livery masks')
  for(const [key,m] of Object.entries(company.materials)){
    assert.equal(m.albedo,factory.materials[key].albedo,'Unpainted original texture changed')
    if(/tire|glass/i.test(key))assert(!m.customizationMask,'Glass/tyres must not get company paint')
  }
  // The UI must use the actual parsed slot, not a standalone hardcoded colour.
  await evaluate(`(()=>{document.querySelectorAll('.nav-button')[0].click();[...document.querySelectorAll('.content-card')].find(c=>c.textContent.includes(${JSON.stringify(original.relativePath)})).click()})()`)
  await wait(`document.querySelector('.vehicle-drive')?.dataset.modelState==='ready'`)
  assert.equal(await evaluate(`document.querySelector('.drive-scene').dataset.paintMaterial`),profile.id)
  assert.equal(await evaluate(`document.querySelector('.drive-scene').dataset.paintSource`),'company')
  assert(Number(await evaluate(`document.querySelector('.drive-scene').dataset.paintMasks`))>=2)
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.workspace-journey .machine--scout .paint-primary')).fill`),'rgb(43, 115, 200)')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.workspace-journey .machine--dump-1 .paint-secondary')).fill`),'rgb(78, 75, 82)')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.workspace-journey .machine--scout .paint-accent')).fill`),'rgb(233, 233, 233)')
  await evaluate(`document.querySelectorAll('.nav-button')[6].click()`)
  await wait(`!!document.querySelector('.company-paint-info')`)
  assert.equal(await evaluate(`document.querySelector('.company-paint-info').dataset.paint`),profile.id)
  assert.match(await evaluate(`document.querySelector('.company-paint-info').textContent`),/solo vista previa/)
  await evaluate(`document.querySelectorAll('.nav-button')[0].click()`)
  return {fixtureOnly:true,paint:profile,masks:masks.length,geometryUnchanged:true}
}
