<template>
  <section class="vehicle-drive" :data-model-state="state">
    <div class="drive-tools">
      <strong>{{ t('vehicleView') }}</strong>
      <button v-if="entry.imageUrl && state === 'ready'" class="view-alternative" :aria-pressed="showCover" :title="t(showCover ? 'showModel' : 'showCover')" @click="showCover = !showCover">{{ t(showCover ? 'showModel' : 'showCover') }}</button>
      <button :aria-label="t(moving ? 'pauseMotion' : 'resumeMotion')" :title="t(moving ? 'pauseMotion' : 'resumeMotion')" @click="toggleMotion">{{ moving ? 'Ⅱ' : '▶' }}</button>
      <button class="fit-camera" :title="t('resetCamera')" :aria-label="t('resetCamera')" @click="stage?.resetCamera()">⤢</button>
      <select v-model="terrain" :aria-label="t('terrain')">
        <option v-for="item in ['auto', 'construction', 'asphalt', 'mud', 'forest', 'rock']" :key="item" :value="item">{{ t('terrain_' + item) }}</option>
      </select>
    </div>
    <div ref="host" class="drive-scene" :class="{ 'drive-scene--cover': showCover }">
      <div v-if="state !== 'ready' || showCover" class="drive-cover" :class="{ 'drive-cover--moving': moving }">
        <img v-if="entry.imageUrl && !imageFailed" :src="entry.imageUrl" :alt="entry.name" @error="imageFailed = true">
        <span v-else>{{ entry.name }}<small>{{ t('noVehicleImage') }}</small></span>
      </div>
    </div>
    <p>{{ t(showCover ? 'coverNot3d' : state === 'ready' ? 'originalSourceModel' : state === 'loading' ? 'loadingModel' : 'coverNot3d') }}</p>
    <small class="preview-note" :title="t('viewOnly')">{{ t('viewOnly') }}</small>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { TGALoader } from 'three/addons/loaders/TGALoader.js'
