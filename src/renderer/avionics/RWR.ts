import type { RWRState, RWRThreat } from '../types/radar'
import type { AircraftState } from '../types/aircraft'
import type { Aircraft } from '../entities/Aircraft'
import { v3sub, v3len, RAD2DEG, quatRotateVec, quatConjugate } from '../utils/MathUtils'

export class RWR {
  state: RWRState = { threats: [], hasMissileLaunch: false }
  private seenMissileIds = new Set<string>()
  /** Persistent synthetic emitters for debug — merged after real threats each frame. */
  private debugInjectedThreats: RWRThreat[] = []
  /** Arms `hasMissileLaunch` when synthetic missile symbols are injected (debug overlay). */
  private pendingSyntheticMissileVoice = false

  update(enemies: Aircraft[], ownState: AircraftState, ownId = 'player'): void {
    this.state.threats = []
    this.state.hasMissileLaunch = false  // reset each tick; addMissileThreats may set it

    for (const enemy of enemies) {
      const toEnemy = v3sub(enemy.state.positionNED, ownState.positionNED)
      const bodyVec = quatRotateVec(quatConjugate(ownState.attitudeQuat), toEnemy)
      const azDeg = Math.atan2(bodyVec[1], bodyVec[0]) * RAD2DEG

      const ri = enemy.getRadarInfo()
      const isTracked = ri !== null && ri.tracksPlayer(ownId)
      const isSTT = isTracked && ri!.mode === 'STT'

      this.state.threats.push({
        entityId: enemy.entityId,
        azimuthDeg: azDeg,
        type: isSTT || isTracked ? 'TRACK' : 'SEARCH',
        priority: isSTT ? 4 : isTracked ? 3 : 1,
      })
    }

    for (const t of this.debugInjectedThreats) {
      this.state.threats.push({ ...t })
    }
  }

  addMissileThreats(
    missiles: Array<{ id: string; positionNED: [number, number, number] }>,
    ownState: AircraftState,
  ): void {
    const currentIds = new Set(missiles.map(m => m.id))

    for (const m of missiles) {
      const toMissile = v3sub(m.positionNED, ownState.positionNED)
      const bodyVec = quatRotateVec(quatConjugate(ownState.attitudeQuat), toMissile)
      const azDeg = Math.atan2(bodyVec[1], bodyVec[0]) * RAD2DEG
      const distanceM = v3len(toMissile)

      // Detect new launches — flag so AudioManager can trigger voice callout
      if (!this.seenMissileIds.has(m.id)) {
        this.state.hasMissileLaunch = true
      }

      this.state.threats.push({
        entityId: m.id,
        azimuthDeg: azDeg,
        type: 'MISSILE',
        priority: 5,
        distanceM,
      })
    }

    // Expire IDs for missiles that are no longer active
    this.seenMissileIds = currentIds

    if (this.pendingSyntheticMissileVoice) {
      this.state.hasMissileLaunch = true
      this.pendingSyntheticMissileVoice = false
    }
  }

  clearDebugInjectedThreats(): void {
    this.debugInjectedThreats.length = 0
  }

  getDebugInjectedThreatCount(): number {
    return this.debugInjectedThreats.length
  }

  /** Hostile search radar — new emitter id each call so search ping audio can fire. */
  injectDebugEnemySearch(azimuthDeg: number): void {
    this.debugInjectedThreats.push({
      entityId: `debug_search_${performance.now().toFixed(3)}_${Math.random().toString(36).slice(2, 7)}`,
      azimuthDeg,
      type: 'SEARCH',
      priority: 1,
    })
  }

  /** Hostile track (not STT) — drives RWR track tone. */
  injectDebugEnemyTrack(azimuthDeg: number): void {
    this.debugInjectedThreats.push({
      entityId: `debug_trk_${performance.now().toFixed(3)}`,
      azimuthDeg,
      type: 'TRACK',
      priority: 3,
    })
  }

  /** Hostile STT / launch-lock cue — drives RWR lock tone (priority ≥ 4). */
  injectDebugEnemyRadarLock(azimuthDeg: number): void {
    this.debugInjectedThreats.push({
      entityId: `debug_lock_${performance.now().toFixed(3)}`,
      azimuthDeg,
      type: 'TRACK',
      priority: 4,
    })
  }

  /** EW missile symbol + missile-launch voice cue; no in-world missile. */
  injectDebugEnemyMissileIndication(azimuthDeg: number, distanceM = 14000): void {
    this.pendingSyntheticMissileVoice = true
    this.debugInjectedThreats.push({
      entityId: `debug_msl_${performance.now().toFixed(3)}_${Math.random().toString(36).slice(2, 7)}`,
      azimuthDeg,
      type: 'MISSILE',
      priority: 5,
      distanceM,
    })
  }
}
