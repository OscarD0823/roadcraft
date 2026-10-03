/** Read-only RoadCraft TPL metadata. Independent implementation; format research
 * references are documented in docs/vehicle-research.md. Never repairs game data. */
export class TplReader {
  offset = 0
  constructor(readonly data: Buffer) {}
  take(size: number) {
    if (!Number.isSafeInteger(size) || size < 0 || this.offset + size > this.data.length) throw new Error(`TPL truncated at ${this.offset}`)
    const start = this.offset; this.offset += size; return start
  }
  u8() { return this.data.readUInt8(this.take(1)) }
  u16() { return this.data.readUInt16LE(this.take(2)) }
  i16() { return this.data.readInt16LE(this.take(2)) }
  u32() { return this.data.readUInt32LE(this.take(4)) }
  f32() { const value = this.data.readFloatLE(this.take(4)); if (!Number.isFinite(value)) throw new Error('TPL invalid float'); return value }
  count(value: number, max = 10000) { if (value > max) throw new Error(`TPL count ${value} exceeds ${max}`); return value }
  string(short = false) { const length = this.count(short ? this.u16() : this.u32(), 65536); const start = this.take(length); return this.data.toString('utf8', start, start + length) }
  floats(count: number) { return Array.from({ length: count }, () => this.f32()) }
  bits(short = true) { const count = this.count(short ? this.u16() : this.u32(), 128), start = this.take(Math.ceil(count / 8)); return Array.from({ length: count }, (_, i) => !!(this.data[start + (i >> 3)] & (1 << (i % 8)))) }
  jump(end: number) { if (!Number.isSafeInteger(end) || end < this.offset || end > this.data.length) throw new Error(`TPL invalid section ${this.offset} → ${end}`); this.offset = end }
  section() { const id = this.u16(), end = this.u32(); if (end < this.offset || end > this.data.length) throw new Error('TPL invalid section end'); return { id, end } }
  object(depth = 0): Record<string, unknown> {
    if (depth > 20) throw new Error('TPL material nesting too deep')
    const result: Record<string, unknown> = {}
    for (let i = 0, count = this.count(this.u32()); i < count; i++) { const key = this.string(); result[key] = this.value(depth + 1) }
    return result
  }
  value(depth: number): unknown {
    if (depth > 20) throw new Error('TPL material nesting too deep')
    const type = this.u32()
    if (type === 1) return this.u32()
    if (type === 2) return this.f32()
    if (type === 3) return !!this.u8()
    if (type === 4) return this.string()
    if (type === 7) return this.object(depth)
    if (type === 6) return Array.from({ length: this.count(this.u32()) }, () => this.value(depth + 1))
    throw new Error(`TPL unsupported material type ${type}`)
  }
}

// matrLT is the bind transform in model space, not the separate DCC matModel.
export interface TplNode { id: number; name: string; parent: number; bindTransform?: number[]; dccTransform?: number[]; splitStart?: number; splitCount?: number }
export interface TplStream { bits: boolean[]; stride: number; length: number; offset: number }
export interface TplMesh { bits: boolean[]; streams: Array<{ id: number; offset: number }> }
export interface TplSplit { vertexOffset: number; vertexCount: number; faceOffset: number; faceCount: number; node: number; skin: number; mesh: number; bones?: number[]; uvScale?: number; position?: number[]; scale?: number[]; material?: Record<string, unknown> }
export interface TplModel { nodes: TplNode[]; streams: TplStream[]; meshes: TplMesh[]; splits: TplSplit[] }

export interface TplSurface {
  name: string; material: string; texture: string; positions: number[]; normals: number[]; uvs: number[]; indices: number[]; matrix?: number[]
}

/** Decode the independent vertex/attribute/index streams, preserving topology.
 * Packed positions use each split's integer origin/extent, not a guessed scale. */
