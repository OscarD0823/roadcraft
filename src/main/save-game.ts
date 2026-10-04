import { createHash } from 'node:crypto'
import { deflateSync, inflateSync } from 'node:zlib'
import type { SaveGameChanges, SaveGameData, SaveMapState, SaveTruckState } from '../shared'
import { readCompanyCustomization } from './company-paint'

const HEADER_LENGTH = 53
const RESOURCE_INDEX = {
  logs: 4,
  steelBeams: 5,
  concreteSlabs: 6,
  steelPipes: 7
} as const

type JsonRecord = Record<string, unknown>

export interface DecodedCompleteSave {
  header: Buffer
  document: JsonRecord
  trailingData: Buffer
}

export interface SaveFileIdentity {
  filePath: string
  slotName: string
  profileId: string
  modifiedAt: number
}

export function decodeCompleteSave(content: Buffer): DecodedCompleteSave {
  if (content.length < HEADER_LENGTH + 8) {
    throw new Error('El archivo CompleteSave está incompleto.')
  }

  const totalCompressedSize = content.readUInt32LE(4)
  const totalUncompressedSize = content.readUInt32LE(12)
  const payloadEnd = HEADER_LENGTH + totalCompressedSize
  if (totalCompressedSize < 8 || payloadEnd > content.length) {
    throw new Error('El tamaño del contenido comprimido de CompleteSave no es válido.')
  }

  const payload = content.subarray(HEADER_LENGTH, payloadEnd)
  const expectedHash = content.subarray(20, 52).toString('ascii').toLowerCase()
  const actualHash = createHash('md5').update(payload).digest('hex')
  if (!/^[a-f0-9]{32}$/.test(expectedHash) || expectedHash !== actualHash) {
    throw new Error('La firma de CompleteSave no coincide. El archivo puede estar dañado o abierto por el juego.')
  }

  const chunks: Buffer[] = []
  let offset = 0
  let uncompressedLength = 0
  while (offset < payload.length) {
    if (offset + 8 > payload.length) throw new Error('CompleteSave contiene un bloque incompleto.')
    const expectedBlockSize = payload.readUInt32LE(offset)
    const compressedBlockSize = payload.readUInt32LE(offset + 4)
    const compressedStart = offset + 8
    const compressedEnd = compressedStart + compressedBlockSize
    if (compressedBlockSize < 6 || compressedEnd > payload.length) {
      throw new Error('CompleteSave contiene un bloque comprimido no válido.')
    }

    let block: Buffer
    try {
      block = inflateSync(payload.subarray(compressedStart, compressedEnd))
    } catch {
      throw new Error('No se pudo descomprimir CompleteSave. Comprueba que elegiste una partida de RoadCraft.')
    }
    if (block.length !== expectedBlockSize) {
      throw new Error('El tamaño descomprimido de un bloque de CompleteSave no coincide.')
    }
    chunks.push(block)
    uncompressedLength += block.length
    offset = compressedEnd
  }

  if (uncompressedLength !== totalUncompressedSize) {
    throw new Error('El tamaño descomprimido de CompleteSave no coincide con su cabecera.')
  }

  let document: unknown
  try {
    document = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('El contenido de CompleteSave no contiene datos JSON válidos.')
  }
  if (!isRecord(document) || !isRecord(document.SslValue)) {
    throw new Error('CompleteSave no contiene la sección SslValue esperada por RoadCraft.')
  }

  return {
    header: Buffer.from(content.subarray(0, HEADER_LENGTH)),
    document,
    trailingData: Buffer.from(content.subarray(payloadEnd))
  }
}

