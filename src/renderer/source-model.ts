import * as THREE from 'three'

/** Combine the FBX units with the SDK's explicit FBX import scale. */
export function fbxMetersScale(model: THREE.Object3D) {
  const scale = Number(model.userData.unitScaleFactor ?? 1) / 100 * Number(model.userData.importScale ?? 1)
  if (!Number.isFinite(scale) || scale <= 0 || scale > 100) throw new Error('Invalid FBX unit scale')
  return scale
}

export function exteriorMesh(name: string) {
  return !/(?:^|_)cdt(?:$|_)|collision|_lod[1-9]|(?:^|_)hp_|cutoff|physical|^_load_(?:volume|border)|^_sfx_/i.test(name)
}

/** Spin about the model's axle, retaining its steering/mounting direction.
 * Mirrored left wheels need the opposite local sign to travel forward too. */
export function wheelRollingAxis(object:THREE.Object3D) {
  const axis=new THREE.Vector3(1,0,0)
  const world=axis.clone().applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()))
  return axis.multiplyScalar(world.x<0?-1:1)
}

/** Cancel the loader's root-axis conversion when nesting a wheel in a source bone. */
export function mountSourceWheel(body: THREE.Object3D, wheel: THREE.Object3D, slot: THREE.Object3D, wheelScale = 1) {
  const unit = wheel.clone(true)
  unit.quaternion.premultiply(body.quaternion.clone().invert())
  unit.scale.multiplyScalar(wheelScale * fbxMetersScale(wheel) / fbxMetersScale(body))
  // Official wheel sources face -X; the left slots lie on +X in the body frame.
  if (/left$/i.test(slot.name)) unit.rotateY(Math.PI)
  unit.userData.rollSign = /left$/i.test(slot.name) ? -1 : 1
  slot.add(unit)
  return unit
}

/** RoadCraft's spec map is R=metal, G=roughness, B=occlusion (not Three's order). */
export function configureRoadShading(material: THREE.MeshStandardMaterial, texture: THREE.Texture) {
  material.metalness = 1; material.roughness = 1
  material.metalnessMap = texture; material.roughnessMap = texture; material.aoMap = texture
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <metalnessmap_fragment>', THREE.ShaderChunk.metalnessmap_fragment.replace('texelMetalness.b', 'texelMetalness.r'))
      .replace('#include <aomap_fragment>', THREE.ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv ).r', 'texture2D( aoMap, vAoMapUv ).b'))
  }
  material.customProgramCacheKey = () => 'roadcraft-r-g-b-pbr-v1'
}

/** Preserve unpainted areas; native material tinting uses a mask, not an overall color wash. */
export function configureRoadPaint(material: THREE.MeshStandardMaterial, options: {mask?:THREE.Texture; tint:number[]; tintG?:number[]; albedoAlpha?:boolean}) {
  const prior = material.onBeforeCompile.bind(material), priorKey = material.customProgramCacheKey()
  const color=(rgb:number[])=>new THREE.Color().setRGB(rgb[0]/255,rgb[1]/255,rgb[2]/255,THREE.SRGBColorSpace)
  material.onBeforeCompile=(shader,renderer)=>{
    prior(shader,renderer)
    shader.uniforms.roadPaintTint={value:color(options.tint)}
    shader.uniforms.roadPaintTintG={value:color(options.tintG??[255,255,255])}
    if(options.mask)shader.uniforms.roadPaintMask={value:options.mask}
    shader.fragmentShader='uniform vec3 roadPaintTint;\nuniform vec3 roadPaintTintG;\n'+(options.mask?'uniform sampler2D roadPaintMask;\n':'')+shader.fragmentShader
    const weight=options.mask?'texture2D(roadPaintMask,vMapUv).rgb':'vec3('+ (options.albedoAlpha?'sampledDiffuseColor.a':'0.0') +',0.0,0.0)'
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment+`\n#ifdef USE_MAP\nvec3 roadPaintWeights=${weight};\ndiffuseColor.rgb=mix(diffuseColor.rgb,roadPaintTint,roadPaintWeights.r);\ndiffuseColor.rgb=mix(diffuseColor.rgb,roadPaintTintG,roadPaintWeights.g);\n#endif\n`)
  }
  material.customProgramCacheKey=()=>priorKey+':road-paint-v1:'+!!options.mask+':'+!!options.albedoAlpha
}
