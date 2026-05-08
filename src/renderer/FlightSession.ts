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
import { MultiplayerClient } from './network/MultiplayerClient'
import type { MultiplayerConfig } from './network/MultiplayerTypes'
import type { AircraftSpec } from './types/aircraft'
import type { LoadedStore } from './types/weapons'
import { applyHit } from './systems/DamageModel'
import { getAircraftById } from './data/aircraft/catalog'
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
  private multiplayerConfig: MultiplayerConfig
  private multiplayer: MultiplayerClient | null = null
  private localNetworkId: string | null = null
  private trackedRemoteIds = new Set<string>()

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
    multiplayer: MultiplayerConfig,
    onComplete: (result: FlightResult) => void
  ) {
    this.onComplete = onComplete
    this.multiplayerConfig = multiplayer

    const threeCanvas = document.getElementById('three-canvas') as HTMLCanvasElement
    const hudCanvas = document.getElementById('hud-canvas') as HTMLCanvasElement

    this.sceneManager = new SceneManager(threeCanvas)
    this.cameraManager = new CameraManager(this.sceneManager.camera)
    this.inputManager = new InputManager()
    this.audioManager = new AudioManager()
    // Attempt to load real sound files from public/sounds/. Falls back to synthesis silently.
    void this.audioManager.loadSounds('sounds/')

    this.player = new PlayerAircraft(spec, stores, this.sceneManager.scene)
    this.entityManager = new EntityManager(this.sceneManager.scene, this.player)
    this.player.setOnTargetHit((targetId, zone, severity, weapon) => {
      if (!this.multiplayer || !this.localNetworkId) return
      if (!targetId.startsWith('peer_')) return
      this.multiplayer.sendHit({
        sourceId: this.localNetworkId,
        targetId,
        zone,
        severity,
        weapon,
      })
    })

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
    void this.startInternal()
  }

  private async startInternal(): Promise<void> {
    await this.initMultiplayer()
    this.sessionStartTime = performance.now()
    this.lastTime = this.sessionStartTime
    this.loop(this.sessionStartTime)
  }

  private async initMultiplayer(): Promise<void> {
    if (this.multiplayerConfig.mode === 'single') return
    try {
      if (this.multiplayerConfig.mode === 'host') {
        await window.fsim.multiplayer.startHost(this.multiplayerConfig.port)
      }
      const connectHost = this.multiplayerConfig.mode === 'host' ? '127.0.0.1' : this.multiplayerConfig.host
      this.multiplayer = new MultiplayerClient({ aircraftId: this.player.spec.id })
      await this.multiplayer.connect({
        mode: this.multiplayerConfig.mode,
        host: connectHost,
        port: this.multiplayerConfig.port,
      })
      this.localNetworkId = this.multiplayer.getLocalPlayerId()
    } catch (err) {
      console.warn('LAN multiplayer unavailable, continuing single-player:', err)
      this.multiplayer = null
      this.localNetworkId = null
    }
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
    this.syncMultiplayer()
    this.player.update(dt, controls, this.entityManager.getEnemies())
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

  private syncMultiplayer(): void {
    if (!this.multiplayer || !this.multiplayer.isConnected()) return

    this.localNetworkId = this.multiplayer.getLocalPlayerId() ?? this.localNetworkId
    this.multiplayer.sendState({
      positionNED: [...this.player.state.positionNED] as [number, number, number],
      velocityNED: [...this.player.state.velocityNED] as [number, number, number],
      attitudeQuat: [...this.player.state.attitudeQuat] as [number, number, number, number],
      throttle: this.player.state.throttle,
      ejected: this.player.state.ejected,
      structuralFailure: this.player.damage.structuralFailure,
    })

    const snapshots = this.multiplayer.getRemoteSnapshots()
    const seen = new Set<string>()
    for (const snap of snapshots) {
      seen.add(snap.playerId)
      if (!snap.state) continue
      const remoteSpec = getAircraftById(snap.profile.aircraftId)
      if (!remoteSpec) continue
      this.entityManager.upsertRemotePlayer(snap.playerId, remoteSpec, snap.state)
    }

    for (const trackedId of this.trackedRemoteIds) {
      if (!seen.has(trackedId)) this.entityManager.removeRemotePlayer(trackedId)
    }
    this.trackedRemoteIds = seen

    if (!this.localNetworkId) return
    for (const hit of this.multiplayer.consumeInboundHits()) {
      if (hit.targetId !== this.localNetworkId) continue
      applyHit(this.player.damage, hit.zone, hit.severity, this.player.state.invincible)
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
    this.multiplayer?.disconnect()
    if (this.multiplayerConfig.mode === 'host') void window.fsim.multiplayer.stopHost()
  }
}
