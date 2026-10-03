import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { fitVehicleCamera, visibleVehicleBounds, vehicleScreenRegion, sceneryOccludesVehicle } from './vehicle-framing'

export type Terrain = 'auto' | 'forest' | 'mud' | 'snow' | 'rock' | 'construction' | 'asphalt'
const palettes = {
  forest: [0x98b0b1, 0x56664b, 0x304839], mud: [0x859995, 0x554032, 0x354439],
  snow: [0xaec9d5, 0xdbe4e4, 0x56747c], rock: [0x9fa9a7, 0x747571, 0x48534a],
  construction: [0xb4b7af, 0x9b8260, 0x655e49], asphalt: [0xa8bfc3, 0x474a49, 0x516447]
} as const

/** Visual driving scene, not a simulation of the game's physics or performance. */
export class DrivingStage {
  readonly scene = new THREE.Scene()
  readonly renderer: THREE.WebGLRenderer
  readonly camera = new THREE.PerspectiveCamera(36, 1, .05, 250)
  readonly controls: OrbitControls
  readonly vehicle = new THREE.Group()
  readonly body = new THREE.Group()
  readonly wheels = new THREE.Group()
  terrain: Terrain = 'auto'
  moving = !matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly observer: ResizeObserver
  private readonly landscape = new THREE.Group()
  private readonly groundMaterial = new THREE.MeshStandardMaterial({ roughness: .96 })
  private readonly foliage = new THREE.MeshStandardMaterial({ roughness: 1 })
  private readonly roadMarks = new THREE.Group()
  private frame = 0
  private last = 0
  private time = 0
  private disposed = false
  private inView = true
  private readonly visibility: IntersectionObserver
  private radius = .6
  private readonly scenery: Array<{ object: THREE.Object3D; sphere: THREE.Sphere }> = []
  private readonly environment: THREE.WebGLRenderTarget
  private readonly vehicleBounds = new THREE.Box3()
  private driven: Array<{ object: THREE.Object3D; rotation: THREE.Quaternion }> = []
  setDrivenParts(parts: THREE.Object3D[], radius = .6) {
    this.radius = Math.max(.15, radius)
    this.driven = parts.map(object => ({ object, rotation: object.quaternion.clone() }))
  }