export function decodeTplSurfaces(model: TplModel, data: Buffer): TplSurface[] {
  const result: TplSurface[] = []
  let totalVertices = 0
  for (const split of model.splits) {
    const node = model.nodes[split.node]
    if (!node || /(?:^|_)cdt(?:$|_)|collision|(?:^|_)hp_|cutoff|physical|(?:^|_)sfx_|_lod[1-9]|^_load_(?:volume|border)/i.test(node.name)) continue
    // Extra baked splits already replace these skinned first-person/animated surfaces.
    if (split.skin >= 0 && model.splits.some(s=>s.node === split.skin && s.skin < 0)) continue
    const mesh = model.meshes[split.mesh]
    if (!mesh) throw new Error('TPL split references missing mesh')
    const refs = mesh.streams.map(ref => ({ ref, stream: model.streams[ref.id] }))
    const vertices = refs.find(s => s.stream?.bits[0]), faces = refs.find(s => s.stream?.stride === 6 && !s.stream.bits.some(Boolean)), attributes = refs.find(s => s.stream?.bits[25])
    const boneIndices=refs.find(s=>s.stream?.bits[9]), weights=refs.find(s=>s.stream?.bits[7])
    if (!vertices || !faces) throw new Error(`TPL ${node.name} is missing a geometry stream`)
    const f = vertices.stream.bits
    const packedNormal = f[45], floatNormal = f[10] && !f[11]
    if (!f[3] || (!packedNormal && !floatNormal) || vertices.stream.stride < (packedNormal ? 8 : 18) || f[2] || f[69]) throw new Error(`TPL vertex layout not supported: ${node.name}, stride ${vertices.stream.stride}, flags ${f.flatMap((set, i) => set ? [i] : []).join(',')}`)
    if ((totalVertices += split.vertexCount) > 2_000_000) throw new Error('TPL preview exceeds vertex limit')
    const surface: TplSurface = { name: node.name, material: String(split.material?.mayaMtl ?? 'default'), texture: String(split.material?.shadingMtl_Tex ?? ''), positions: [], normals: [], uvs: [], indices: [], matrix: node.bindTransform }
    const r = new TplReader(data)
    for (let i = 0; i < split.vertexCount; i++) {
      const offset = vertices.stream.offset + vertices.ref.offset + (split.vertexOffset + i) * vertices.stream.stride
      r.offset = offset
      if (offset < vertices.stream.offset || offset + vertices.stream.stride > vertices.stream.offset + vertices.stream.length) throw new Error('TPL vertex range outside stream')
      for (let axis = 0; axis < 3; axis++) surface.positions.push(Math.max(-1, r.i16() / 32767) * (split.scale?.[axis] ?? 1) + (split.position?.[axis] ?? 0))
      if (packedNormal) {
        const packed = r.i16(), w = packed === -32768 ? 0 : packed, frac = (x: number) => x - Math.floor(x)
        const nx = (-1 + 2 * frac(Math.abs(w) / 181)) * 181 / 179, nz = (-1 + 2 * frac(Math.abs(w) / 32761)) * 181 / 180
        surface.normals.push(nx, Math.sign(w) * Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz)), nz)
      } else {
        if (f[1]) r.take(2) // Fourth compressed position component is not a normal.
        if (f[7]) r.take(4) // Four normalized skin weights precede the normal.
        if (f[9]) r.take(4) // Four byte-sized bone indices.
        if (f[67]) r.take(4)
        surface.normals.push(r.f32(), r.f32(), r.f32())
      }
      // Compiled rigid skin indices can be in a separate stream. These
      // vertices are already in bone-local space: apply their indexed matrLT,
      // not a guessed mesh transform or a second inverse bind matrix.
      // Weighted surfaces retain their exported rest pose; only rigid,
      // pre-transformed index streams need this extra bind transformation.
      if(boneIndices && !weights) {
        const skin=new TplReader(data),begin=boneIndices.stream.offset+boneIndices.ref.offset+(split.vertexOffset+i)*boneIndices.stream.stride+(boneIndices.stream.bits[0]?8:0)+(boneIndices.stream.bits[7]?4:0)
        if(begin+4>boneIndices.stream.offset+boneIndices.stream.length)throw new Error('TPL bone range outside stream')
        skin.offset=begin;const ids=Array.from({length:4},()=>skin.u8())
        const id=split.bones?.[ids[0]]??ids[0],matrix=model.nodes[id]?.bindTransform
        if(!matrix)throw new Error('TPL references missing bone transform')
        const p=surface.positions.slice(-3),n=surface.normals.slice(-3),position=[0,0,0],normal=[0,0,0]
        for(let axis=0;axis<3;axis++) {
          position[axis]=matrix[axis]*p[0]+matrix[4+axis]*p[1]+matrix[8+axis]*p[2]+matrix[12+axis]
          normal[axis]=matrix[axis]*n[0]+matrix[4+axis]*n[1]+matrix[8+axis]*n[2]
        }
        const normalLength=Math.hypot(...normal)||1
        surface.positions.splice(surface.positions.length-3,3,...position)
        surface.normals.splice(surface.normals.length-3,3,...normal.map(v=>v/normalLength))
        surface.matrix=undefined
      }
      if (attributes) {
        const a = attributes.stream.bits
        let uvOffset = 0
        for (let b = 12; b <= 16; b++) if (a[b]) uvOffset += a[17] ? 4 : 16
        for (const b of [22, 23, 24, 46, 47, 63]) if (a[b]) uvOffset += 4
        if (a[68]) uvOffset += 2
        r.offset = attributes.stream.offset + attributes.ref.offset + (split.vertexOffset + i) * attributes.stream.stride + uvOffset
        if (r.offset < attributes.stream.offset || r.offset + (a[30] ? 4 : 8) > attributes.stream.offset + attributes.stream.length) throw new Error('TPL UV range outside stream')
        const scale = split.uvScale ?? 1
        surface.uvs.push(a[30] ? r.i16() / 32767 * scale : r.f32(), a[30] ? r.i16() / 32767 * scale : r.f32())
      }
    }
    r.offset = faces.stream.offset + faces.ref.offset + split.faceOffset * faces.stream.stride
    if (r.offset + split.faceCount * 6 > faces.stream.offset + faces.stream.length) throw new Error('TPL face range outside stream')
    for (let i = 0; i < split.faceCount * 3; i++) {
      const index = r.u16() - split.vertexOffset
      if (index < 0 || index >= split.vertexCount) throw new Error(`TPL face index ${index} out of range for ${node.name}`)
      surface.indices.push(index)
    }
    result.push(surface)
  }
  if (!result.length) throw new Error('TPL has no exterior surfaces')
  return result
}

