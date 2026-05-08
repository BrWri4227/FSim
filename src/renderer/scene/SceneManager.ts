import * as THREE from 'three'
import { Terrain } from './Terrain'
import { Sky } from './Sky'

export class SceneManager {
  readonly scene: THREE.Scene
  readonly renderer: THREE.WebGLRenderer
  readonly camera: THREE.PerspectiveCamera

  private terrain: Terrain
  private sky: Sky

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 200000)

    // Lighting
    const sun = new THREE.DirectionalLight(0xfff8e8, 3.0)
    sun.position.set(50000, 80000, -20000)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 100
    sun.shadow.camera.far = 200000
    sun.shadow.camera.left = -20000
    sun.shadow.camera.right = 20000
    sun.shadow.camera.top = 20000
    sun.shadow.camera.bottom = -20000
    this.scene.add(sun)

    const ambient = new THREE.AmbientLight(0x8090b0, 0.8)
    this.scene.add(ambient)

    const sky_hemi = new THREE.HemisphereLight(0x3ab8f0, 0x4a7c3f, 0.7)
    this.scene.add(sky_hemi)

    this.terrain = new Terrain(this.scene)
    this.sky = new Sky(this.scene)

    // Fog for depth
    this.scene.fog = new THREE.FogExp2(0x90cce8, 0.0000055)

    window.addEventListener('resize', this.onResize)
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  updateSky(camera: THREE.Camera): void {
    this.sky.update(camera.position)
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera)
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
  }
}
