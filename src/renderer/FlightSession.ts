import { SceneManager } from './scene/SceneManager'
import { CameraManager } from './camera/CameraManager'
import { PlayerAircraft } from './entities/PlayerAircraft'
import { EntityManager } from './entities/EntityManager'
import { InputManager } from './input/InputManager'
import { HUD } from './ui/HUD'
import { DebugOverlay } from './debug/DebugOverlay'
import { DebugVisuals } from './debug/DebugVisuals'
import { AudioManager } from './audio/AudioManager'
import { PostFXManager, type PostFXQuality } from './postfx/PostFXManager'
import { AWACS } from './avionics/AWACS'
import { MultiplayerClient } from './network/MultiplayerClient'
import type { MultiplayerConfig } from './network/MultiplayerTypes'
import type { AircraftSpec } from './types/aircraft'
import type { LoadedStore } from './types/weapons'
import { getAircraftById } from './data/aircraft/catalog'
import type { FlightResult, MissionOutcome, ScenarioDescriptor } from './types/mission'
import { MissionTracker } from './mission/MissionTracker'
import { applyPlayerSpawn, spawnScenario } from './mission/ScenarioSpawner'
import { FlareEffect } from './scene/FlareEffect'
import { ChaffEffect } from './scene/ChaffEffect'
import { setLODCamera } from './entities/Aircraft'
import { warmupMissileVisuals } from './weapons/MissileSystem'
import { warmupExplosionVisuals, stepExplosionPool, setExplosionAudioHook } from './scene/ExplosionEffect'
import { CockpitController } from './cockpit/CockpitController'
import { PauseMenu } from './ui/PauseMenu'
import { RespawnOverlay } from './ui/RespawnOverlay'
import type { ScoreboardRow } from './ui/HUDElements/Scoreboard'
import { SortieStats } from './mission/SortieStats'
import { saveSettings } from './persistence'
import { getAGLM } from './scene/Terrain'
import { applyWeatherPreset, type WeatherPreset } from './physics/WeatherPresets'
import type { TimeOfDayPreset } from './scene/TimeOfDay'

const FIXED_DT = 1 / 60

/** Per-sortie options chosen on the Loadout screen. */
export interface FlightOptions {
  glocEnabled: boolean
  autoRudder: boolean
  invertPitch: boolean
  timeOfDay: TimeOfDayPreset
  weather: WeatherPreset
  masterVolume: number
  postFXQuality: PostFXQuality
}

