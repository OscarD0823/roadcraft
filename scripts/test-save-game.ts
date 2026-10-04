import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { applySaveGameChanges, createSaveGameData, decodeCompleteSave, encodeCompleteSave, type DecodedCompleteSave } from '../src/main/save-game'

const header = Buffer.alloc(53)
header.write('RCFT', 0, 'ascii')
header.writeUInt32LE(0x10203040, 8)
header.writeUInt32LE(0x50607080, 16)
header[52] = 7

const fixture: DecodedCompleteSave = {
  header,
  trailingData: Buffer.from([9, 8, 7]),
  document: {
    untouchedTopLevel: { keep: true },
    SslValue: {
      money: 10_000,
      xp: 25_000,
      companyName: 'Studio Test',
      companyCustomization: { truckMaterialName:'customization_material_28',graffitiBackgound:'empty',graffitiLogotype:'empty',unknownFutureField:{keep:true} },
      lockedTrucks: ['truck_locked'],
      unlockedTrucks: {
        rb_map_01_storm_preparation: ['truck_open'],
        rb_map_02_storm_aftermath: ['truck_open']
      },
      newUnlockedTrucks: ['truck_open'],
      unlockedLevels: ['rb_map_01_storm_preparation'],
      completedLevels: [],
      levelsProgress: { rb_map_01_storm_preparation: 12 },
      recoveryCoins: { rb_map_01_storm_preparation: 4 },
      fobsResources: {
        rb_map_01_storm_preparation: { resources: [1, 2, 3, 4, 5, 6, 7, 8], untouched: 'yes' }
      },
      unknownGameField: { mustSurvive: true }
    }
  }
}

const initialFile = encodeCompleteSave(fixture, fixture.document)
const decoded = decodeCompleteSave(initialFile)
const multiBlockRaw = Buffer.from(JSON.stringify(fixture.document), 'utf8')
const multiBlockChunks = [multiBlockRaw.subarray(0, Math.floor(multiBlockRaw.length / 2)), multiBlockRaw.subarray(Math.floor(multiBlockRaw.length / 2))]
const multiBlockPayload = Buffer.concat(multiBlockChunks.map(chunk => {
  const compressed = deflateSync(chunk)
  const block = Buffer.alloc(8 + compressed.length)
  block.writeUInt32LE(chunk.length, 0)
  block.writeUInt32LE(compressed.length, 4)
  compressed.copy(block, 8)
  return block
}))
const multiBlockHeader = Buffer.from(header)
multiBlockHeader.writeUInt32LE(multiBlockPayload.length, 4)
multiBlockHeader.writeUInt32LE(multiBlockRaw.length, 12)
multiBlockHeader.write(createHash('md5').update(multiBlockPayload).digest('hex'), 20, 32, 'ascii')
assert.deepEqual(decodeCompleteSave(Buffer.concat([multiBlockHeader, multiBlockPayload])).document, fixture.document)
const initial = createSaveGameData(decoded, {
  filePath: 'C:\\fake\\SLOT_1\\CompleteSave',
  slotName: 'SLOT_1',
  profileId: '1234',
  modifiedAt: 1
})

assert.equal(initial.money, 10_000)
assert.equal(initial.companyCustomization?.truckMaterialName,'customization_material_28')
assert.equal(initial.trucks.length, 2)
assert.equal(initial.maps[0]?.resources.steelPipes, 8)

const document = applySaveGameChanges(decoded, {
  filePath: initial.filePath,
  money: 777_000,
  xp: 888_000,
  companyName: 'RoadCraft Studio',
  trucks: initial.trucks.map(truck => ({ ...truck, unlocked: true })),
  maps: initial.maps.map(map => ({
    ...map,
    unlocked: true,
    completed: true,
    progress: 100,
    recoveryCoins: 99,
    resources: { logs: 101, steelBeams: 102, concreteSlabs: 103, steelPipes: 104 }
  }))
})

const editedFile = encodeCompleteSave(decoded, document)
const verified = decodeCompleteSave(editedFile)
const edited = createSaveGameData(verified, {
  filePath: initial.filePath,
  slotName: initial.slotName,
  profileId: initial.profileId,
  modifiedAt: 2
})
const root = verified.document.SslValue as Record<string, unknown>

assert.equal(edited.money, 777_000)
assert.equal(edited.xp, 888_000)
assert.ok(edited.trucks.every(truck => truck.unlocked))
assert.equal(edited.maps[0]?.progress, 100)
assert.equal(edited.maps[0]?.resources.logs, 101)
assert.deepEqual(verified.document.untouchedTopLevel, { keep: true })
assert.deepEqual(root.unknownGameField, { mustSurvive: true })
assert.deepEqual(root.companyCustomization, (fixture.document.SslValue as Record<string,unknown>).companyCustomization, 'Player edits must preserve every paint field')
assert.equal((root.fobsResources as Record<string, { untouched: string }>).rb_map_01_storm_preparation.untouched, 'yes')
assert.equal(verified.header.readUInt32LE(8), 0x10203040)
assert.equal(verified.header.readUInt32LE(16), 0x50607080)
assert.equal(verified.header[52], 7)
assert.deepEqual(verified.trailingData, Buffer.from([9, 8, 7]))

const corrupted = Buffer.from(editedFile)
corrupted[corrupted.length - 4] ^= 0xff
assert.throws(() => decodeCompleteSave(corrupted), /firma|descomprimir|tamaño/i)

console.log('CompleteSave: codificación, firma, conservación y límites verificados.')
