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
import { AWACS } from './avionics/AWACS'
import { MultiplayerClient } from './network/MultiplayerClient'
import type { MultiplayerConfig } from './network/MultiplayerTypes'
import type { AircraftSpec } from './types/aircraft'
import type { LoadedStore } from './types/weapons'
import { applyHit } from './systems/DamageModel'
import { getAircraftById } from './data/aircraft/catalog'
import type { FlightResult, MissionOutcome, ScenarioDescriptor } from './types/mission'
import { MissionTracker } from './mission/MissionTracker'
import { applyPlayerSpawn, spawnScenario } from './mission/ScenarioSpawner'
import { FlareEffect } from './scene/FlareEffect'
import { ChaffEffect } from './scene/ChaffEffect'
import { setLODCamera } from './entities/Aircraft'
import { warmupMissileVisuals } from './weapons/MissileSystem'
import { warmupExplosionVisuals } from './scene/ExplosionEffect'
import { CockpitController } from './cockpit/CockpitController'

const FIXED_DT = 1 / 60

/** LAN session client + connection settings for restoring the lobby after debrief. */
export interface LobbyRestoreBundle {
  client: MultiplayerClient
  config: MultiplayerConfig
}

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
  private awacs: AWACS = new AWACS()
  private multiplayerConfig: MultiplayerConfig
  private multiplayer: MultiplayerClient | null = null
  private localNetworkId: string | null = null
  private trackedRemoteIds    = new Set<string>()
  private _remoteIdSwap       = new Set<string>()  // swap buffer — avoids per-tick Set allocation

  private flareEffect: FlareEffect
  private chaffEffect: ChaffEffect
  private cockpit: CockpitController

  private rafId = 0
  private lastTime = 0
  private accumulator = 0
  private sessionStartTime = 0
  private disposed = false
  private completionScheduled = false
  private completionTimer: ReturnType<typeof setTimeout> | null = null
  private gSmoothed = 1.0   // low-pass filtered G for visual effects
  private frameDt = FIXED_DT
  private glocEnabled: boolean
  private autoRudder: boolean
  private wasRadarShootCueActive = false
  private scenario: ScenarioDescriptor
  private missionTracker: MissionTracker | null = null
  private missionAbortRequested = false

  private onComplete: (result: FlightResult) => void

  constructor(
    spec: AircraftSpec,
    stores: LoadedStore[],
    scenario: ScenarioDescriptor,
    multiplayer: MultiplayerConfig,
    existingMultiplayerClient: MultiplayerClient | null,
    onComplete: (result: FlightResult) => void,
    glocEnabled = true,
    autoRudder = true
  ) {
    this.onComplete = onComplete
    this.scenario = scenario
    this.glocEnabled = glocEnabled
    this.autoRudder = autoRudder
    this.multiplayerConfig = multiplayer
    this.multiplayer = existingMultiplayerClient

    const threeCanvas = document.getElementById('three-canvas') as HTMLCanvasElement
    const hudCanvas = document.getElementById('hud-canvas') as HTMLCanvasElement

    this.sceneManager = new SceneManager(threeCanvas)
    this.cameraManager = new CameraManager(this.sceneManager.camera)
    this.inputManager = new InputManager()
    this.audioManager = new AudioManager()
    // Attempt to load real sound files from public/sounds/. Falls back to synthesis silently.
    void this.audioManager.loadSounds('sounds/')

    this.player = new PlayerAircraft(spec, stores, this.sceneManager.scene, this.autoRudder)
    const [bodyMat, finMat] = this.player.missiles.getWarmupMaterials()
    warmupMissileVisuals(
      this.sceneManager.renderer,
      this.sceneManager.scene,
      this.sceneManager.camera,
      bodyMat,
      finMat,
    )
    warmupExplosionVisuals(
      this.sceneManager.renderer,
      this.sceneManager.scene,
      this.sceneManager.camera,
    )
    this.player.setOnMissileLaunch(category => {
      this.audioManager.play(category === 'IR_MISSILE' ? 'MISSILE_LAUNCH_IR' : 'MISSILE_LAUNCH_ARH')
    })
    this.player.setOnMissileRadarStateChange((_missileId, mode) => {
      if (mode === 'ACTIVE') this.audioManager.play('PITBULL')
    })
    this.player.setOnGPWSEvent(event => {
      this.audioManager.play(event)
    })
    this.entityManager = new EntityManager(this.sceneManager.scene, this.player)
    this.player.missiles.setOnDecoySuccess(type => {
      this.hud.notifyDecoySuccess(type)
    })
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
    this.postFX.setSize(window.innerWidth, window.innerHeight)
    setLODCamera(this.sceneManager.camera)

    this.flareEffect = new FlareEffect(this.sceneManager.scene)
    this.chaffEffect = new ChaffEffect(this.sceneManager.scene)

    this.cockpit = new CockpitController(this.sceneManager.scene, spec)

    this.hud = new HUD(hudCanvas, this.player, this.entityManager)
    this.debugOverlay = new DebugOverlay(this.player, this.entityManager, this.sceneManager.scene)
    this.debugVisuals = new DebugVisuals(this.sceneManager.scene)

    // AWACS BRA callouts — synthesize "Bandit, BRA <bearing> for <range>, angels <alt>"
    this.awacs.onBRACallout = (c) => {
      const bearing = c.bearingDeg.toString().padStart(3, '0')
      this.audioManager.speakUtterance(`Bandit, BRA ${bearing} for ${c.rangeNm}, angels ${c.angelsKft}`)
    }

    // Size the HUD canvas to fill the window (it defaults to 300×150)
    this.hud.resize(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', this.onResize)

    // F12 toggles debug overlay
    window.addEventListener('keydown', this.onKeyDown)

    // Position spawn from scenario (peer offset applied in startInternal)
    applyPlayerSpawn(this.player, scenario)
  }

  private onResize = (): void => {
    this.hud.resize(window.innerWidth, window.innerHeight)
    this.postFX.setSize(window.innerWidth, window.innerHeight)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'F12') {
      e.preventDefault()
      this.debugOverlay.toggle()
      return
    }
    if (e.code === 'F1') {
      e.preventDefault()
      this.cockpit.cycleLeftMFD()
      return
    }
    if (e.code === 'F2') {
      e.preventDefault()
      this.cockpit.cycleRightMFD()
      return
    }
    if (e.code === 'Escape' && !this.completionScheduled) {
      e.preventDefault()
      this.missionAbortRequested = true
    }
  }

  start(): void {
    void this.startInternal()
  }

  private async startInternal(): Promise<void> {
    await this.initMultiplayer()
    this.applyPeerSpawnOffset()
    const spawnCounts = spawnScenario(this.scenario, this.entityManager, this.player)
    this.missionTracker = new MissionTracker(this.scenario, spawnCounts)
    this.sessionStartTime = performance.now()
    this.lastTime = this.sessionStartTime
    this.loop(this.sessionStartTime)
  }

  private applyPeerSpawnOffset(): void {
    if (!this.localNetworkId) return
    const match = this.localNetworkId.match(/^peer_(\d+)$/)
    if (!match) return
    const peerNum = parseInt(match[1]!, 10)
    if (peerNum <= 1) return
    // Each peer beyond the first is offset 600 m east so players spawn in different positions.
    const eastM = (peerNum - 1) * 600
    this.player.state.positionNED[1] = eastM
    // Keep state vector consistent with the new position (sv index 1 = East).
    this.player.state.sv[1] = eastM
  }

  private async initMultiplayer(): Promise<void> {
    if (this.multiplayerConfig.mode === 'single') return
    try {
      if (this.multiplayer && this.multiplayer.isConnected()) {
        this.localNetworkId = this.multiplayer.getLocalPlayerId()
        return
      }
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
    this.frameDt = dt
    this.lastTime = timestamp
    this.accumulator += dt

    while (this.accumulator >= FIXED_DT) {
      this.tick(FIXED_DT)
      this.accumulator -= FIXED_DT
    }

    this.render()
  }

  private tick(dt: number): void {
    const controls = this.inputManager.getControls(dt)
    // Wingman radio commands — issued before update so the wingman responds this tick.
    if (controls.wingmanEngage) this.entityManager.commandWingmen('ENGAGE')
    if (controls.wingmanCover)  this.entityManager.commandWingmen('COVER')
    if (controls.wingmanRTB)    this.entityManager.commandWingmen('RTB')
    if (controls.wingmanRejoin) this.entityManager.commandWingmen('REJOIN')
    this.player.update(dt, controls, this.entityManager.getEnemies(), this.localNetworkId ?? undefined, this.entityManager.getGroundTargets())
    this.syncMultiplayer(dt)
    this.entityManager.update(dt, this.player)
    this.awacs.update(dt, this.entityManager.getEnemies(), 'player', this.player.state.positionNED, this.player.spec.nation)
    const targetIds = this.localNetworkId ? ['player', this.localNetworkId] : ['player']
    const inboundMissiles = this.entityManager.getInboundMissiles(targetIds)
    this.player.rwr.addMissileThreats(inboundMissiles, this.player.state)
    this.audioManager.update(this.player, controls, this.entityManager.getEnemies())
    const radarShootCueActive = this.hud.isRadarShootCueActive()
    if (radarShootCueActive && !this.wasRadarShootCueActive) {
      this.audioManager.play('SHOOT')
    }
    this.wasRadarShootCueActive = radarShootCueActive

    // Smooth G with ~0.4 s time-constant so vignette builds gradually
    const tau = 0.4
    this.gSmoothed += (this.player.state.gCurrent - this.gSmoothed) * Math.min(1, dt / tau)

    this.updateMissionEnd(dt)
  }

  private updateMissionEnd(_dt: number): void {
    if (this.completionScheduled) return

    const elapsed = (performance.now() - this.sessionStartTime) / 1000
    const playerKilled = this.player.state.ejected && !this.player.voluntaryEject
    const playerEjected = this.player.state.ejected && this.player.voluntaryEject

    if (this.missionAbortRequested) {
      this.scheduleMissionEnd('aborted', 0.5)
      return
    }

    if (this.missionTracker) {
      const evaluation = this.missionTracker.evaluate({
        elapsedSec: elapsed,
        enemyKills: this.entityManager.killCount,
        groundKills: this.entityManager.groundKillCount,
        enemiesRemaining: this.entityManager.getEnemyCount(),
        groundRemaining: this.entityManager.getGroundTargetCount(),
        playerEjected,
        playerKilled,
      })

      if (evaluation.outcome === 'success') {
        this.scheduleMissionEnd('success', 2)
        return
      }
      if (evaluation.outcome === 'failure') {
        this.scheduleMissionEnd('failure', 2)
        return
      }
      if (evaluation.outcome === 'killed') {
        this.scheduleMissionEnd('killed', 4)
        return
      }
      if (evaluation.outcome === 'ejected') {
        this.scheduleMissionEnd('ejected', 4)
        return
      }
    } else if (this.player.state.ejected) {
      this.scheduleMissionEnd(playerKilled ? 'killed' : 'ejected', 4)
    }
  }

  private scheduleMissionEnd(outcome: MissionOutcome, delaySec: number): void {
    if (this.completionScheduled) return
    this.completionScheduled = true
    this.completionTimer = setTimeout(() => {
      if (this.disposed) return
      this.finishMission(outcome)
    }, delaySec * 1000)
  }

  private finishMission(outcome: MissionOutcome): void {
    if (this.disposed) return
    const elapsed = (performance.now() - this.sessionStartTime) / 1000
    const tracker = this.missionTracker
    const tickState = {
      elapsedSec: elapsed,
      enemyKills: this.entityManager.killCount,
      groundKills: this.entityManager.groundKillCount,
      enemiesRemaining: this.entityManager.getEnemyCount(),
      groundRemaining: this.entityManager.getGroundTargetCount(),
      playerEjected: outcome === 'ejected',
      playerKilled: outcome === 'killed',
    }
    const completedIds = tracker?.evaluate(tickState).completedObjectiveIds ?? []
    const objectivesTotal = tracker?.primaryObjectiveCount ?? 0
    const deaths = outcome === 'killed' || outcome === 'ejected' ? 1 : 0

    this.onComplete({
      kills: this.entityManager.killCount,
      groundKills: this.entityManager.groundKillCount,
      deaths,
      flightTimeSec: elapsed,
      aircraftName: this.player.spec.displayName,
      missionName: this.scenario.name,
      outcome,
      objectivesCompleted: completedIds.filter(id =>
        this.scenario.objectives.some(o => o.id === id && !o.optional)
      ).length,
      objectivesTotal,
      objectiveLabels: tracker?.getObjectiveLabels(completedIds) ?? [],
    })
  }

  private syncMultiplayer(dt: number): void {
    if (!this.multiplayer || !this.multiplayer.isConnected()) return

    this.localNetworkId = this.multiplayer.getLocalPlayerId() ?? this.localNetworkId
    const radarState = this.player.radar.state
    this.multiplayer.queueState({
      positionNED: [...this.player.state.positionNED] as [number, number, number],
      velocityNED: [...this.player.state.velocityNED] as [number, number, number],
      attitudeQuat: [...this.player.state.attitudeQuat] as [number, number, number, number],
      throttle: this.player.state.throttle,
      ejected: this.player.state.ejected,
      structuralFailure: this.player.damage.structuralFailure,
      radar: {
        mode: radarState.mode,
        sttTargetId: radarState.sttTargetId,
      },
      missiles: this.player.missiles.getMissiles()
        .filter(m => m.active)
        .map(m => ({
          id: m.id,
          positionNED: [...m.positionNED] as [number, number, number],
          velocityNED: [...m.velocityNED] as [number, number, number],
          targetEntityId: m.targetEntityId,
          active: m.active,
        })),
      countermeasures: {
        flares: this.player.cmds.getActiveFlares().map(f => ({
          positionNED: [...f.positionNED] as [number, number, number],
          heatSignatureKW: f.heatSignatureKW,
          ageSec: f.ageSec,
        })),
        chaffClouds: this.player.cmds.getActiveChaffClouds().map(c => ({
          positionNED: [...c.positionNED] as [number, number, number],
          velocityNED: [...c.velocityNED] as [number, number, number],
          rcsM2: c.rcsM2,
          ageSec: c.ageSec,
        })),
      },
    })
    this.multiplayer.flushStateSend(dt)

    const snapshots = this.multiplayer.getRemoteSnapshots()

    // Swap-buffer pattern: reuse two pre-allocated Sets instead of allocating one per tick.
    const prev = this.trackedRemoteIds
    const seen = this._remoteIdSwap
    seen.clear()
    for (const snap of snapshots) {
      seen.add(snap.playerId)
      if (!snap.state) continue
      const remoteSpec = getAircraftById(snap.profile.aircraftId)
      if (!remoteSpec) continue
      this.entityManager.upsertRemotePlayer(snap.playerId, remoteSpec, snap.state)
    }
    for (const trackedId of prev) {
      if (!seen.has(trackedId)) this.entityManager.removeRemotePlayer(trackedId)
    }
    this._remoteIdSwap       = prev   // reclaim for next tick
    this.trackedRemoteIds    = seen

    if (!this.localNetworkId) return
    for (const hit of this.multiplayer.consumeInboundHits()) {
      if (hit.targetId !== this.localNetworkId) continue
      applyHit(this.player.damage, hit.zone, hit.severity, this.player.state.invincible)
    }
  }

  private render(): void {
    const playerState = this.player.state
    const cockpitView = this.cameraManager.getMode() === 'COCKPIT'
    this.player.setCockpitViewActive(cockpitView)
    this.cameraManager.update(this.player)
    this.player.hms.setHeadDir(this.cameraManager.getHeadAzDeg(), this.cameraManager.getHeadElDeg())

    // Sync mesh transforms
    this.player.updateMesh()
    this.entityManager.updateMeshes(playerState.positionNED, this.frameDt)

    // In-cockpit 3D HUD / MFD pages
    this.cockpit.update(this.player, this.entityManager, this.awacs.picture, cockpitView)

    // Countermeasure visual effects — player + all AI aircraft
    this.flareEffect.update([...this.player.cmds.getActiveFlares(), ...this.entityManager.getAllAIFlares()])
    this.chaffEffect.update([...this.player.cmds.getActiveChaffClouds(), ...this.entityManager.getAllAIChaff()])

    // Keep sky centred on camera and shadow frustum centred on player
    this.sceneManager.updateSky(this.sceneManager.camera)
    this.sceneManager.updateSunFollow(this.sceneManager.camera.position)

    // G-effect post processing (use smoothed value so vignette ramps gradually)
    this.postFX.setGLoad(this.glocEnabled ? this.gSmoothed : 1.0)
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

  dispose(options?: { preserveMultiplayer?: boolean }): LobbyRestoreBundle | undefined {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    if (this.completionTimer !== null) {
      clearTimeout(this.completionTimer)
      this.completionTimer = null
    }
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('resize',  this.onResize)
    this.inputManager.dispose()
    this.entityManager.dispose()
    this.player.dispose()
    this.cameraManager.dispose()
    this.hud.dispose()
    this.debugOverlay.dispose()
    this.debugVisuals.dispose()
    this.flareEffect.dispose()
    this.chaffEffect.dispose()
    this.cockpit.dispose()
    this.postFX.dispose()
    this.sceneManager.dispose()
    this.audioManager.dispose()

    const preserve =
      Boolean(options?.preserveMultiplayer) &&
      this.multiplayerConfig.mode !== 'single' &&
      this.multiplayer !== null &&
      this.multiplayer.isConnected()

    let restored: LobbyRestoreBundle | undefined
    if (preserve && this.multiplayer) {
      restored = { client: this.multiplayer, config: this.multiplayerConfig }
      this.multiplayer = null
    } else {
      this.multiplayer?.disconnect()
      this.multiplayer = null
      if (this.multiplayerConfig.mode === 'host') void window.fsim.multiplayer.stopHost()
    }

    return restored
  }
}
