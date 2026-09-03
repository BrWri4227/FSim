import * as THREE from 'three'
import { Terrain } from './Terrain'
import { Sky } from './Sky'
import { Scenery } from './Scenery'
import { WeatherVisuals } from './WeatherVisuals'
import { getWeather } from '../physics/WeatherState'
import { getTimeOfDayConfig, type TimeOfDayPreset } from './TimeOfDay'
import { RENDER_QUALITY, type PostFXQuality } from '../postfx/PostFXManager'

export class SceneManager {
  readonly scene: THREE.Scene
  readonly renderer: THREE.WebGLRenderer
  readonly camera: THREE.PerspectiveCamera

  private terrain: Terrain
  private sky: Sky
  private scenery: Scenery
  private weatherVisuals: WeatherVisuals
  private sun: THREE.DirectionalLight
  private ambient: THREE.AmbientLight
  private hemi: THREE.HemisphereLight
  private readonly sunDir = new THREE.Vector3(50000, 80000, -20000).normalize()
  private timeOfDay: TimeOfDayPreset = 'DAY'
  private fogColor = 0x9fd0e6

  constructor(
    canvas: HTMLCanvasElement,
    timeOfDay: TimeOfDayPreset = 'DAY',
    quality: PostFXQuality = 'HIGH',
  ) {
    this.scene = new THREE.Scene()
    const rq = RENDER_QUALITY[quality]

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== 'LOW',
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, rq.maxPixelRatio))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = rq.shadows
    this.renderer.shadowMap.type = rq.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 200000)

    // Sun — tight shadow frustum centred on the player (updated each frame by updateSunFollow)
    const sun = new THREE.DirectionalLight(0xfff8e8, 3.0)
    sun.position.set(50000, 80000, -20000)
    sun.castShadow = rq.shadows
    sun.shadow.mapSize.set(rq.shadowMapSize, rq.shadowMapSize)
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

    this.ambient = new THREE.AmbientLight(0x8090b0, 0.6)
    this.scene.add(this.ambient)

    this.hemi = new THREE.HemisphereLight(0x3ab8f0, 0x4a7c3f, 0.8)
    this.scene.add(this.hemi)

    this.terrain = new Terrain(this.scene)
    this.sky = new Sky(this.scene)
    this.scenery = new Scenery(this.scene)
    this.weatherVisuals = new WeatherVisuals(this.scene)
    this.applyTimeOfDay(timeOfDay)

    window.addEventListener('resize', this.onResize)
  }

  /** Apply a time-of-day lighting preset to the sun, ambient, sky, fog and bloom. */
  applyTimeOfDay(preset: TimeOfDayPreset): void {
    this.timeOfDay = preset
    const cfg = getTimeOfDayConfig(preset)

    this.sunDir.set(cfg.sunDirThree[0], cfg.sunDirThree[1], cfg.sunDirThree[2]).normalize()
    this.sun.color.setHex(cfg.sunColor)
    this.sun.intensity = cfg.sunIntensity
    this.ambient.color.setHex(cfg.ambientColor)
    this.ambient.intensity = cfg.ambientIntensity
    this.hemi.color.setHex(cfg.hemiSky)
    this.hemi.groundColor.setHex(cfg.hemiGround)
    this.hemi.intensity = cfg.hemiIntensity
    this.renderer.toneMappingExposure = cfg.exposure
    this.fogColor = cfg.fogColor

    this.sky.applyTimeOfDay(cfg)
    this.applyWeatherFog()
  }

  /** UnrealBloom strength — driven by the time-of-day preset. */
  getBloomStrength(): number {
    return getTimeOfDayConfig(this.timeOfDay).bloomStrength
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
    this.terrain.update(camera.position)
    this.weatherVisuals.update(camera.position, 1 / 60)
  }

  /** Sync fog density with WeatherState visibility. */
  applyWeatherFog(): void {
    const visM = getWeather().visibilityM
    const density = Math.max(0.000001, 3.5 / Math.max(visM, 500))
    this.scene.fog = new THREE.FogExp2(this.fogColor, density)
  }

  refreshWeatherVisuals(): void {
    this.weatherVisuals.refresh()
    this.sky.refresh()
    this.applyWeatherFog()
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera)
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize)
    this.terrain.dispose()
    this.sky.dispose()
    this.scenery.dispose()
    this.weatherVisuals.dispose()
    this.renderer.dispose()
  }
}
