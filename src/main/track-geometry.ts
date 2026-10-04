import * as THREE from 'three'

export interface TrackGuide { x: number; y: number; z: number; radius: number }
/** Track strips do not all use the same export axis (Dragline uses +Z,
 * Bowhead uses -X). Read their own segment bones before wrapping them. */
export function orientTrackStrip(source:THREE.BufferGeometry, bones:number[][]) {
  if(bones.length<2)throw new Error('Missing track segment transforms')
  const origin=new THREE.Vector3().fromArray(bones[0],12)
  const along=new THREE.Vector3().fromArray(bones.at(-1)!,12).sub(origin)
  if(along.length()<.001)throw new Error('Invalid track segment direction')
  along.normalize()
  const up=new THREE.Vector3().fromArray(bones[0],4).normalize(), across=new THREE.Vector3().crossVectors(up,along).normalize()
  up.crossVectors(along,across).normalize()
  const matrix=new THREE.Matrix4().set(-along.x,-along.y,-along.z,along.dot(origin),up.x,up.y,up.z,-up.dot(origin),across.x,across.y,across.z,-across.dot(origin),0,0,0,1)
  return source.clone().applyMatrix4(matrix)
}
/** Rest-pose outline from the configured rollers. Actual game suspension/sag is not simulated. */
export function trackOutline(guides: TrackGuide[], padding = 0) {
  const points = guides.flatMap(g=>Array.from({length:48},(_,i)=>{
    const angle = i*Math.PI/24, radius = g.radius+padding
    return new THREE.Vector2(g.z+Math.cos(angle)*radius,g.y+Math.sin(angle)*radius)
  })).sort((a,b)=>a.x-b.x || a.y-b.y)
  const cross = (a:THREE.Vector2,b:THREE.Vector2,c:THREE.Vector2)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
  const half = (input:THREE.Vector2[])=>{const hull:THREE.Vector2[]=[];for(const p of input){while(hull.length>=2&&cross(hull.at(-2)!,hull.at(-1)!,p)<=0)hull.pop();hull.push(p)}return hull.slice(0,-1)}
  const loop=[...half(points),...half([...points].reverse())].reverse()
  if(loop.length<3) throw new Error('Invalid track guides')
  const lengths=[0]
  for(let i=0;i<loop.length;i++)lengths.push(lengths.at(-1)!+loop[i].distanceTo(loop[(i+1)%loop.length]))
  const length=lengths.at(-1)!
  function sampleInto(distance:number, output:number[]) {
    const s=(distance%length+length)%length
    let low=0,high=loop.length-1
    while(low<high){const mid=Math.ceil((low+high)/2);if(lengths[mid]<=s)low=mid;else high=mid-1}
    const i=low
    const a=loop[i],b=loop[(i+1)%loop.length],t=(s-lengths[i])/(lengths[i+1]-lengths[i])
    const edge=lengths[i+1]-lengths[i]
    output[0]=a.x+(b.x-a.x)*t;output[1]=a.y+(b.y-a.y)*t
    output[2]=(b.x-a.x)/edge;output[3]=(b.y-a.y)/edge
  }
  return {length, sampleInto, sample(distance:number){
    const values:number[]=[];sampleInto(distance,values)
    return {point:new THREE.Vector2(values[0],values[1]),tangent:new THREE.Vector2(values[2],values[3])}
  }}
}

/** Bend the original link strip along its own wheel outline; keep original topology/UVs. */
export function wrapTrackStrip(source: THREE.BufferGeometry, guides: TrackGuide[], span:number, height:number) {
  const outline=trackOutline(guides,Math.max(0,height)/2), repeats=Math.max(1,Math.round(outline.length/span))
  const vertices=source.getAttribute('position'),normal=source.getAttribute('normal'),uv=source.getAttribute('uv'),indices=source.getIndex()
  if(!indices || !Number.isFinite(span) || span<=.01 || repeats>300 || vertices.count*repeats>1_000_000) throw new Error('Track geometry exceeds preview limits')
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],faces:number[]=[],coordinates:number[]=[],restNormals:number[]=[],x=guides.reduce((sum,g)=>sum+g.x,0)/guides.length
  const factor=outline.length/(repeats*span)
  for(let repeat=0;repeat<repeats;repeat++) {
    for(let i=0;i<vertices.count;i++) {
      const distance=(repeat*span-vertices.getX(i))*factor
      const {point,tangent}=outline.sample(distance)
      coordinates.push(distance,vertices.getY(i),x+vertices.getZ(i))
      restNormals.push(normal?.getX(i)??0,normal?.getY(i)??1,normal?.getZ(i)??0)
      positions.push(x+vertices.getZ(i),point.y+tangent.x*vertices.getY(i),point.x-tangent.y*vertices.getY(i))
      normals.push(normal?.getZ(i)??0,-tangent.y*(normal?.getX(i)??0)+tangent.x*(normal?.getY(i)??1),-tangent.x*(normal?.getX(i)??0)-tangent.y*(normal?.getY(i)??1))
      if(uv)uvs.push(uv.getX(i),uv.getY(i))
    }
    for(let i=0;i<indices.count;i++)faces.push(indices.getX(i)+repeat*vertices.count)
  }
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)).setAttribute('normal',new THREE.Float32BufferAttribute(normals,3))
  geometry.setAttribute('trackCoordinate',new THREE.Float32BufferAttribute(coordinates,3))
  geometry.setAttribute('trackRestNormal',new THREE.Float32BufferAttribute(restNormals,3))
  geometry.userData.trackMotion={guides,padding:Math.max(0,height)/2}
  if(uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
  geometry.setIndex(faces);geometry.computeBoundingBox()
  return geometry
}

/** Move actual tread vertices around the same closed outline; no texture-only illusion.
 * Buffers/topology/UVs are retained, and sampling does not allocate per vertex. */
export class TrackMotion {
  private readonly outline
  private readonly sample:number[]=[]
  constructor(private readonly geometry:THREE.BufferGeometry) {
    const data=geometry.userData.trackMotion
    if(!data || !Array.isArray(data.guides) || data.guides.length<2 || data.guides.length>128 ||
      !data.guides.every((g:TrackGuide)=>[g.x,g.y,g.z,g.radius].every(Number.isFinite)&&g.radius>0) ||
      !Number.isFinite(data.padding) || data.padding<0 || data.padding>10)throw new Error('Invalid track motion guides')
    this.outline=trackOutline(data.guides,data.padding)
    const coords=geometry.getAttribute('trackCoordinate'),normals=geometry.getAttribute('trackRestNormal')
    if(!coords || !normals || coords.count!==geometry.getAttribute('position').count || normals.count!==coords.count)throw new Error('Missing track motion coordinates')
  }
  update(distance:number) {
    if(!Number.isFinite(distance))throw new Error('Invalid track motion distance')
    const coords=this.geometry.getAttribute('trackCoordinate'),rest=this.geometry.getAttribute('trackRestNormal')
    const positions=this.geometry.getAttribute('position'),normals=this.geometry.getAttribute('normal')
    for(let i=0;i<coords.count;i++) {
      this.outline.sampleInto(coords.getX(i)+distance,this.sample)
      const [z,y,tz,ty]=this.sample,h=coords.getY(i)
      positions.setXYZ(i,coords.getZ(i),y+tz*h,z-ty*h)
      normals.setXYZ(i,rest.getZ(i),-ty*rest.getX(i)+tz*rest.getY(i),-tz*rest.getX(i)-ty*rest.getY(i))
    }
    positions.needsUpdate=true;normals.needsUpdate=true
  }
}
