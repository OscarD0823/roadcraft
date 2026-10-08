import assert from 'node:assert/strict'
import { reactive, computed } from 'vue'
import type { ContentEntry, EditableParameter } from '../src/shared'
import { entryInSection } from '../src/shared'
import { createEntryDraft, hasPendingChanges, rebaseEntryDraft, type EntryDraft } from '../src/renderer/entry-drafts'
import { locales, translate } from '../src/renderer/i18n'

const parameter = (id: string, value: number): EditableParameter => ({
  id, value, original: value, kind: 'number', groupKey: 'engine', labelKey: id
})
const shared: ContentEntry = {
  id: 'pak/source/shared.cls', kind: 'truck', sourceType: 'pak', name: 'Shared truck', internalName: 'auto_shared_99_cargo',
  filePath: 'fixture.pak', relativePath: 'shared.cls', category: 'truck', modified: false, modifiedAt: 0,
  parameters: [parameter('engineTorque', 100), parameter('fuelCapacity', 200)],
  access: { control: 'shared', variant: 'standard', obtain: 'shop', logistics: [{ map: 'fixture', role: 'delivery', cargoNames: ['sand'] }] }
}
assert(entryInSection(shared, 'truck')); assert(entryInSection(shared, 'ai'))
const drafts = reactive<Record<string, EntryDraft>>({ [shared.id]: createEntryDraft(shared) })
const draft = drafts[shared.id]
const modifiedCount = computed(() => Number(shared.modified || hasPendingChanges(drafts[shared.id])))
assert.equal(modifiedCount.value, 0)
draft.values.engineTorque = 110; draft.applyToVariants = false
assert.equal(modifiedCount.value, 1, 'Pending drafts must be reactive in Modificados')
assert.equal(shared.modified, false, 'A pending draft must never mark the game as saved')
// Player/logistics/modified all resolve the same exact ID, not a copy per section.
for (const section of ['truck', 'ai'] as const) {
  const selected = [shared].find(entry => entryInSection(entry, section))!
  assert.equal(drafts[selected.id], draft)
  assert.equal(drafts[selected.id].values.engineTorque, 110)
}
rebaseEntryDraft(draft, { ...shared, parameters: [parameter('engineTorque', 100), parameter('fuelCapacity', 220), parameter('newField', 3)] })
assert.equal(draft.values.engineTorque, 110); assert.equal(draft.values.fuelCapacity, 220)
assert.equal(draft.values.newField, 3); assert.equal(draft.applyToVariants, false)
assert.deepEqual(draft.conflicts, [])
// Rescans and an external modification of the same field cannot overwrite either side.
const external = { ...shared, parameters: [parameter('engineTorque', 105)] }
rebaseEntryDraft(draft, external); rebaseEntryDraft(draft, external)
assert.equal(draft.values.engineTorque, 110); assert.equal(draft.baseline.engineTorque, 100)
assert.deepEqual(draft.conflicts, ['engineTorque']); assert.equal(draft.values.fuelCapacity, undefined)
draft.values.engineTorque = 100
assert(hasPendingChanges(draft), 'An unresolved conflict must remain visible even when the value is typed back')
draft.values.engineTorque = 105
rebaseEntryDraft(draft, external)
assert(!hasPendingChanges(draft)); assert.deepEqual(draft.conflicts, [])
draft.values.engineTorque = 115
rebaseEntryDraft(draft, { ...shared, parameters: [] })
assert.deepEqual(draft.conflicts, ['engineTorque']); assert.equal(draft.values.engineTorque, 115)
// Discard is local; successful writes/restarts are reloaded from source values.
drafts[shared.id] = createEntryDraft({ ...shared, modified: true, parameters: [parameter('engineTorque', 115)] })
assert(!hasPendingChanges(drafts[shared.id])); assert.equal(drafts[shared.id].values.engineTorque, 115)
assert.equal(drafts[shared.id].applyToVariants, true)
assert.equal(shared.parameters[0].value, 100, 'Draft/discard must not mutate source scan data')
const other = { ...shared, id: 'another/source/shared.cls' }
drafts[other.id] = createEntryDraft(other)
assert.equal(drafts[other.id].values.engineTorque, 100, 'A similar name in another source must not inherit edits')
for (const locale of locales) for (const key of ['roadZoneLabel', 'roadStatus_enabled', 'roadEnable', 'roadConfirmDetail', 'wholeMapSand', 'sandOperatingDistanceHelp', 'protectedDumpZonesHelp']) {
  assert(!/experimental|beta|not (?:verified|tested)|sin verificar/i.test(translate(locale.value, key)), `${locale.value}:${key}`)
}
console.log('Session drafts: shared exact-source identity, reactive pending state, rescan/rebase, external conflict, removed fields, explicit local discard and stable feature copy verified. No game writes.')
