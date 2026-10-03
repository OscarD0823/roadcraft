import { openPromise, type Entry } from 'yauzl'
import { mkdir, readFile, readdir, stat, writeFile, rename, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { gzip, gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import * as THREE from 'three'
import { decodeBC1, decodeBC3, decodeBC5, decodeBC7, makePNG } from 'tex-decoder'
import { readTplModel, decodeTplSurfaces } from './tpl-model'
import { readMatchingTextEntries } from './zip-package'
import type { PreviewMaterial, VehiclePreviewAsset } from '../shared'

interface Location { path: string; entry: string; metadata: Entry }
interface Descriptor { width: number; height: number; format: number; mips: string[] }
const compress = promisify(gzip), decompress = promisify(gunzip)
export interface WheelSlot { frame: string; model: string; right: boolean; directory?: string; scale?: number }

/** Own, bounded, read-only decoder. Geometry and PNGs are local caches only;
 * none of these game assets are included in the distributed application. */
export class CompiledPreviewStore {
  private models = new Map<string, Location>()
  private textures = new Map<string, Location>()
  private descriptors = new Map<string, Descriptor>()
  private prepared?: Promise<void>
  private previews = new Map<string, Promise<VehiclePreviewAsset | undefined>>()
  constructor(private readonly installPath: string, private readonly cacheRoot: string) {}
  private async prepare() {
    const root = join(this.installPath, 'root', 'paks', 'client', 'default')
    const files = (await readdir(root)).filter(name => /^default_(?:tpl|pct)_\d+\.pak$/i.test(name)).sort()
    for (const file of files) {
      const path = join(root, file), archive = await openPromise(path, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true })
      try {
        for await (const entry of archive.eachEntry()) {
          if (entry.uncompressedSize > 64 * 1024 * 1024) continue
          const name = basename(entry.fileName).toLowerCase()
          if (/\.tpl(?:_data)?$/.test(name)) this.models.set(name, { path, entry: entry.fileName, metadata: entry })
          if (/_\d+\.pct_mip$/.test(name)) this.textures.set(name, { path, entry: entry.fileName, metadata: entry })
        }
      } finally { if (archive.isOpen) archive.close() }
    }
    const resources = await readMatchingTextEntries(join(this.installPath, 'root', 'paks', 'client', 'resources.pak'), name => /^pct\/[^/]+\.pct\.resource$/i.test(name))
    for (const resource of resources) {
      const width = Number(/^\s+sx:\s*(\d+)$/m.exec(resource.content)?.[1]), height = Number(/^\s+sy:\s*(\d+)$/m.exec(resource.content)?.[1]), format = Number(/^\s+format:\s*(\d+)$/m.exec(resource.content)?.[1])
      const mips = [...resource.content.matchAll(/^-\s+([a-z0-9_-]+\.pct_mip)\s*$/gmi)].map(match => match[1].toLowerCase())
      if (width > 0 && height > 0 && width <= 32768 && height <= 32768 && mips.length) this.descriptors.set(basename(resource.entryName, '.pct.resource').toLowerCase(), { width, height, format, mips })
    }
    await mkdir(this.cacheRoot, { recursive: true })
  }
  private async load(location?: Location) {
    if (!location) return
    // The index already contains the local-header offset. Do not enumerate a
    // multi-gigabyte package again for every material mip or model component.
    const archive = await openPromise(location.path, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true })
    try {
      const chunks: Buffer[] = []
      let length = 0
      for await (const chunk of await archive.openReadStreamPromise(location.metadata)) {
        length += chunk.length
        if (length > 64 * 1024 * 1024) throw new Error('Preview resource exceeds size limit')
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      return Buffer.concat(chunks)
    } finally { if (archive.isOpen) archive.close() }
  }
  private async loadSource(path: string) {
    if ((await stat(path)).size > 64 * 1024 * 1024) throw new Error('Source model exceeds preview limit')
    return readFile(path)
  }
  private async writeCache(target: string, content: Buffer) {
    const temporary = target + '.' + randomUUID() + '.tmp'
    try { await writeFile(temporary, content); await rename(temporary, target) }
    finally { await rm(temporary, { force: true }) }
  }
  private async texture(name: string) {
    const descriptor = this.descriptors.get(name.toLowerCase())
    if (!descriptor) return
    let mip = Math.max(0, Math.ceil(Math.log2(Math.max(descriptor.width, descriptor.height) / 1024)))
    // The first stored mip may be named _1 or _2 even when its logical index
    // is zero. Only the resource descriptor defines that correspondence.
    while (mip > 0 && !this.textures.has(descriptor.mips[mip])) mip--
    const location = this.textures.get(descriptor.mips[mip])
    if (!location) return
    const signature = await stat(location.path)
    const digest = createHash('sha1').update(`${location.entry}|${signature.size}|${signature.mtimeMs}|${descriptor.width}x${descriptor.height}|${mip}|pct-original-v2`).digest('hex')
    const target = join(this.cacheRoot, digest + '.png')
    if (existsSync(target)) return pathToFileURL(target).href
    const data = await this.load(location)
    if (!data) return
    const width = Math.max(1, descriptor.width >> mip), height = Math.max(1, descriptor.height >> mip)
    const blocks = Math.ceil(width / 4) * Math.ceil(height / 4)
    const decode = [51, 52].includes(descriptor.format) ? decodeBC7 : descriptor.format === 36 ? decodeBC5 : [12, 13].includes(descriptor.format) ? decodeBC1 : [16, 17].includes(descriptor.format) ? decodeBC3 : undefined
    if (!decode || data.length !== blocks * ([12, 13].includes(descriptor.format) ? 8 : 16)) return
    const rgba = decode(data, width, height)
    if (descriptor.format === 36) for (let i = 0; i < rgba.length; i += 4) {
      const x = rgba[i] / 127.5 - 1, y = rgba[i + 1] / 127.5 - 1
      rgba[i + 2] = Math.round((Math.sqrt(Math.max(0, 1 - x * x - y * y)) + 1) * 127.5); rgba[i + 3] = 255
    }
    await this.writeCache(target, Buffer.from(makePNG(rgba, width, height)))
    return pathToFileURL(target).href
  }
  get(name: string, sourceDirectory?: string, wheels: WheelSlot[] = []) {
    if (!/^[a-z0-9_-]{1,150}$/i.test(name)) return Promise.resolve(undefined)
    const key = `${sourceDirectory ?? ''}:${name}:${JSON.stringify(wheels)}`
    if (!this.previews.has(key)) this.previews.set(key, this.build(name, sourceDirectory, wheels).catch(error => { console.warn(`Modelo TPL ${name}:`, error instanceof Error ? error.message : error); return undefined }))
    return this.previews.get(key)!
  }
  private async build(name: string, sourceDirectory?: string, wheels: WheelSlot[] = []): Promise<VehiclePreviewAsset | undefined> {
    this.prepared ??= this.prepare()
    await this.prepared
    const tpl = sourceDirectory ? await this.loadSource(join(sourceDirectory, name + '.tpl')) : await this.load(this.models.get(name.toLowerCase() + '.tpl'))
    const data = sourceDirectory ? await this.loadSource(join(sourceDirectory, name + '.tpl_data')) : await this.load(this.models.get(name.toLowerCase() + '.tpl_data'))
    if (!tpl || !data) return
    const metadata = readTplModel(tpl), surfaces = decodeTplSurfaces(metadata, data)
    const model = new THREE.Group(), materials: Record<string, PreviewMaterial> = {}
    const textures = new Set(surfaces.map(surface => surface.texture).filter(name => name && !name.startsWith('sc_')))
    const maps = new Map<string, PreviewMaterial>()
    for (const texture of textures) maps.set(texture, { type: 'original', transparent: false,
      albedo: await this.texture(texture), normal: await this.texture(texture + '_nm'), shading: await this.texture(texture + '_spec') })
    for (const surface of surfaces) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.positions, 3))
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(surface.normals, 3))
      if (surface.uvs.length) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(surface.uvs, 2))
      geometry.setIndex(surface.indices)
      if (surface.matrix) geometry.applyMatrix4(new THREE.Matrix4().fromArray(surface.matrix))
      const material = new THREE.MeshStandardMaterial({ color: 0xb4b7ab })
      material.name = surface.material
      materials[surface.material] = { ...(maps.get(surface.texture) ?? { type: 'original', transparent: false }),
        type: /decal/i.test(surface.name) ? 'decal' : /glass/i.test(surface.material) ? 'glass' : 'original', transparent: /glass/i.test(surface.material) }
      const mesh = new THREE.Mesh(geometry, material); mesh.name = surface.name; model.add(mesh)
    }
    const wheelVersions: string[] = []
    for (const slot of wheels) {
      const frame = metadata.nodes.find(node => node.name.toLowerCase() === slot.frame.toLowerCase())
      if (!frame?.bindTransform) continue
      const asset = await this.get(slot.model, slot.directory)
      if (!asset) continue
      wheelVersions.push(asset.modelUrl)
      const encoded = await readFile(new URL(asset.modelUrl))
      const json = asset.modelEncoding === 'gzip-json' ? await decompress(encoded) : encoded
      const wheel = new THREE.ObjectLoader().parse(JSON.parse(json.toString('utf8')))
      if (slot.scale && slot.scale > 0 && slot.scale <= 10) wheel.scale.multiplyScalar(slot.scale)
      const group = new THREE.Group(); group.name = 'preview_wheel_' + slot.frame
      new THREE.Matrix4().fromArray(frame.bindTransform).decompose(group.position, group.quaternion, group.scale)
      if (!slot.right) { wheel.rotateY(Math.PI); group.userData.rollSign = -1 }
      group.userData.drivenWheel = true; group.add(wheel); model.add(group)
      Object.assign(materials, asset.materials)
    }
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
    if (!size.toArray().every(value => value > .1 && value < 150)) throw new Error('TPL dimensions outside preview limits')
    const target = join(this.cacheRoot, createHash('sha1').update(tpl).update(data).update(JSON.stringify(wheels)).update(JSON.stringify(wheelVersions)).update('geometry-v5').digest('hex') + '.json.gz')
    if (!existsSync(target)) await this.writeCache(target, await compress(JSON.stringify(model.toJSON())))
    model.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose() } })
    return { format: 'tpl', modelEncoding: 'gzip-json', modelUrl: pathToFileURL(target).href, modelImportScale: 1, wheelImportScale: 1, wheelScale: 1, textures: {}, materials }
  }
}