export function encodeCompleteSave(decoded: DecodedCompleteSave, document: JsonRecord): Buffer {
  if (!isRecord(document.SslValue)) throw new Error('No se puede guardar una partida sin SslValue.')
  const raw = Buffer.from(JSON.stringify(document), 'utf8')
  const compressed = deflateSync(raw)
  const payload = Buffer.allocUnsafe(8 + compressed.length)
  payload.writeUInt32LE(raw.length, 0)
  payload.writeUInt32LE(compressed.length, 4)
  compressed.copy(payload, 8)

  const header = Buffer.from(decoded.header)
  if (header.length !== HEADER_LENGTH) throw new Error('La cabecera original de CompleteSave no es válida.')
  header.writeUInt32LE(payload.length, 4)
  header.writeUInt32LE(raw.length, 12)
  header.write(createHash('md5').update(payload).digest('hex'), 20, 32, 'ascii')
  return Buffer.concat([header, payload, decoded.trailingData])
}

export function createSaveGameData(decoded: DecodedCompleteSave, identity: SaveFileIdentity): SaveGameData {
  const root = decoded.document.SslValue as JsonRecord
  const locked = stringArray(root.lockedTrucks)
  const unlockedByMap = recordOfStringArrays(root.unlockedTrucks)
  const newUnlocked = stringArray(root.newUnlockedTrucks)
  const unlockedIds = new Set([...Object.values(unlockedByMap).flat(), ...newUnlocked])
  const truckIds = new Set([...locked, ...unlockedIds])
  const trucks: SaveTruckState[] = [...truckIds]
    .sort((a, b) => a.localeCompare(b))
    .map(id => ({ id, unlocked: unlockedIds.has(id) && !locked.includes(id) }))

  const unlockedLevels = new Set(stringArray(root.unlockedLevels))
  const completedLevels = new Set(stringArray(root.completedLevels))
  const progress = numericRecord(root.levelsProgress)
  const recoveryCoins = numericRecord(root.recoveryCoins)
  const resourcesByMap = asRecord(root.fobsResources)
  const mapIds = new Set([
    ...Object.keys(unlockedByMap),
    ...unlockedLevels,
    ...completedLevels,
    ...Object.keys(progress),
    ...Object.keys(recoveryCoins),
    ...Object.keys(resourcesByMap)
  ])
  const maps: SaveMapState[] = [...mapIds]
    .sort((a, b) => a.localeCompare(b))
    .map(id => {
      const resourceEntry = asRecord(resourcesByMap[id])
      const resources = numberArray(resourceEntry.resources)
      return {
        id,
        unlocked: unlockedLevels.has(id),
        completed: completedLevels.has(id),
        progress: integerOr(progress[id], 0),
        recoveryCoins: integerOr(recoveryCoins[id], 0),
        resources: {
          logs: integerOr(resources[RESOURCE_INDEX.logs], 0),
          steelBeams: integerOr(resources[RESOURCE_INDEX.steelBeams], 0),
          concreteSlabs: integerOr(resources[RESOURCE_INDEX.concreteSlabs], 0),
          steelPipes: integerOr(resources[RESOURCE_INDEX.steelPipes], 0)
        }
      }
    })

  return {
    ...identity,
    money: integerOr(root.money, 0),
    xp: integerOr(root.xp, 0),
    companyName: typeof root.companyName === 'string' ? root.companyName : '',
    companyCustomization: readCompanyCustomization(root),
    trucks,
    maps
  }
}

