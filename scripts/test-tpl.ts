import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import * as THREE from 'three'
import { TplReader, readTplModel, decodeTplSurfaces } from '../src/main/tpl-model'
import { arrayObjects } from '../src/main/source-blocks'
import { readMatchingBinaryEntries, readMatchingTextEntries } from '../src/main/zip-package'

assert.throws(() => readTplModel(Buffer.alloc(8)), /Not a Saber/)
assert.throws(() => readTplModel(Buffer.alloc(2)), /truncated/)
assert.throws(() => new TplReader(Buffer.alloc(8)).take(9), /truncated/)
assert.throws(() => new TplReader(Buffer.alloc(8)).value(21), /nesting/)
assert.deepEqual(arrayObjects('wheelSlots = [{ geomName = "a}b" }, { id = 2 }]', 'wheelSlots'), ['{ geomName = "a}b" }', '{ id = 2 }'])

async function main() {
  const game = process.env.ROADCRAFT_GAME_PATH ?? 'E:/SteamLibrary/steamapps/common/RoadCraft'
  const packages = join(game, 'root/paks/client/default')
  if (!existsSync(packages)) { console.log('TPL boundary tests passed; installed-game checks skipped.'); return }
  const classes = await readMatchingTextEntries(join(packages, 'default_other.pak'), name => /trucks\/(?:base\/)?([^/]+)\/\1\.cls$/i.test(name))
  const names = new Set(classes.map(entry => /\bnameTpl\s*=\s*"([a-z0-9_-]+)"/i.exec(entry.content)?.[1]).filter((name): name is string => !!name))
  const report: Array<{ name: string; meshes?: number; vertices?: number; size?: number[]; error?: string }> = []
  for (const packageName of (await readdir(packages)).filter(name => /^default_tpl_\d+\.pak$/i.test(name))) {
    const entries = await readMatchingBinaryEntries(join(packages, packageName), name => names.has(basename(name).replace(/\.tpl(?:_data)?$/, '')), 64 * 1024 * 1024)
    for (const entry of entries.filter(entry => entry.entryName.endsWith('.tpl'))) {
      const name = basename(entry.entryName, '.tpl'), data = entries.find(entry => basename(entry.entryName) === name + '.tpl_data')?.content
      try {
        assert(data, 'Missing TPL_DATA')
        const metadata = readTplModel(entry.content), surfaces = decodeTplSurfaces(metadata, data)
        assert.throws(() => decodeTplSurfaces(metadata, data.subarray(0, 16)), /truncated|range/)
        const box = new THREE.Box3()
        for (const surface of surfaces) {
          assert(surface.indices.every(index => index >= 0 && index < surface.positions.length / 3))
          for (let i = 0; i < surface.normals.length; i += 3) {
            const length = Math.hypot(...surface.normals.slice(i, i + 3))
            assert(Number.isFinite(length) && length < 1.6, 'Invalid normal in ' + surface.name)
          }
          const matrix = new THREE.Matrix4().fromArray(surface.matrix ?? new THREE.Matrix4().elements)
          for (let i = 0; i < surface.positions.length; i += 3) box.expandByPoint(new THREE.Vector3().fromArray(surface.positions, i).applyMatrix4(matrix))
        }
        const size = box.getSize(new THREE.Vector3()).toArray()
        assert(size.every(value => Number.isFinite(value) && value > .1 && value < 150), 'Invalid model bounds')
        report.push({ name, meshes: surfaces.length, vertices: surfaces.reduce((sum, surface) => sum + surface.positions.length / 3, 0), size })
      } catch (error) { report.push({ name, error: error instanceof Error ? error.message : String(error) }) }
    }
  }
  for (const name of names) if (!report.some(entry => entry.name === name)) report.push({ name, error: 'No original TPL in this installation' })
  await mkdir('out/qa-ui', { recursive: true })
  await writeFile('out/qa-ui/tpl-models.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ uniqueModels: names.size, decoded: report.filter(item => !item.error).length, unavailable: report.filter(item => item.error) }, null, 2))
  for (const name of ['aramatsu_bowhead_30t', 'dragline_5111b', 'highway_semitruck_sideboard']) assert(report.some(entry => entry.name === name && !entry.error), name + ' model regression')
  for (const name of ['tuz_119lynx_mod', 'aramatsu_crayfish_wood_grapple_mod']) {
    const root = join(game, 'root/mods_source/models/mods', name + '.tpl.asset/tpl')
    const surfaces = decodeTplSurfaces(readTplModel(await readFile(join(root, name + '.tpl'))), await readFile(join(root, name + '.tpl_data')))
    assert(surfaces.length > 10, 'Official source preview regression')
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
