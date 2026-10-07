import { objectBody } from './source-blocks'

// Shared map actor, NOT a truck's required permission checker.
export const ROAD_ZONE_CLASS = 'ssl/game/non_terraformable_actor.cls'

export interface RoadZoneSnapshot {
  originalSource: string
  enabledSource: string
  backupPath: string
}

/** Remove only the known empty map-zone property. Unknown layouts fail closed. */
export function freeRoadZoneClass(source: string) {
  if (source.length > 65536 || !/\b__type\s*=\s*"iactor"\s*;?\s*$/.test(source)) {
    throw new Error('La clase de zonas no tiene un formato compatible.')
  }
  const properties = objectBody(source, 'properties')
  const domain = objectBody(properties, 'prop_domain')
  const property = /^[\t ]*prop_non_terraformable\s*=\s*\{\s*\}\s*;?[\t ]*(?:\r?\n)?/m.exec(properties)
  if (!domain || !/\btrackingMode\s*=\s*"EXIT"/.test(domain)
    || !/\btagFilters\s*=\s*\[\s*"truck_view"\s*\]/.test(domain)
    || !property || (source.match(/\bprop_non_terraformable\b/g) ?? []).length !== 1) {
    throw new Error('Las zonas fueron modificadas o no son compatibles. No se cambia el paquete.')
  }
  const start = source.indexOf(properties) + property.index
  return source.slice(0, start) + source.slice(start + property[0].length)
}

export function validRoadZoneSnapshot(value: RoadZoneSnapshot) {
  try {
    return typeof value.originalSource === 'string' && typeof value.enabledSource === 'string'
      && typeof value.backupPath === 'string' && Boolean(value.backupPath)
      && freeRoadZoneClass(value.originalSource) === value.enabledSource
  } catch { return false }
}
