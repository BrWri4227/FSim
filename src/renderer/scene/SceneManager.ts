import * as THREE from 'three'
import { Terrain } from './Terrain'
import { Sky } from './Sky'

export class SceneManager {
  readonly scene: THREE.Scene
  readonly renderer: THREE.WebGLRenderer
  readonly camera: THREE.PerspectiveCamera

  private terrain: Terrain
  private sky: Sky
  private sun: THREE.DirectionalLight
  private readonly sunDir = new THREE.Vector3(50000, 80000, -20000).normalize()

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
    this.renderer.toneMappingExposure = 1.1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 200000)

    // Sun — tight shadow frustum centred on the player (updated each frame by updateSunFollow)
    const sun = new THREE.DirectionalLight(0xfff8e8, 3.0)
    sun.position.set(50000, 80000, -20000)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near   = 1
    sun.shadow.camera.far    = 50000
    sun.shadow.camera.left   = -4000
    sun.shadow.camera.right  =  4000
    sun.shadow.camera.top    =  4000
    sun.shadow.camera.bottom = -4000
    sun.shadow.bias = -0.0005
    this.scene.add(sun)
    this.scene.add(sun.target)  // target must be in scene for follow to work
    this.sun = sun

    const ambient = new THREE.AmbientLight(0x8090b0, 0.6)
    this.scene.add(ambient)

    const sky_hemi = new THREE.HemisphereLight(0x3ab8f0, 0x4a7c3f, 0.8)
    this.scene.add(sky_hemi)

    this.terrain = new Terrain(this.scene)
    this.sky = new Sky(this.scene)

    // Fog for depth
    this.scene.fog = new THREE.FogExp2(0x90cce8, 0.0000055)

    window.addEventListener('resize', this.onResize)
  }

  /**
   * Move the directional light's shadow camera to track the player each frame,
   * keeping high-quality shadows in the local combat area.
   */
  updateSunFollow(playerPos: THREE.Vector3): void {
    const SHADOW_DIST = 30000
    this.sun.position.copy(playerPos).addScaledVector(this.sunDir, SHADOW_DIST)
    this.sun.target.position.copy(playerPos)
    this.sun.target.updateMatrixWorld()
    this.sun.shadow.camera.updateProjectionMatrix()
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
    this.terrain.dispose()
    this.sky.dispose()
    this.renderer.dispose()
  }
}
