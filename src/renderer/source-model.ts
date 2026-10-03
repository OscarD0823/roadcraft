import * as THREE from 'three'

/** Combine the FBX units with the SDK's explicit FBX import scale. */
export function fbxMetersScale(model: THREE.Object3D) {
  const scale = Number(model.userData.unitScaleFactor ?? 1) / 100 * Number(model.userData.importScale ?? 1)
  if (!Number.isFinite(scale) || scale <= 0 || scale > 100) throw new Error('Invalid FBX unit scale')
  return scale
}

export function exteriorMesh(name: string) {
  return !/(?:^|_)cdt(?:$|_)|collision|_lod[1-9]|(?:^|_)hp_|cutoff|physical/i.test(name)
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