import { DDSLoader } from 'three/addons/loaders/DDSLoader.js'
import type { ContentEntry } from '../../shared'
import { DrivingStage, type Terrain } from '../driving-stage'
import { fbxMetersScale, exteriorMesh, mountSourceWheel, configureRoadShading } from '../source-model'
import { visibleVehicleBounds } from '../vehicle-framing'
const props = defineProps<{ entry: ContentEntry; t: (key: string) => string }>()
const host = ref<HTMLElement>(), state = ref('loading'), terrain = ref<Terrain>('auto')
const moving = ref(!matchMedia('(prefers-reduced-motion: reduce)').matches)
const imageFailed = ref(false)
const showCover = ref(false)
let stage: DrivingStage | undefined, disposed = false
const pendingModels = new Set<THREE.Object3D>(), loadedTextures = new Set<THREE.Texture>()
const EMPTY_TEXTURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X2NDNwAAAABJRU5ErkJggg=='
watch(terrain, value => { if (stage) stage.terrain = value })
watch(showCover, value => { if (stage) stage.moving = moving.value && !value })
onMounted(async () => {
  try {
    stage = new DrivingStage(host.value!, true)
    const asset = await window.roadcraft.getPreview(props.entry.id)
    if (disposed) return
    if (!asset) { state.value = 'cover'; return }
    const manager = new THREE.LoadingManager()
    manager.addHandler(/\.tga$/i, new TGALoader(manager)); manager.addHandler(/\.dds$/i, new DDSLoader(manager))
    manager.setURLModifier(url => {
      if (url.startsWith('blob:') || url.startsWith('data:') || url === asset.modelUrl || url === asset.wheelUrl) return url
      const name = decodeURIComponent(url).replaceAll('\\', '/').split('/').pop()?.toLowerCase() ?? ''
      return asset.textures[name] ?? EMPTY_TEXTURE
    })
    const loader = new FBXLoader(manager), model = asset.format === 'tpl'
      ? await new THREE.ObjectLoader().loadAsync(asset.modelUrl) : await loader.loadAsync(asset.modelUrl)
    pendingModels.add(model)
    const maps = new Map<string, THREE.Texture>(), materials = new Map<string, THREE.Material>()
    async function getTexture(url: string, color: boolean) {
      const key = url + (color ? ':color' : ':linear')
      if (!maps.has(key)) {
        const loader = /\.tga$/i.test(url) ? new TGALoader() : /\.dds$/i.test(url) ? new DDSLoader() : new THREE.TextureLoader()
        const texture = await loader.loadAsync(url)
        texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
        maps.set(key, texture); loadedTextures.add(texture)
        if (disposed) texture.dispose()
      }
      return maps.get(key)!
    }
    async function applyMaterials(root: THREE.Object3D) {
      const meshes: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o) })
      for (const object of meshes) {
        const oldMaterials = Array.isArray(object.material) ? object.material : [object.material]
        if (!exteriorMesh(object.name)) { object.visible = false; continue }
        const replacements: THREE.Material[] = []
        for (const old of oldMaterials) {
          for (const value of Object.values(old)) if (value instanceof THREE.Texture) loadedTextures.add(value)
          if (materials.has(old.name)) { replacements.push(materials.get(old.name)!); old.dispose(); continue }
          const def = asset!.materials[old.name] ?? asset!.materials[old.name.replace(/\.\d+$/, '')]
          const m = new THREE.MeshStandardMaterial({ color: /tire/i.test(old.name) ? 0x272a2c : 0xb4b7ab, roughness: .85 })
          m.name = old.name
          // Keep the subject clear even when a tall crane needs a distant camera.
          m.fog = false
          const hidden = /cutoff|collision|physical/i.test(old.name + ' ' + (def?.type ?? '')) || /decal/i.test(def?.type ?? '') && !def?.albedo
          if (hidden) { m.transparent = true; m.opacity = 0; m.depthWrite = false; m.visible = false }
          if (def?.albedo) { m.map = await getTexture(def.albedo, true); m.color.set(0xffffff) }
          if (def?.normal) { m.normalMap = await getTexture(def.normal, false); m.normalScale.set(1, -1) }
          if (def?.shading) configureRoadShading(m, await getTexture(def.shading, false))
          if (def?.emissive) { m.emissiveMap = await getTexture(def.emissive, true); m.emissive.set(0xffffff); m.emissiveIntensity = .5 }
          if (def?.transparent) { m.transparent = true; m.depthWrite = false; if (asset!.format === 'tpl') { m.opacity = .4; m.color.set(0x9cbdc9) } }
          if (/alphakill/i.test(def?.type ?? '')) m.alphaTest = .4
          if (/decal/i.test(def?.type ?? '')) { m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1 }
          materials.set(old.name, m); replacements.push(m); old.dispose()
        }
        object.material = Array.isArray(object.material) ? replacements : replacements[0]
        object.visible = replacements.some(m => m.visible)
        object.castShadow = true; object.receiveShadow = true
      }
    }
    await applyMaterials(model)
    model.userData.importScale = asset.modelImportScale
    if (disposed) { disposeModel(model); return }
    if (asset.wheelUrl) {
      const wheel = await loader.loadAsync(asset.wheelUrl)
      pendingModels.add(wheel)
      wheel.userData.importScale = asset.wheelImportScale
      await applyMaterials(wheel)
      if (disposed) { disposeModel(model); disposeModel(wheel); return }
      const slots: THREE.Object3D[] = []
      model.traverse(object => { if (/^wheel_\d+_(left|right)$/i.test(object.name)) slots.push(object) })
      const movingWheels: THREE.Object3D[] = []
      for (const slot of slots) movingWheels.push(mountSourceWheel(model, wheel, slot, asset.wheelScale))
      const wheelSize = visibleVehicleBounds(wheel).getSize(new THREE.Vector3())
      const radius = Math.max(wheelSize.y, wheelSize.z) * fbxMetersScale(wheel) * asset.wheelScale / 2
      stage.setDrivenParts(movingWheels, radius)
      host.value!.dataset.wheels = String(movingWheels.length)
      host.value!.dataset.wheelScale = String(asset.wheelScale)
    }
    if (asset.format === 'tpl') {
      const wheels: THREE.Object3D[] = []
      model.traverse(object => { if (object.userData.drivenWheel) wheels.push(object) })
      if (wheels.length) stage.setDrivenParts(wheels, .55)
      host.value!.dataset.wheels = String(wheels.length)
      host.value!.dataset.format = 'tpl'
    } else model.scale.multiplyScalar(fbxMetersScale(model))
    const size = visibleVehicleBounds(model).getSize(new THREE.Vector3())
    if (!size.toArray().every(n => Number.isFinite(n) && n > .1 && n < 100)) throw new Error('Invalid source model dimensions')
    host.value!.dataset.materials = String(materials.size)
    host.value!.dataset.shadingMaps = String([...materials.values()].filter(m => m instanceof THREE.MeshStandardMaterial && !!m.metalnessMap).length)
    stage.setBody(model); state.value = 'ready'
  } catch (error) { if (!disposed) { state.value = 'cover'; console.warn('Vista 3D:', error) } }
})
function toggleMotion() { moving.value = !moving.value; if (stage) stage.moving = moving.value && !showCover.value }
function disposeModel(model: THREE.Object3D) {
  model.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose() } })
}
onBeforeUnmount(() => { disposed = true; stage?.dispose(); pendingModels.forEach(disposeModel); loadedTextures.forEach(t => t.dispose()) })
</script>
<style scoped>
.vehicle-drive { flex: 1 1 0; min-height: 0; min-width: 0; display: flex; flex-direction: column; margin: 0; border-radius: 13px; overflow: hidden; color: #cad8df; background: #13222c; container-type: inline-size; }
.drive-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 9px 11px; font-size: 11px; }
.drive-tools strong { margin-inline-end: auto; }
button, select { font: inherit; min-width: 0; max-width: 145px; padding: 4px 7px; border: 1px solid #536875; border-radius: 6px; color: #e8eff3; background: #213642; }
.drive-scene { flex: 1 1 0; min-height: 90px; position: relative; overflow: hidden; }
.drive-scene :deep(canvas) { display: block; width: 100%; height: 100%; touch-action: none; }
.drive-scene--cover :deep(canvas) { visibility: hidden; }
.drive-cover { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 10px; pointer-events: none; }
.drive-cover img { max-width: 88%; max-height: 85%; object-fit: contain; border-radius: 9px; box-shadow: 0 14px 25px #15242c45; }
.drive-cover--moving img { animation: drive-bob 2s ease-in-out infinite alternate; }
p { margin: 0; padding: 9px 12px 4px; font-size: 11px; }
small { display: block; padding: 0 12px 11px; font-size: 10px; color: #93aab7; }
@container (max-width: 260px) { .drive-tools { gap: 5px; padding: 7px; } .drive-tools select { flex: 1 0 100%; max-width: 100%; } p, small { padding-inline: 8px; font-size: 10px; } p { padding-bottom: 9px; } .preview-note { display: none; } }
@keyframes drive-bob { to { transform: translateY(2px) rotate(.2deg); } }
@media (prefers-reduced-motion: reduce) { .drive-cover img { animation: none; } }
</style>