export function readTplModel(data: Buffer): TplModel {
  const r = new TplReader(data)
  if (r.u32() !== 0x52455331 || r.u32() !== 0x006c7074) throw new Error('Not a Saber TPL resource')
  const graphOffset = data.indexOf('OGM1', 64)
  if (graphOffset < 0 || data.indexOf('OGM1', graphOffset + 4) >= 0) throw new Error('TPL geometry graph not uniquely identified')
  r.offset = graphOffset + 4
  const propertyCount = r.u32() & 65535
  const version = r.u16()
  if (propertyCount > 10 || version !== 3) throw new Error(`TPL graph version ${version} not supported`)
  const flags = propertyCount > 8 ? r.u16() : r.u8()
  const model: TplModel = { nodes: [], streams: [], meshes: [], splits: [] }
  if (flags & 1) {
    const count = r.count(r.u16()), ignoredVersion = r.u16(), props = r.u16(); r.u16()
    if (props > 18) throw new Error(`TPL node property count ${props} not supported`)
    model.nodes = Array.from({ length: count }, (_, id) => ({ id, name: `node_${id}`, parent: -1 }))
    for (let property = 0; property < props; property++) {
      if (!r.u8()) continue
      if (property === 11) {
        const start = r.take(Math.ceil(count / 8))
        for (let i = 0; i < count; i++) if (data[start + (i >> 3)] & (1 << (i % 8))) {
          const node = model.nodes[i]; const fields = r.u32(), present = r.u8()
          if (fields > 4) throw new Error('TPL unknown node geometry layout')
          if (present & 1) node.splitStart = r.u32()
          if (present & 2) node.splitCount = r.u32()
          if (present & 4) r.take(24)
          if (present & 8) r.take(60)
        }
      } else for (const node of model.nodes) {
        if (property === 0) node.id = r.i16()
        else if (property === 1) node.name = r.string()
        else if (property === 2) r.take(8)
        else if (property === 3) node.parent = r.i16()
        else if ([4, 5, 6, 7].includes(property)) r.take(2)
        else if ([8, 12, 16, 17].includes(property)) r.string()
        else if (property === 9) node.bindTransform = r.floats(16)
        else if (property === 10) node.dccTransform = r.floats(16)
        else if (property === 13) r.take(60)
        else if (property === 14) node.name = r.string(true)
        else throw new Error(`TPL unknown node property ${property} at ${r.offset}`)
      }
    }
  }
  if (flags & 2) { const count = r.count(r.u32()); if (r.u8()) r.take(count * 16) }
  if (flags & 4) { const count = r.count(r.u32()); if (r.u8()) for (let i = 0; i < count; i++) { r.u32(); r.string() } }
  if (flags & 8) {
    const count = r.count(r.u32()), props = r.count(r.u32(), 6)
    for (let prop = 0; prop < props; prop++) {
      if (!r.u8()) continue
      for (let i = 0; i < count; i++) {
        if (prop < 2) r.take(r.count(r.u32()) * 4)
        else if (prop === 2) { const n = r.count(r.u32()); r.u32(); if (r.u8()) r.take(n * 4) }
        else r.take(prop === 3 ? 24 : prop === 4 ? 4 : 1)
      }
    }
  }
  // Current RoadCraft PC vehicle graphs do not have vBufferMapping. Refuse
  // unknown layouts instead of interpreting them as coordinates.
  if (flags & 16) throw new Error('TPL mapped vertex buffers not supported')
  const names: string[] = []
  if (flags & 32) { const count = r.count(r.u32()); if (r.u8()) for (let i = 0; i < count; i++) names.push(r.string()) }
  if (flags & 64) { const count = r.count(r.u32()); for (let i = 0; i < count; i++) { const node = model.nodes[r.u16()]; if (node && names[i]) node.name = names[i] } }
  if (flags & 128) { const count = r.count(r.u32()); for (let i = 0; i < count; i++) { const matrix = r.floats(16); if (model.nodes[i]) model.nodes[i].bindTransform = matrix } }
  if (flags & 256) { const count = r.count(r.u32()); for (let i = 0; i < count; i++) { const matrix = r.floats(16); if (model.nodes[i]) model.nodes[i].dccTransform = matrix } }
  if (flags & 512) { const count = r.count(r.u32()), props = r.count(r.u32(), 2); for (let p = 0; p < props; p++) if (r.u8()) for (let i = 0; i < count; i++) { const value = r.i16(); if (model.nodes[i]) { if (!p) model.nodes[i].splitStart = value; else model.nodes[i].splitCount = value } } }
  let bufferCount = 0, meshCount = 0, splitCount = 0
  while (r.offset < data.length) {
    const section = r.section()
    if (section.id === 65535) { r.jump(section.end); break }
    if (section.id === 0) { r.i16(); r.u32(); bufferCount = r.count(r.u32()); meshCount = r.count(r.u32()); splitCount = r.count(r.u32()); r.take(8) }
    else if (section.id === 2) {
      model.streams = Array.from({ length: bufferCount }, () => ({ bits: [], stride: 0, length: 0, offset: 0 }))
      while (r.offset < section.end) {
        const sub = r.section()
        if (sub.id === 0) for (const stream of model.streams) stream.bits = r.bits()
        else if (sub.id === 1) for (const stream of model.streams) stream.stride = r.u16()
        else if (sub.id === 2) { let offset = 0; for (const stream of model.streams) { stream.length = r.u32(); stream.offset = offset; offset += stream.length } }
        else if (sub.id === 3) throw new Error('Embedded TPL streams not supported')
        r.jump(sub.end)
      }
    } else if (section.id === 3) {
      model.meshes = Array.from({ length: meshCount }, () => ({ bits: [], streams: [] }))
      while (r.offset < section.end) {
        const sub = r.section()
        if (sub.id === 0) for (const mesh of model.meshes) mesh.bits = r.bits()
        else if (sub.id === 2) for (const mesh of model.meshes) mesh.streams = Array.from({ length: r.count(r.u8(), 16) }, () => ({ id: r.u32(), offset: r.u32() }))
        r.jump(sub.end)
      }
    } else if (section.id === 4) {
      model.splits = Array.from({ length: splitCount }, () => ({ vertexOffset: 0, vertexCount: 0, faceOffset: 0, faceCount: 0, node: -1, skin: -1, mesh: 0 }))
      while (r.offset < section.end) {
        const sub = r.section()
        if (sub.id === 0) {
          const extra = sub.end - r.offset > model.splits.length * 12
          for (const split of model.splits) {
          split.vertexOffset = r.u16(); split.vertexCount = r.u16(); split.faceOffset = r.u16(); split.faceCount = r.u16(); split.node = r.i16(); split.skin = r.i16()
          if (extra) { let flags = r.u32(); for (let i = 0; i < 32; i++) { if (flags & 1) r.take(8); flags = (flags << 1) | (flags >>> 31) } }
          }
        }
        else if (sub.id === 1) for (const split of model.splits) split.mesh = r.u32()
        else if (sub.id === 3) { for (const split of model.splits) if (model.meshes[split.mesh].bits[9]) split.bones = Array.from({ length: r.count(r.u8(), 255) }, () => r.i16()) }
        else if (sub.id === 4) { for (const split of model.splits) if (model.meshes[split.mesh].bits[30]) for (let i = 0, count = r.u8(); i < count; i++) { const uv = r.u8(), scale = r.i16(); if (!uv) split.uvScale = scale } }
        else if (sub.id === 5) { for (const split of model.splits) if (model.meshes[split.mesh].bits[3]) { split.position = [r.i16(), r.i16(), r.i16()]; split.scale = [r.i16(), r.i16(), r.i16()] } }
        else if (sub.id === 8) for (const split of model.splits) { split.node = r.u16(); split.material = r.object() }
        r.jump(sub.end)
      }
    }
    r.jump(section.end)
  }
  if (!model.nodes.length || !model.splits.length || !model.streams.length) throw new Error('TPL has no usable geometry')
  return model
}