export function applySaveGameChanges(decoded: DecodedCompleteSave, changes: SaveGameChanges): JsonRecord {
  const root = decoded.document.SslValue as JsonRecord
  root.money = safeInteger(changes.money, 0, 2_000_000_000, 'dinero')
  root.xp = safeInteger(changes.xp, 0, 2_000_000_000, 'experiencia')
  if (typeof changes.companyName !== 'string' || changes.companyName.length > 64) {
    throw new Error('El nombre de la empresa puede tener como máximo 64 caracteres.')
  }
  root.companyName = changes.companyName

  const existingLocked = stringArray(root.lockedTrucks)
  const existingUnlockedByMap = recordOfStringArrays(root.unlockedTrucks)
  const existingNewUnlocked = stringArray(root.newUnlockedTrucks)
  const existingUnlocked = new Set([...Object.values(existingUnlockedByMap).flat(), ...existingNewUnlocked])
  const requestedTruckStates = new Map<string, boolean>()
  for (const truck of changes.trucks) {
    if (typeof truck.id !== 'string' || !truck.id || truck.id.length > 256) continue
    requestedTruckStates.set(truck.id, Boolean(truck.unlocked))
  }
  const allTruckIds = new Set([...existingLocked, ...existingUnlocked, ...requestedTruckStates.keys()])
  const unlockedTruckIds = [...allTruckIds].filter(id => requestedTruckStates.get(id) ?? existingUnlocked.has(id)).sort()
  const unlockedSet = new Set(unlockedTruckIds)
  root.lockedTrucks = [...allTruckIds].filter(id => !unlockedSet.has(id)).sort()

  const mapKeys = Object.keys(existingUnlockedByMap).length > 0
    ? Object.keys(existingUnlockedByMap)
    : changes.maps.map(map => map.id).filter(Boolean)
  if (mapKeys.length > 0) {
    root.unlockedTrucks = Object.fromEntries(mapKeys.map(id => [id, unlockedTruckIds]))
  }
  if (Array.isArray(root.newUnlockedTrucks)) root.newUnlockedTrucks = unlockedTruckIds

  const requestedMaps = new Map(changes.maps.map(map => [map.id, map]))
  const existingUnlockedLevels = new Set(stringArray(root.unlockedLevels))
  const existingCompletedLevels = new Set(stringArray(root.completedLevels))
  for (const [id, map] of requestedMaps) {
    if (!id || id.length > 256) continue
    if (map.unlocked) existingUnlockedLevels.add(id)
    else existingUnlockedLevels.delete(id)
    if (map.completed) existingCompletedLevels.add(id)
    else existingCompletedLevels.delete(id)
  }
  root.unlockedLevels = [...existingUnlockedLevels].sort()
  root.completedLevels = [...existingCompletedLevels].sort()

  const progress = numericRecord(root.levelsProgress)
  const recoveryCoins = numericRecord(root.recoveryCoins)
  const resourcesByMap = asRecord(root.fobsResources)
  for (const [id, map] of requestedMaps) {
    progress[id] = safeInteger(map.progress, 0, 100, `progreso de ${id}`)
    recoveryCoins[id] = safeInteger(map.recoveryCoins, 0, 9_999, `combustible de ${id}`)
    const resourceEntry = { ...asRecord(resourcesByMap[id]) }
    const values = numberArray(resourceEntry.resources)
    while (values.length < 8) values.push(0)
    values[RESOURCE_INDEX.logs] = safeInteger(map.resources.logs, 0, 999_999, `troncos de ${id}`)
    values[RESOURCE_INDEX.steelBeams] = safeInteger(map.resources.steelBeams, 0, 999_999, `vigas de ${id}`)
    values[RESOURCE_INDEX.concreteSlabs] = safeInteger(map.resources.concreteSlabs, 0, 9_999, `losas de ${id}`)
    values[RESOURCE_INDEX.steelPipes] = safeInteger(map.resources.steelPipes, 0, 999_999, `tuberías de ${id}`)
    resourceEntry.resources = values
    resourcesByMap[id] = resourceEntry
  }
  root.levelsProgress = progress
  root.recoveryCoins = recoveryCoins
  root.fobsResources = resourcesByMap
  return decoded.document
}

function safeInteger(value: number, minimum: number, maximum: number, label: string) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`El valor de ${label} debe estar entre ${minimum} y ${maximum}.`)
  }
  return value
}

function integerOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {}
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map(item => typeof item === 'number' && Number.isFinite(item) ? item : 0) : []
}

function recordOfStringArrays(value: unknown): Record<string, string[]> {
  const record = asRecord(value)
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, stringArray(item)]))
}

function numericRecord(value: unknown): Record<string, number> {
  const record = asRecord(value)
  return Object.fromEntries(Object.entries(record).flatMap(([key, item]) =>
    typeof item === 'number' && Number.isFinite(item) ? [[key, item]] : []
  ))
}