  constructor(private readonly host: HTMLElement, private readonly roadcraft = false) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = .95
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    host.append(this.renderer.domElement)
    const pmrem = new THREE.PMREMGenerator(this.renderer), room = new RoomEnvironment()
    this.environment = pmrem.fromScene(room, .04)
    this.scene.environment = this.environment.texture
    room.dispose(); pmrem.dispose()
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true; this.controls.enablePan = false
    this.controls.minDistance = 3; this.controls.maxDistance = 35; this.controls.maxPolarAngle = Math.PI * .48
    this.camera.position.set(8, 4, 11); this.controls.target.set(0, 1.5, 0); this.controls.update()
    this.scene.add(this.vehicle, new THREE.HemisphereLight(0xe6efff, 0x685747, 1.1))
    this.vehicle.add(this.body, this.wheels)
    const sunlight = new THREE.DirectionalLight(0xffead3, 2.2)
    sunlight.position.set(10, 16, 8); sunlight.castShadow = true
    sunlight.shadow.mapSize.set(1024, 1024)
    Object.assign(sunlight.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, far: 70 })
    sunlight.shadow.bias = -.0004
    this.scene.add(sunlight)
    const fill = new THREE.DirectionalLight(0xcbdde5, .65); fill.position.set(-8, 4, -9); this.scene.add(fill)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), this.groundMaterial)
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground, this.landscape, this.roadMarks)
    // Fixed seed keeps screenshots and transitions reproducible.
    for (let i = 0; i < 48; i++) {
      const x = i * 1.713 % 80 - 40, side = i % 2 ? -1 : 1, z = side * (6 + i * 2.13 % 16)
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(.15 + i * .17 % .5, 0), new THREE.MeshStandardMaterial({ color: 0x787a71, roughness: 1 }))
      rock.position.set(x, .14, z * .75); rock.rotation.set(i, i * .3, i * .7); rock.castShadow = true; this.landscape.add(rock)
      const tree = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.08, .14, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x685c4e }))
      trunk.position.y = 1.2; tree.add(trunk)
      const branches = new THREE.Mesh(new THREE.ConeGeometry(1.05, 3.8, 7), this.foliage)
      branches.position.y = 3.2; branches.castShadow = true; tree.add(branches)
      tree.position.set(x + 2, 0, z); tree.scale.setScalar(.65 + i * .11 % .7); this.landscape.add(tree)
      if (i < 20) {
        const track = new THREE.Mesh(new THREE.BoxGeometry(.85, .014, .06), new THREE.MeshStandardMaterial({ color: 0xa89a7d, roughness: 1 }))
        track.position.set(i * 3 - 30, .008, i % 2 ? -1 : 1); this.roadMarks.add(track)
      }
    }
    for (let i = 0; i < 12; i++) {
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(7 + i % 4, 9 + i % 3 * 2, 5), new THREE.MeshStandardMaterial({ color: 0x677b7b, roughness: 1 }))
      mountain.position.set(i * 13 - 65, 3.4, (i % 2 ? -1 : 1) * 42)
      this.scene.add(mountain)
      this.cacheScenery(mountain)
    }
    for (const object of this.landscape.children) this.cacheScenery(object)
    this.scene.fog = new THREE.Fog(0xaec9d5, 25, 85)
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host)
    this.visibility = new IntersectionObserver(entries => { this.inView = entries[0].isIntersecting }, { threshold: .01 }); this.visibility.observe(host)
    this.resize(); this.animate(0)
  }
  private resize() {
    const { width, height } = this.host.getBoundingClientRect()
    if (!width || !height) return
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix()
    if (this.body.children.length) this.fitCamera(this.camera.position.clone().sub(this.controls.target))
  }
  setBody(model: THREE.Object3D) {
    this.body.clear(); this.body.add(model)
    this.body.position.y = 0
    const box = visibleVehicleBounds(this.body)
    this.body.position.y = -box.min.y + .03
    this.fitCamera()
  }
  private fitCamera(direction?: THREE.Vector3) {
    const box = visibleVehicleBounds(this.vehicle)
    if (box.isEmpty()) return
    this.vehicleBounds.copy(box).applyMatrix4(this.vehicle.matrixWorld.clone().invert())
    this.controls.target.copy(fitVehicleCamera(this.camera, box, direction))
    const distance = this.camera.position.distanceTo(this.controls.target)
    this.controls.minDistance = Math.max(1, box.getSize(new THREE.Vector3()).length() * .2)
    this.controls.maxDistance = Math.max(35, distance * 2.5)
    this.controls.update()
    this.host.dataset.bounds = JSON.stringify(box.getSize(new THREE.Vector3()).toArray())
    this.host.dataset.framed = String(this.isFramed(box))
  }
  private isFramed(box: THREE.Box3) {
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(this.camera)
      if (Math.abs(p.x) >= 1 || Math.abs(p.y) >= 1 || Math.abs(p.z) >= 1) return false
    }
    return true
  }
  private cacheScenery(object: THREE.Object3D) {
    object.updateWorldMatrix(true, true)
    const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere())
    sphere.center.applyMatrix4(object.matrixWorld.clone().invert())
    sphere.radius /= object.getWorldScale(new THREE.Vector3()).x
    this.scenery.push({ object, sphere })
  }
  resetCamera() { if (this.body.children.length) this.fitCamera() }
  private animate = (now: number) => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.animate)
    const dt = Math.min((now - this.last) / 1000, .05); this.last = now
    if (document.hidden || !this.inView) return
    if (this.moving) this.time += dt
    const sequence: Array<keyof typeof palettes> = this.roadcraft ? ['construction', 'asphalt', 'mud', 'forest', 'rock'] : ['forest', 'mud', 'rock', 'snow']
    const index = Math.floor(this.time / 24) % sequence.length
    const transition = Math.min((this.time % 24) / 5, 1)
    const current = palettes[this.terrain === 'auto' ? sequence[index] : this.terrain]
    const prior = palettes[this.terrain === 'auto' ? sequence[(index + sequence.length - 1) % sequence.length] : this.terrain]
    const sky = new THREE.Color(prior[0]).lerp(new THREE.Color(current[0]), transition)
    this.scene.background = sky; (this.scene.fog as THREE.Fog).color.copy(sky)
    this.groundMaterial.color.set(prior[1]).lerp(new THREE.Color(current[1]), transition)
    this.foliage.color.set(prior[2]).lerp(new THREE.Color(current[2]), transition)
    const move = this.time * 2.5
    this.landscape.position.x = -(move % 16)
    this.roadMarks.position.x = -(move % 3)
    this.vehicle.position.y = this.moving ? .02 * Math.sin(this.time * 5) : 0
    this.vehicle.rotation.z = this.moving ? .004 * Math.sin(this.time * 3) : 0
    for (const part of this.driven) part.object.quaternion.copy(part.rotation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -move / this.radius * Number(part.object.userData.rollSign ?? 1)))
    this.controls.update()
    if (this.body.children.length) {
      this.scene.updateMatrixWorld(true)
      const bounds = this.vehicleBounds.clone().applyMatrix4(this.vehicle.matrixWorld), region = vehicleScreenRegion(this.camera, bounds)
      for (const { object, sphere } of this.scenery) object.visible = !sceneryOccludesVehicle(this.camera, region, sphere.clone().applyMatrix4(object.matrixWorld))
    }
    this.renderer.render(this.scene, this.camera)
    this.host.dataset.terrain = this.terrain === 'auto' ? sequence[index] : this.terrain
    this.host.dataset.frame = String(Math.floor(this.time * 10))
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame)
    this.observer.disconnect(); this.visibility.disconnect(); this.controls.dispose()
    const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>()
    this.scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return
      geometries.add(o.geometry)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value) }
    })
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose())
    this.environment.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove()
  }
}
