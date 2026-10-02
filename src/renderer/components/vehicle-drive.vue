<template>
  <section class="vehicle-drive" :data-model-state="state">
    <div class="drive-tools">
      <strong>{{ t('vehicleView') }}</strong>
      <button @click="toggleMotion">{{ moving ? 'Ⅱ' : '▶' }}</button>
      <select v-model="terrain" :aria-label="t('terrain')">
        <option v-for="item in ['auto', 'construction', 'asphalt', 'mud', 'forest', 'rock']" :key="item" :value="item">{{ t('terrain_' + item) }}</option>
      </select>
    </div>
    <div ref="host" class="drive-scene">
      <div v-if="state !== 'ready'" class="drive-cover" :class="{ 'drive-cover--moving': moving }">
        <img v-if="entry.imageUrl" :src="entry.imageUrl" :alt="entry.name">
        <span v-else>{{ entry.name }}</span>
      </div>
    </div>
    <p>{{ t(state === 'ready' ? 'originalSourceModel' : state === 'loading' ? 'loadingModel' : 'coverNot3d') }}</p>
    <small>{{ t('viewOnly') }}</small>
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
const props = defineProps<{ entry: ContentEntry; t: (key: string) => string }>()
const host = ref<HTMLElement>(), state = ref('loading'), terrain = ref<Terrain>('auto')
const moving = ref(!matchMedia('(prefers-reduced-motion: reduce)').matches)
let stage: DrivingStage | undefined, disposed = false
const pendingModels = new Set<THREE.Object3D>(), loadedTextures = new Set<THREE.Texture>()
const EMPTY_TEXTURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X2NDNwAAAABJRU5ErkJggg=='
watch(terrain, value => { if (stage) stage.terrain = value })
onMounted(async () => {
  try {
    stage = new DrivingStage(host.value!, true)
    const asset = await window.roadcraft.getPreview(props.entry.id)
    if (!asset) { state.value = 'cover'; return }
    const manager = new THREE.LoadingManager()
    manager.addHandler(/\.tga$/i, new TGALoader(manager)); manager.addHandler(/\.dds$/i, new DDSLoader(manager))
    manager.setURLModifier(url => {
      if (url.startsWith('blob:') || url.startsWith('data:') || url === asset.modelUrl || url === asset.wheelUrl) return url
      const name = decodeURIComponent(url).replaceAll('\\', '/').split('/').pop()?.toLowerCase() ?? ''
      return asset.textures[name] ?? EMPTY_TEXTURE
    })
    const loader = new FBXLoader(manager), model = await loader.loadAsync(asset.modelUrl)
    pendingModels.add(model)
    const textureLoader = new TGALoader(), maps = new Map<string, THREE.Texture>()
    async function getTexture(url: string, color: boolean) {
      if (!maps.has(url)) { const texture = await textureLoader.loadAsync(url); if (color) texture.colorSpace = THREE.SRGBColorSpace; maps.set(url, texture); loadedTextures.add(texture); if (disposed) texture.dispose() }
      return maps.get(url)!
    }
    async function applyMaterials(root: THREE.Object3D) {
      const meshes: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o) })
      for (const object of meshes) {
        const oldMaterials = Array.isArray(object.material) ? object.material : [object.material]
        if (oldMaterials.every(m => /cutoff|collision|physical/i.test(m.name)) || /^cdt|_cdt(?:$|_)/i.test(object.name)) { object.visible = false; continue }
        const replacements: THREE.Material[] = []
        for (const old of oldMaterials) {
          const def = asset!.materials[old.name] ?? asset!.materials[old.name.replace(/\.\d+$/, '')]
          const m = new THREE.MeshStandardMaterial({ color: /tire/i.test(old.name) ? 0x272a2c : 0xb4b7ab, roughness: .85 })
          m.name = old.name
          if (def?.albedo) { m.map = await getTexture(def.albedo, true); m.color.set(0xffffff) }
          if (def?.normal) { m.normalMap = await getTexture(def.normal, false); m.normalScale.set(.65, .65) }
          if (def?.transparent) { m.transparent = true; m.opacity = .5; m.depthWrite = false }
          replacements.push(m); old.dispose()
        }
        object.material = Array.isArray(object.material) ? replacements : replacements[0]
      }
    }
    await applyMaterials(model)
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      if (/^cdt|_cdt(?:$|_)|collision|_lod[1-9]/i.test(object.name)) object.visible = false
      object.castShadow = true; object.receiveShadow = true
    })
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
    if (size.length() > 50) model.scale.multiplyScalar(.01)
    if (disposed) { disposeModel(model); return }
    if (asset.wheelUrl) {
      const wheel = await loader.loadAsync(asset.wheelUrl)
      pendingModels.add(wheel)
      await applyMaterials(wheel)
      if (disposed) { disposeModel(model); disposeModel(wheel); return }
      const slots: THREE.Object3D[] = []
      model.traverse(object => { if (/^wheel_\d+_(left|right)$/i.test(object.name)) slots.push(object) })
      const movingWheels: THREE.Object3D[] = []
      for (const slot of slots) { const unit = wheel.clone(true); slot.add(unit); movingWheels.push(unit) }
      stage.setDrivenParts(movingWheels)
    }
    stage.setBody(model); state.value = 'ready'
  } catch (error) { if (!disposed) { state.value = 'cover'; console.warn('Vista 3D:', error) } }
})
function toggleMotion() { moving.value = !moving.value; if (stage) stage.moving = moving.value }
function disposeModel(model: THREE.Object3D) {
  model.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose() } })
}
onBeforeUnmount(() => { disposed = true; stage?.dispose(); pendingModels.forEach(disposeModel); loadedTextures.forEach(t => t.dispose()) })
</script>
<style scoped>
.vehicle-drive { flex: 0 0 auto; margin: 0 16px 14px; border-radius: 13px; overflow: hidden; color: #cad8df; background: #13222c; }
.drive-tools { display: flex; align-items: center; gap: 7px; padding: 9px 11px; font-size: 11px; }
.drive-tools strong { margin-inline-end: auto; }
button, select { font: inherit; min-width: 0; max-width: 145px; padding: 4px 7px; border: 1px solid #536875; border-radius: 6px; color: #e8eff3; background: #213642; }
.drive-scene { height: 230px; position: relative; overflow: hidden; }
.drive-scene :deep(canvas) { display: block; width: 100%; height: 100%; touch-action: none; }
.drive-cover { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 10px; pointer-events: none; }
.drive-cover img { max-width: 88%; max-height: 85%; object-fit: contain; border-radius: 9px; box-shadow: 0 14px 25px #15242c45; }
.drive-cover--moving img { animation: drive-bob 2s ease-in-out infinite alternate; }
p { margin: 0; padding: 9px 12px 4px; font-size: 11px; }
small { display: block; padding: 0 12px 11px; font-size: 10px; color: #93aab7; }
@keyframes drive-bob { to { transform: translateY(2px) rotate(.2deg); } }
@media (prefers-reduced-motion: reduce) { .drive-cover img { animation: none; } }
</style>
