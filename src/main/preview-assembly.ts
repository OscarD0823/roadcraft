import { arrayObjects, objectBody } from './source-blocks'
import type { WheelSlot, TrackLoop } from './compiled-preview'
const numberField = (s: string, f: string) => Number(new RegExp(`\\b${f}\\s*=\\s*([-+.0-9e]+)`, 'i').exec(s)?.[1] ?? NaN)
const stringField = (s: string, f: string) => new RegExp(`\\b${f}\\s*=\\s*"([a-z0-9_-]+)"`, 'i').exec(s)?.[1]

export function previewMobility(source: string): 'road' | 'rail' | 'stationary' {
  const tag = stringField(objectBody(source, 'prop_tagged'), 'tag') ?? ''
  if (/RAILROAD_CRANE|TOWER_CRANE_RAILED/.test(tag)) return 'rail'
  return /\bisStaticTruck\s*=\s*True\b/i.test(source) || /STATIONARY/.test(tag) ? 'stationary' : 'road'
}

/** Scale and visual rollers come from the game's configuration, not dimensions guessed from a picture. */
export function previewAssembly(source: string, definitions: Array<{entryName: string; content: string}>) {
  const pool = objectBody(objectBody(source, 'prop_truck_rb'), 'wheelPool')
  const aliases = new Map([...pool.matchAll(/([a-z0-9_]+)\s*=\s*\{\s*__value\s*=\s*"([a-z0-9_]+)"/gi)].map(m=>[m[1],m[2]]))
  function slot(raw: string): WheelSlot | undefined {
    const frame = stringField(raw, 'geomName'), alias = stringField(raw, 'editableWheel')
    const definition = definitions.find(d=>d.entryName.replace(/^.*\//,'').replace(/\.cls$/,'')===aliases.get(alias??''))
    if (!frame || !definition) return
    const model = stringField(objectBody(definition.content, 'geom'), 'nameTpl')
    const physical = objectBody(definition.content, 'prop_truck_wheel'), visual = objectBody(definition.content, 'prop_truck_visual_wheel')
    const radius = numberField(physical,'radius'), geomRadius = numberField(physical,'geomRadius')
    const visualScale = numberField(visual,'scale')
    const offset = ['x','y','z'].map(axis => numberField(objectBody(raw,'offset'),axis) || 0)
    const scale = Number.isFinite(visualScale) ? visualScale : Number.isFinite(radius) ? radius/(Number.isFinite(geomRadius)&&geomRadius>0 ? geomRadius : 1) : 1
    return { frame, model: model??'', right:/isRightSided\s*=\s*True/i.test(raw), scale, radius: Number.isFinite(radius)?radius:scale, visual: !!visual, offset }
  }
  const physical = arrayObjects(source,'wheelSlotWithDescs').map(slot)
  const wheels = physical.filter((s):s is WheelSlot=>!!s && !!s.model)
  const tracks: TrackLoop[] = []
  for(const raw of arrayObjects(objectBody(source,'prop_truck_track'),'tracks')) {
    const section = objectBody(raw,'section'), model = stringField(section,'tpl')
    const visual = arrayObjects(raw,'visualWheelSlots').map(slot).filter((s):s is WheelSlot=>!!s)
    wheels.push(...visual.filter(s=>s.model))
    const ids = /wheelIds\s*=\s*\[([^\]]*)\]/.exec(raw)?.[1].match(/\d+/g)?.map(Number)??[]
    const rollers = [...ids.map(i=>physical[i]).filter((s):s is WheelSlot=>!!s),...visual]
    const segmentBones=[...(/segmentBones\s*=\s*\[([^\]]*)\]/.exec(section)?.[1]??'').matchAll(/"([a-z0-9_]+)"/gi)].map(m=>m[1])
    if(model && rollers.length>=2) tracks.push({model,rollers,segmentLength:numberField(section,'segmentLength'),height:numberField(section,'height'),segmentBones})
  }
  return { wheels:[...new Map(wheels.map(w=>[w.frame,w])).values()], tracks }
}
