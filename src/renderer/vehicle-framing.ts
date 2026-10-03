import * as THREE from 'three'

/** Bounds of displayed geometry, including the rest pose of skinned FBX meshes. */
export function visibleVehicleBounds(object: THREE.Object3D) {
  object.updateWorldMatrix(true, true)
  const box = new THREE.Box3()
  object.traverseVisible(child => {
    if (!(child instanceof THREE.Mesh)) return
    if (child instanceof THREE.SkinnedMesh) {
      child.skeleton.update(); child.computeBoundingBox()
      if (child.boundingBox) box.union(child.boundingBox.clone().applyMatrix4(child.matrixWorld))
    } else {
      child.geometry.computeBoundingBox()
      if (child.geometry.boundingBox) box.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld))
    }
  })
  return box
}

export function fitVehicleCamera(camera: THREE.PerspectiveCamera, box: THREE.Box3, direction = new THREE.Vector3(.75, .35, 1.4)) {
  if (box.isEmpty()) return new THREE.Vector3()
  const center = box.getCenter(new THREE.Vector3()), forward = direction.clone().normalize()
  const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize()
  const up = new THREE.Vector3().crossVectors(forward, right)
  const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanX = tanY * camera.aspect
  let distance = 1
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).sub(center)
    distance = Math.max(distance, p.dot(forward) + Math.max(Math.abs(p.dot(right)) / tanX, Math.abs(p.dot(up)) / tanY) * 1.18)
  }
  camera.position.copy(center).addScaledVector(forward, distance)
  camera.near = Math.max(.02, distance / 1000); camera.far = Math.max(250, distance * 5)
  camera.lookAt(center); camera.updateProjectionMatrix(); camera.updateMatrixWorld()
  return center
}

export function vehicleScreenRegion(camera: THREE.PerspectiveCamera, box: THREE.Box3) {
  const region = { min: new THREE.Vector2(Infinity, Infinity), max: new THREE.Vector2(-Infinity, -Infinity), depth: 0 }
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z)
    region.depth = Math.max(region.depth, -point.clone().applyMatrix4(camera.matrixWorldInverse).z)
    point.project(camera); region.min.min(new THREE.Vector2(point.x, point.y)); region.max.max(new THREE.Vector2(point.x, point.y))
  }
  region.min.addScalar(-.06); region.max.addScalar(.06)
  return region
}

export function sceneryOccludesVehicle(camera: THREE.PerspectiveCamera, region: ReturnType<typeof vehicleScreenRegion>, sphere: THREE.Sphere) {
  const center = sphere.center.clone().applyMatrix4(camera.matrixWorldInverse), depth = -center.z
  if (depth - sphere.radius >= region.depth) return false
  if (depth <= sphere.radius) return true
  const projected = sphere.center.clone().project(camera)
  const radiusY = sphere.radius / ((depth - sphere.radius) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
  const radiusX = radiusY / camera.aspect
  return projected.x + radiusX > region.min.x && projected.x - radiusX < region.max.x
    && projected.y + radiusY > region.min.y && projected.y - radiusY < region.max.y
}
