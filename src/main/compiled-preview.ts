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
import { objectBody, arrayObjects } from './source-blocks'
import { wrapTrackStrip, orientTrackStrip } from './track-geometry'
import { nativeWheelMount } from './wheel-mount'
import type { CompanyPaint, PreviewMaterial, VehiclePreviewAsset } from '../shared'
import { readCompanyPaintLibrary } from './company-paint'

interface Location { path: string; entry: string; metadata: Entry }
interface Descriptor { width: number; height: number; format: number; mips: string[] }
const compress = promisify(gzip), decompress = promisify(gunzip)
export interface WheelSlot { frame: string; model: string; right: boolean; directory?: string; scale?: number; radius?:number; visual?:boolean; offset?:number[] }
export interface TrackLoop { model:string; rollers:WheelSlot[]; segmentLength:number; height:number; segmentBones:string[] }

/** Own, bounded, read-only decoder. Geometry and PNGs are local caches only;
 * none of these game assets are included in the distributed application. */
export class CompiledPreviewStore {
  private models = new Map<string, Location>()
  private textures = new Map<string, Location>()
  private descriptors = new Map<string, Descriptor>()
  private textureDefinitions = new Map<string,string>()
  private definitionLocations = new Map<string,Location>()
  private paints = new Map<string, CompanyPaint>()
  private paintsPrepared?: Promise<void>
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
    const definitionsPath=join(root,'default_td.pak'), definitions=await openPromise(definitionsPath,{lazyEntries:true,strictFileNames:true,validateEntrySizes:true})
    try {for await(const entry of definitions.eachEntry())if(/^td\/[^/]+\.td$/i.test(entry.fileName)&&entry.uncompressedSize<1024*1024)this.definitionLocations.set(basename(entry.fileName,'.td').toLowerCase(),{path:definitionsPath,entry:entry.fileName,metadata:entry})}
    finally {if(definitions.isOpen)definitions.close()}
    await mkdir(this.cacheRoot, { recursive: true })
  }
  private async preparePaints() {
    const path=join(this.installPath,'root/paks/client/default/default_other.pak')
    const [library]=await readMatchingTextEntries(path,n=>n.endsWith('/autogen_designer_wizard/materials/auto_materials_library.sso'))
    this.paints=library ? readCompanyPaintLibrary(library.content) : new Map()
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
  private async textureDefinition(name:string) {
    const key=name.toLowerCase()
    if(!this.textureDefinitions.has(key))this.textureDefinitions.set(key,(await this.load(this.definitionLocations.get(key)))?.toString('utf8')??'')
    return this.textureDefinitions.get(key)!
  }
  async paintColor(material?:string) {
    return (await this.paintProfile(material))?.colors[0]
  }
  async paintProfile(material?:string) {
    if(typeof material!=='string')return
    // The logo can read company colours without indexing every model/texture.
    this.paintsPrepared ??= this.preparePaints(); await this.paintsPrepared
    return this.paints.get(material)
  }
  async withPaint(asset:VehiclePreviewAsset, paint?:CompanyPaint, company=false):Promise<VehiclePreviewAsset> {
    if(!paint)return asset
    const materials:Record<string,PreviewMaterial>={};let partial=!Object.values(asset.materials).some(m=>m.paintable)
    for(const [key,definition] of Object.entries(asset.materials)){
      const mask=definition.paintable ? definition.customizationMasks?.[paint.materialName] : undefined
      const customizationMask=mask ? ['.tga','.dds','.png','.jpg','.jpeg'].map(ext=>asset.textures[mask.toLowerCase()+ext]).find(Boolean) ?? await this.texture(mask) : undefined
      if(definition.paintable && paint.isLivery && !customizationMask)partial=true
      materials[key]={...definition,customizationMask}
    }
    return {...asset,materials,paint,paintColor:paint.colors[0],paintSource:company?'company':'original',paintPartial:partial}
  }
  get(name: string, sourceDirectory?: string, wheels: WheelSlot[] = [], tracks:TrackLoop[] = []) {
    if (!/^[a-z0-9_-]{1,150}$/i.test(name)) return Promise.resolve(undefined)
    const key = `${sourceDirectory ?? ''}:${name}:${JSON.stringify(wheels)}:${JSON.stringify(tracks)}`
    if (!this.previews.has(key)) this.previews.set(key, this.build(name, sourceDirectory, wheels, tracks).catch(error => { console.warn(`Modelo TPL ${name}:`, error instanceof Error ? error.message : error); return undefined }))
    return this.previews.get(key)!
  }
  private async build(name: string, sourceDirectory?: string, wheels: WheelSlot[] = [], tracks:TrackLoop[] = []): Promise<VehiclePreviewAsset | undefined> {
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
      // A wheel's generic "metal" material must not replace the body's texture.
      const materialKey=name+'::'+surface.material
      material.name = materialKey
      materials[materialKey] = { ...(maps.get(surface.texture) ?? { type: 'original', transparent: false }),
        type: /decal/i.test(surface.name) ? 'decal' : /glass/i.test(surface.material) ? 'glass' : 'original', transparent: /glass/i.test(surface.material) }
      const regions=objectBody(await this.textureDefinition(surface.texture),'materials')
      const td=objectBody(regions,String(metadata.splits.find(s=>s.material?.mayaMtl===surface.material)?.material?.shadingMtl_Mtl??'default'))
      const tint=objectBody(td,'tintByMask'), customization=objectBody(td,'customization')
      const color=(field:string)=>new RegExp(`\\b${field}\\s*=\\s*\\[([^\\]]*)\\]`).exec(tint)?.[1].match(/\d+/g)?.map(Number).slice(1,4)
      const mask=/\btintMask\s*=\s*"([a-z0-9_-]+)"/i.exec(tint)?.[1]
      Object.assign(materials[materialKey],{tint:color('albedo'),tintG:color('albedoG'),tintMask:mask?await this.texture(mask):undefined,
        maskFromAlbedoAlpha:/maskFromAlbedoAlpha\s*=\s*true/i.test(tint),paintable:/tintBlendMode\s*=\s*"linear_blend"/i.test(objectBody(customization,'layer0'))})
      if(materials[materialKey].paintable){
        const customizationMasks:Record<string,string>={}
        for(const variant of ['default_cc','default_02_cc','default_03_cc','default_04_cc']){
          const settings=objectBody(objectBody(regions,variant),'customization')
          const texture=/\bmask\s*=\s*"([a-z0-9_-]+)"/i.exec(settings)?.[1]
          if(texture)customizationMasks[variant]=texture
        }
        materials[materialKey].customizationMasks=customizationMasks
      }
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
      const group = nativeWheelMount(frame, slot.offset); group.name = 'preview_wheel_' + slot.frame
      if (!slot.right) wheel.rotateY(Math.PI)
      // Animate the wheel inside its fixed mounting frame, not the frame itself.
      // Steering and non-uniform frame scale must not tilt or squash the tyre.
      wheel.userData.drivenWheel = true; wheel.userData.radius=slot.radius; group.add(wheel); model.add(group)
      Object.assign(materials, asset.materials)
    }
    for(const [i,track] of tracks.entries()) {
      const asset=await this.get(track.model)
      if(!asset)continue
      wheelVersions.push(asset.modelUrl)
      const encoded=await readFile(new URL(asset.modelUrl)),json=asset.modelEncoding==='gzip-json'?await decompress(encoded):encoded
      const strip=new THREE.ObjectLoader().parse(JSON.parse(json.toString('utf8')))
      const guides=track.rollers.flatMap(slot=>{
        const node=metadata.nodes.find(n=>n.name.toLowerCase()===slot.frame.toLowerCase()),p=node?.bindTransform?.slice(12,15),radius=slot.radius??slot.scale??0
        return p&&radius>0?[{x:p[0],y:p[1],z:p[2],radius}]:[]
      })
      const trackMetadata=readTplModel((await this.load(this.models.get(track.model.toLowerCase()+'.tpl')))!)
      const boneCount=track.segmentBones.length
      if(guides.length<2 || !boneCount)continue
      const segmentTransforms=track.segmentBones.map(name=>trackMetadata.nodes.find(n=>n.name===name)?.bindTransform).filter((m):m is number[]=>!!m)
      strip.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return
        const section=orientTrackStrip(object.geometry,segmentTransforms)
        const mesh=new THREE.Mesh(wrapTrackStrip(section,guides,track.segmentLength*boneCount,track.height),object.material);section.dispose()
        mesh.name='preview_track_'+i;mesh.userData.track=true;model.add(mesh)
      })
      Object.assign(materials,asset.materials)
    }
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
    const dimensions=size.toArray()
    // Track strips are deliberately almost flat before they wrap around rollers.
    const trackSection=/(?:_track|_chain)$/.test(name)
    if (!dimensions.every(value => Number.isFinite(value) && value > (trackSection ? .00001 : .1) && value < 150) || dimensions.filter(value=>value>.1).length < (trackSection ? 2 : 3)) throw new Error('TPL dimensions outside preview limits')
    const target = join(this.cacheRoot, createHash('sha1').update(tpl).update(data).update(JSON.stringify(wheels)).update(JSON.stringify(tracks)).update(JSON.stringify(wheelVersions)).update('geometry-v11').digest('hex') + '.json.gz')
    if (!existsSync(target)) await this.writeCache(target, await compress(JSON.stringify(model.toJSON())))
    model.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose() } })
    return { format: 'tpl', modelEncoding: 'gzip-json', modelUrl: pathToFileURL(target).href, modelImportScale: 1, wheelImportScale: 1, wheelScale: 1, textures: {}, materials }
  }
}