export const DEFAULT_FLIGHT_OPTIONS: FlightOptions = {
  glocEnabled: false,
  autoRudder: true,
  invertPitch: false,
  timeOfDay: 'DAY',
  weather: 'CLEAR',
  masterVolume: 0.8,
  postFXQuality: 'HIGH',
}

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
  private respawning = false
  private respawnTimer: ReturnType<typeof setTimeout> | null = null
  private respawnOverlay: RespawnOverlay | null = null
  private static readonly RESPAWN_DELAY_SEC = 5
  private frameDt = FIXED_DT
  private glocEnabled: boolean
  private autoRudder: boolean
  private wasRadarShootCueActive = false
  private scenario: ScenarioDescriptor
  private missionTracker: MissionTracker | null = null
  private missionAbortRequested = false

  // ── Pause ──────────────────────────────────────────────────────────────────
  private paused = false
  private pauseMenu: PauseMenu | null = null
  private onRestart: (() => void) | null

  // ── Sortie telemetry / mission progress ────────────────────────────────────
  private sortieStats = new SortieStats()
  private startedOnRunway = false
  private hasBeenAirborne = false
  private landedSafely = false
  private seenInboundMissileIds = new Set<string>()

  // ── Kill attribution ───────────────────────────────────────────────────────
  private lastDamageSourceId: string | null = null
  private lastDamageAtMs = 0
  /** Deaths this session, including multiplayer respawns, so debrief is honest. */
  private sessionDeaths = 0
  /**
   * How long a hit stays "responsible" for a death. Long enough to cover a
   * mortally damaged aircraft spiralling into the ground, short enough that a
   * scratch taken minutes earlier does not steal the credit from terrain.
   */
  private static readonly KILL_CREDIT_WINDOW_MS = 10_000

  private onComplete: (result: FlightResult) => void

  constructor(
    spec: AircraftSpec,
    stores: LoadedStore[],
    scenario: ScenarioDescriptor,
    multiplayer: MultiplayerConfig,
    existingMultiplayerClient: MultiplayerClient | null,
    onComplete: (result: FlightResult) => void,
    options: FlightOptions = DEFAULT_FLIGHT_OPTIONS,
    onRestart: (() => void) | null = null
  ) {
    this.onComplete = onComplete
    this.onRestart = onRestart
    this.scenario = scenario
    this.glocEnabled = options.glocEnabled
    this.autoRudder = options.autoRudder
    this.multiplayerConfig = multiplayer
    this.multiplayer = existingMultiplayerClient
    this.startedOnRunway = Boolean(scenario.playerSpawn.onRunway)

    // `options` already carries the scenario defaults (seeded in the Loadout
    // screen) plus any player override. Weather must be applied before the scene
    // reads it for fog / clouds.
    applyWeatherPreset(options.weather)

    const threeCanvas = document.getElementById('three-canvas') as HTMLCanvasElement
    const hudCanvas = document.getElementById('hud-canvas') as HTMLCanvasElement

    this.sceneManager = new SceneManager(threeCanvas, options.timeOfDay, options.postFXQuality)
    this.cameraManager = new CameraManager(this.sceneManager.camera)
    this.inputManager = new InputManager({ invertPitch: options.invertPitch })
    this.audioManager = new AudioManager()
    this.audioManager.setMasterVolume(options.masterVolume)
    // Attempt to load real sound files from public/sounds/. Falls back to synthesis silently.
    void this.audioManager.loadSounds('sounds/')

    setExplosionAudioHook(worldPos => {
      const cam = this.sceneManager.camera
      this.audioManager.playExplosionAt(cam.position.distanceTo(worldPos))
    })

    this.player = new PlayerAircraft(spec, stores, this.sceneManager.scene, this.autoRudder, this.glocEnabled)
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
      this.sortieStats.onMissileLaunch()
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
      this.sortieStats.onDecoySuccess()
    })
    // Receiving side: the damage model already drove real flight consequences,
    // the player just had no way to know they had been hit.
    this.player.onHitTaken = (zone, severity) => {
      this.hud.notifyHitTaken(zone, severity)
      this.audioManager.play('HIT')
    }
    this.player.setOnTargetHit((targetId, zone, severity, weapon) => {
      this.sortieStats.onWeaponHit(weapon)
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

    this.postFX = new PostFXManager(
      this.sceneManager.renderer,
      this.sceneManager.scene,
      this.sceneManager.camera,
      options.postFXQuality,
    )
    this.postFX.setSize(window.innerWidth, window.innerHeight)
    this.postFX.setBloomStrength(this.sceneManager.getBloomStrength())
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
      this.togglePause()
    }
  }

  /** Open/close the pause menu. Single-player freezes the sim; LAN keeps running. */
  private togglePause(): void {
    if (this.pauseMenu) {
      this.resumeFromPause()
      return
    }
    const isSingle = this.multiplayerConfig.mode === 'single'
    this.paused = isSingle
    if (isSingle) this.audioManager.setPaused(true)
    this.pauseMenu = new PauseMenu(
      { multiplayer: !isSingle, masterVolume: this.audioManager.getMasterVolume() },
      {
        onResume: () => this.resumeFromPause(),
        onRestart: () => {
          this.resumeFromPause()
          this.onRestart?.()
        },
        onAbort: () => {
          this.resumeFromPause()
          if (!this.completionScheduled) this.missionAbortRequested = true
        },
        onVolumeChange: volume => {
          this.audioManager.setMasterVolume(volume)
          saveSettings({ masterVolume: volume })
        },
      }
    )
  }

  private resumeFromPause(): void {
    this.pauseMenu?.dispose()
    this.pauseMenu = null
    if (this.paused) {
      this.paused = false
      this.audioManager.setPaused(false)
    }
  }

  start(): void {
    void this.startInternal()
  }

  private async startInternal(): Promise<void> {
    await this.initMultiplayer()
    this.applyPeerSpawnOffset()
    // initMultiplayer has resolved by here, so `multiplayer` is settled.
    const spawnCounts = spawnScenario(this.scenario, this.entityManager, this.player, {
      suppressAI: this.isMultiplayerLive(),
    })
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

  /**
   * Who to credit for the local player's death, or null for terrain, a stall
   * or a voluntary eject. The server re-validates that the id is a live peer.
   */
  private resolveKillerId(): string | null {
    if (!this.lastDamageSourceId) return null
    const ageMs = performance.now() - this.lastDamageAtMs
    if (ageMs > FlightSession.KILL_CREDIT_WINDOW_MS) return null
    return this.lastDamageSourceId
  }

  /** True only when a LAN session was requested *and* the socket is up. */
  private isMultiplayerLive(): boolean {
    return (
      this.multiplayerConfig.mode !== 'single' &&
      this.multiplayer !== null &&
      this.multiplayer.isConnected()
    )
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

    // Poll the controller once per frame — even while paused, so the Menu button
    // can resume and the View button can still swap cameras.
    this.inputManager.beginFrame()
    const nav = this.inputManager.getFrameActions()
    if (nav.cameraToggle) this.cameraManager.toggleMode()
    if (nav.pauseToggle && !this.completionScheduled) this.togglePause()

    // Single-player pause: freeze the fixed-step sim but keep painting the frozen
    // frame so the scene stays visible behind the DOM overlay.
    if (this.paused) {
      this.lastTime = timestamp
      this.accumulator = 0
      this.render()
      return
    }

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
    // Explosion particle pool is shared per-scene across every MissileSystem/BombSystem
    // (player, AI, SAMs, debug) — step it exactly once per tick here, not inside each
    // weapon system's own update().
    stepExplosionPool(this.sceneManager.scene, dt)
    this.player.update(dt, controls, this.entityManager.getEnemies(), this.localNetworkId ?? undefined, this.entityManager.getGroundTargets())
    this.syncMultiplayer(dt)
    this.entityManager.update(dt, this.player)
    this.awacs.update(dt, this.entityManager.getEnemies(), 'player', this.player.state.positionNED, this.player.spec.nation)
    const targetIds = this.localNetworkId ? ['player', this.localNetworkId] : ['player']
    const inboundMissiles = this.entityManager.getInboundMissiles(targetIds)
    this.player.rwr.addMissileThreats(inboundMissiles, this.player.state)
    for (const m of inboundMissiles) {
      if (!this.seenInboundMissileIds.has(m.id)) {
        this.seenInboundMissileIds.add(m.id)
        this.sortieStats.onIncomingMissile()
      }
    }
    this.audioManager.update(this.player, controls, this.entityManager.getEnemies())
    const radarShootCueActive = this.hud.isRadarShootCueActive()
    if (radarShootCueActive && !this.wasRadarShootCueActive) {
      this.audioManager.play('SHOOT')
    }
    this.wasRadarShootCueActive = radarShootCueActive

    // G-LOC physiology (oxygen debt / AGSM / incapacitation) is advanced inside
    // PlayerAircraft.update() so it can gate the pilot's control inputs.

    this.sampleFlightState()
    this.updateMissionEnd(dt)
  }

  /** Per-tick sortie telemetry + takeoff/landing progress. */
  private sampleFlightState(): void {
    const s = this.player.state
    const elapsed = (performance.now() - this.sessionStartTime) / 1000
    const aglM = getAGLM(s.positionNED)

    this.sortieStats.onTick(
      { gCurrent: s.gCurrent, mach: s.mach, iasKts: s.iasKts },
      aglM,
      elapsed,
      this.entityManager.killCount + this.entityManager.groundKillCount,
    )

    if (!s.onGround && aglM > 30) this.hasBeenAirborne = true

    const onRunwayArea = Math.abs(s.positionNED[0]) < 2600 && Math.abs(s.positionNED[1]) < 130
    this.landedSafely =
      s.onGround &&
      !s.gearCollapsed &&
      s.iasKts < 60 &&
      s.lastTouchdownSinkMS !== null &&
      s.lastTouchdownSinkMS < 5 &&
      onRunwayArea
  }

  private updateMissionEnd(_dt: number): void {
    if (this.completionScheduled || this.respawning) return

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
        startedOnRunway: this.startedOnRunway,
        hasBeenAirborne: this.hasBeenAirborne,
        landedSafely: this.landedSafely,
      })

      if (evaluation.outcome === 'success') {
        this.scheduleMissionEnd('success', 2)
        return
      }
      if (evaluation.outcome === 'failure') {
        this.scheduleMissionEnd('failure', 2)
        return
      }
      if (evaluation.outcome === 'killed' || evaluation.outcome === 'ejected') {
        this.handlePlayerDown(evaluation.outcome)
        return
      }
    }

    // Unconditional fallback. This used to be the `else` of the branch above,
    // but startInternal always constructs a tracker, so the branch was dead —
    // and a scenario with no lose conditions (Free Flight) returns outcome null
    // forever. Dying there left the player sitting in the wreck with no debrief
    // and no way out except the pause menu's abort, if they thought to look.
    if (this.player.state.ejected) {
      this.handlePlayerDown(playerKilled ? 'killed' : 'ejected')
    }
  }

  /**
   * Single-player: death ends the sortie. Multiplayer: stay in the session and
   * respawn after a short overlay so a four-player dogfight is not two menus.
   */
  private handlePlayerDown(outcome: 'killed' | 'ejected'): void {
    if (this.isMultiplayerLive()) {
      this.beginRespawn(outcome)
      return
    }
    this.scheduleMissionEnd(outcome, 4)
  }

  private beginRespawn(outcome: 'killed' | 'ejected'): void {
    if (this.respawning) return
    this.respawning = true
    this.sessionDeaths++
    this.multiplayer?.sendDeath(this.resolveKillerId())

    this.respawnOverlay = new RespawnOverlay({
      killerName: this.displayNameFor(this.resolveKillerId()),
      outcome,
      delaySec: FlightSession.RESPAWN_DELAY_SEC,
      getStandings: () => this.collectStandings(),
    })

    this.respawnTimer = setTimeout(() => {
      if (this.disposed) return
      this.completeRespawn()
    }, FlightSession.RESPAWN_DELAY_SEC * 1000)
  }

  private completeRespawn(): void {
    this.respawnTimer = null
    this.respawnOverlay?.dispose()
    this.respawnOverlay = null

    this.player.respawn()
    applyPlayerSpawn(this.player, this.scenario)
    this.applyPeerSpawnOffset()
    this.scatterRespawn()

    this.seenInboundMissileIds.clear()
    this.lastDamageSourceId = null
    this.lastDamageAtMs = 0
    this.respawning = false
  }

  /** Offset the respawn so we do not stack on the killer or on other peers. */
  private scatterRespawn(): void {
    const alt = this.player.state.positionNED[2]
    const heading = Math.random() * Math.PI * 2
    const north = (Math.random() * 2 - 1) * 3000
    const east = (Math.random() * 2 - 1) * 3000
    const speed = 250
    const velN = speed * Math.cos(heading)
    const velE = speed * Math.sin(heading)
    const half = heading / 2
    const q: [number, number, number, number] = [Math.cos(half), 0, 0, Math.sin(half)]

    this.player.state.positionNED = [north, east, alt]
    this.player.state.velocityNED = [velN, velE, 0]
    this.player.state.attitudeQuat = q
    this.player.state.sv = [
      north, east, alt,
      velN, velE, 0,
      q[0], q[1], q[2], q[3],
      0, 0, 0,
    ]
  }

  private displayNameFor(playerId: string | null): string | null {
    if (!playerId || !this.multiplayer) return null
    if (playerId === this.localNetworkId) {
      return this.multiplayer.getProfile().callsign || 'You'
    }
    const snap = this.multiplayer.getRemoteSnapshots().find(s => s.playerId === playerId)
    return snap?.profile.callsign || playerId
  }

  private collectStandings(): ScoreboardRow[] {
    if (!this.multiplayer) return []
    const localId = this.localNetworkId
    const rows: ScoreboardRow[] = []
    if (localId) {
      const score = this.multiplayer.getScore(localId)
      rows.push({
        playerId: localId,
        name: this.multiplayer.getProfile().callsign || 'You',
        aircraft: this.player.spec.displayName,
        kills: score.kills,
        deaths: score.deaths,
        isLocal: true,
      })
    }
    for (const snap of this.multiplayer.getRemoteSnapshots()) {
      const score = this.multiplayer.getScore(snap.playerId)
      const spec = getAircraftById(snap.profile.aircraftId)
      rows.push({
        playerId: snap.playerId,
        name: snap.profile.callsign || snap.playerId,
        aircraft: spec?.displayName ?? snap.profile.aircraftId.toUpperCase(),
        kills: score.kills,
        deaths: score.deaths,
        isLocal: false,
      })
    }
    return rows
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
      startedOnRunway: this.startedOnRunway,
      hasBeenAirborne: this.hasBeenAirborne,
      landedSafely: this.landedSafely,
    }
    const completedIds = tracker?.evaluate(tickState).completedObjectiveIds ?? []
    const objectivesTotal = tracker?.primaryObjectiveCount ?? 0
    const deaths = this.sessionDeaths + (outcome === 'killed' || outcome === 'ejected' ? 1 : 0)

    const spec = this.player.spec
    const s = this.player.state
    const stats = this.sortieStats.finalize({
      gunRoundsFired: (spec.gunSpec?.totalRounds ?? 0) - this.player.gun.getRoundsRemaining(),
      flaresUsed: (spec.cmdsFlareCount ?? 120) - this.player.cmds.flareCount,
      chaffUsed: (spec.cmdsChaffCount ?? 120) - this.player.cmds.chaffCount,
    })
    const landing =
      s.onGround && s.lastTouchdownSinkMS !== null
        ? { sinkMS: s.lastTouchdownSinkMS, gearIntact: !s.gearCollapsed }
        : undefined

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
      stats,
      landing,
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
          velocityNED: [...f.velocityNED] as [number, number, number],
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
      this.entityManager.upsertRemotePlayer(
        snap.playerId,
        remoteSpec,
        snap.state,
        snap.profile.callsign,
      )
    }
    for (const trackedId of prev) {
      if (!seen.has(trackedId)) this.entityManager.removeRemotePlayer(trackedId)
    }
    this._remoteIdSwap       = prev   // reclaim for next tick
    this.trackedRemoteIds    = seen

    if (!this.localNetworkId) return
    this.hud.setLocalNetworkId(this.localNetworkId)
    this.hud.setScoreboard(this.collectStandings())

    for (const hit of this.multiplayer.consumeInboundHits()) {
      if (hit.targetId !== this.localNetworkId) continue
      this.player.applyIncomingHit(hit.zone, hit.severity)
      // Remember who last hurt us so a death can be attributed. Damage is
      // client-authoritative, so the victim is the only one who can say.
      this.lastDamageSourceId = hit.sourceId
      this.lastDamageAtMs = performance.now()
    }

    for (const death of this.multiplayer.consumeInboundDeaths()) {
      this.hud.notifyKill(
        this.displayNameFor(death.killerId),
        this.displayNameFor(death.victimId) ?? death.victimId,
        death.killerId === this.localNetworkId,
        death.victimId === this.localNetworkId,
      )
    }
  }

  private render(): void {
    const playerState = this.player.state
    const cockpitView = this.cameraManager.getMode() === 'COCKPIT'
    this.player.setCockpitViewActive(cockpitView)
    this.cameraManager.update(this.player, this.frameDt)
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

    // G-effect post processing — greyout / blackout / redout from the G-LOC model
    const gloc = this.player.gloc.state
    this.postFX.setGEffect({ greyout: gloc.greyout, blackout: gloc.blackout, redout: gloc.redout })
    this.postFX.render()

    // Canvas HUD
    this.hud.render(this.sceneManager.camera, this.cameraManager.getMode())

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
    this.paused = false
    this.pauseMenu?.dispose()
    this.pauseMenu = null
    this.respawnOverlay?.dispose()
    this.respawnOverlay = null
    cancelAnimationFrame(this.rafId)
    if (this.completionTimer !== null) {
      clearTimeout(this.completionTimer)
      this.completionTimer = null
    }
    if (this.respawnTimer !== null) {
      clearTimeout(this.respawnTimer)
      this.respawnTimer = null
    }
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('resize',  this.onResize)
    // Module-level, so it must be released or it closes over a dead session.
    setExplosionAudioHook(null)
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

    const preserve = Boolean(options?.preserveMultiplayer) && this.isMultiplayerLive()

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
