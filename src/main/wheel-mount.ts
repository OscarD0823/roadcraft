import * as THREE from 'three'
import type { TplNode } from './tpl-model'

/** Markers supply hub positions, not the separate wheel asset's export axes.
 * The straight-ahead preview uses the vehicle's transverse X axle; neither
 * marker nor collision-body DCC rotations/scales represent steering angles.
 * Zikz/Vostok markers are rotated 90°, while some Crayfish body bones are too. */
export function nativeWheelMount(frame: TplNode, offset = [0, 0, 0]) {
  const mount = new THREE.Group(), marker = new THREE.Matrix4().fromArray(frame.bindTransform!)
  mount.position.setFromMatrixPosition(marker)
  mount.position.add(new THREE.Vector3().fromArray(offset))
  return mount
}
