import * as THREE from 'three'
import { SceneManager } from './scene/SceneManager'
import { CameraManager } from './camera/CameraManager'
import { PlayerAircraft } from './entities/PlayerAircraft'
import { EntityManager } from './entities/EntityManager'
import { InputManager } from './input/InputManager'
import { HUD } from './ui/HUD'
import { DebugOverlay } from './debug/DebugOverlay'
import { DebugVisuals } from './debug/DebugVisuals'
import { AudioManager } from './audio/AudioManager'
import { PostFXManager } from './postfx/PostFXManager'
import type { AircraftSpec } from './types/aircraft'
import type { LoadedStore } from './types/weapons'
import type { FlightResult } from './App'

const FIXED_DT = 1 / 60

export class FlightSession {
  private sceneManager: SceneManager
  private cameraManager: CameraManager
  private inputManager: InputManager
  private player: PlayerAircraft
  private entityManager: EntityManager
  private hud: HUD
  private debugOverlay: DebugOverlay
  private debugVisuals: DebugVisuals
  private audioManager: AudioManager
  private postFX: PostFXManager

  private rafId = 0
  private lastTime = 0
  private accumulator = 0
  private sessionStartTime = 0
  private disposed = false
  private gSmoothed = 1.0   // low-pass filtered G for visual effects

  private onComplete: (result: FlightResult) => void

  constructor(
    spec: AircraftSpec,
    stores: LoadedStore[],
    onComplete: (result: FlightResult) => void
  ) {
    this.onComplete = onComplete

    const threeCanvas = document.getElementById('three-canvas') as HTMLCanvasElement
    const hudCanvas = document.getElementById('hud-canvas') as HTMLCanvasElement

    this.sceneManager = new SceneManager(threeCanvas)
    this.cameraManager = new CameraManager(this.sceneManager.camera)
    this.inputManager = new InputManager()
    this.audioManager = new AudioManager()

    this.player = new PlayerAircraft(spec, stores, this.sceneManager.scene)
    this.entityManager = new EntityManager(this.sceneManager.scene, this.player)

    this.postFX = new PostFXManager(this.sceneManager.renderer, this.sceneManager.scene, this.sceneManager.camera)

    this.hud = new HUD(hudCanvas, this.player, this.entityManager)
    this.debugOverlay = new DebugOverlay(this.player, this.entityManager, this.sceneManager.scene)
    this.debugVisuals = new DebugVisuals(this.sceneManager.scene)

    // Size the HUD canvas to fill the window (it defaults to 300×150)
    this.hud.resize(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', this.onResize)

    // F12 toggles debug overlay
    window.addEventListener('keydown', this.onKeyDown)

    // Position spawn at 5000m altitude, flying north
    this.player.state.positionNED = [0, 0, -5000]
    this.player.state.velocityNED = [250, 0, 0] // ~250 m/s north
  }

  private onResize = (): void => {
    this.hud.resize(window.innerWidth, window.innerHeight)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'F12') {
      e.preventDefault()
      this.debugOverlay.toggle()
    }
  }

  start(): void {
    this.sessionStartTime = performance.now()
    this.lastTime = this.sessionStartTime
    this.loop(this.sessionStartTime)
  }

  private loop = (timestamp: number): void => {
    if (this.disposed) return
    this.rafId = requestAnimationFrame(this.loop)

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1)
    this.lastTime = timestamp
    this.accumulator += dt

    while (this.accumulator >= FIXED_DT) {
      this.tick(FIXED_DT)
      this.accumulator -= FIXED_DT
    }

    this.render()
  }

  private tick(dt: number): void {
    const controls = this.inputManager.getControls()
    this.player.update(dt, controls)
    this.entityManager.update(dt, this.player)
    this.audioManager.update(this.player, controls)

    // Smooth G with ~0.4 s time-constant so vignette builds gradually
    const tau = 0.4
    this.gSmoothed += (this.player.state.gCurrent - this.gSmoothed) * Math.min(1, dt / tau)

    if (this.player.state.ejected) {
      const elapsed = (performance.now() - this.sessionStartTime) / 1000
      setTimeout(() => {
        this.onComplete({
          kills: this.entityManager.killCount,
          deaths: 1,
          flightTimeSec: elapsed,
          aircraftName: this.player.spec.displayName
        })
      }, 4000)
    }
  }

  private render(): void {
    const playerState = this.player.state
    this.cameraManager.update(this.player)

    // Sync mesh transforms
    this.player.updateMesh()
    this.entityManager.updateMeshes()

    // Keep sky centred on camera before rendering
    this.sceneManager.updateSky(this.sceneManager.camera)

    // G-effect post processing (use smoothed value so vignette ramps gradually)
    this.postFX.setGLoad(this.gSmoothed)
    this.postFX.render()

    // Canvas HUD
    this.hud.render(this.sceneManager.camera)

    // Debug overlay telemetry (cheap — only updates text when visible)
    this.debugOverlay.update(playerState)

    // 3-D debug visuals (velocity vector, radar cone, seeker cones)
    this.debugVisuals.update(
      playerState,
      this.player.radar.state,
      this.player.missiles.getMissiles()
    )
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('resize',  this.onResize)
    this.inputManager.dispose()
    this.hud.dispose()
    this.debugOverlay.dispose()
    this.debugVisuals.dispose()
    this.sceneManager.dispose()
    this.audioManager.dispose()
  }
}
