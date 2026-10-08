import type { ContentEntry, ParameterValue } from '../shared'

/** Session-only values, keyed by the exact source ID, never by library section. */
export interface EntryDraft {
  values: Record<string, ParameterValue>
  baseline: Record<string, ParameterValue>
  conflicts: string[]
  applyToVariants: boolean
}

export function createEntryDraft(entry: ContentEntry): EntryDraft {
  const values = Object.fromEntries(entry.parameters.map(parameter => [parameter.id, parameter.value]))
  return { values, baseline: { ...values }, conflicts: [], applyToVariants: true }
}

export function hasPendingChanges(draft?: EntryDraft): boolean {
  return !!draft && (!!draft.conflicts.length || Object.keys(draft.values).some(id => !Object.is(draft.values[id], draft.baseline[id])))
}

/** Refresh untouched fields, retain edits, and refuse silent overwrites of external changes. */
export function rebaseEntryDraft(draft: EntryDraft, entry: ContentEntry): void {
  const current = new Map(entry.parameters.map(parameter => [parameter.id, parameter.value]))
  const conflicts = new Set<string>()
  for (const id of new Set([...Object.keys(draft.values), ...current.keys()])) {
    const pending = !Object.is(draft.values[id], draft.baseline[id])
    if (!current.has(id)) {
      if (pending) conflicts.add(id)
      else { delete draft.values[id]; delete draft.baseline[id] }
      continue
    }
    const value = current.get(id)!
    if (!pending || Object.is(draft.values[id], value)) {
      draft.values[id] = value
      draft.baseline[id] = value
    } else if (!Object.is(draft.baseline[id], value)) {
      conflicts.add(id)
    }
  }
  draft.conflicts = [...conflicts]
}
