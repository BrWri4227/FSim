import type { AircraftSpec, AircraftState } from '../types/aircraft'
import type { RadarState, RadarTrack } from '../types/radar'
import type { Aircraft } from '../entities/Aircraft'
import { computeDetectionRange, isInScanBeam } from './RadarDetection'
import { v3dist } from '../utils/MathUtils'

export class Radar {
  state: RadarState
  private spec: AircraftSpec
  private time = 0

  constructor(spec: AircraftSpec) {
    this.spec = spec
    this.state = {
      mode: 'RWS',
      azimuthDeg: -60,
      elevationBarDeg: 6,
      barIndex: 0,
      scanBarsElDeg: [6, 2, -2, -6],
      scanRateDegs: 60,
      tracks: [],
      sttTargetId: null,
      rangeModeM: 74080,  // 40nm default
      lastFullScanSec: 0,
    }
  }

  update(dt: number, ownState: AircraftState, enemies: Aircraft[], cycleMode: boolean): void {
    this.time += dt

    if (cycleMode) this.cycleMode()

    if (this.state.mode === 'OFF') return

    // Advance scan bar
    this.state.azimuthDeg += this.state.scanRateDegs * dt
    if (this.state.azimuthDeg > 60) {
      this.state.azimuthDeg = -60
      this.state.barIndex = (this.state.barIndex + 1) % this.state.scanBarsElDeg.length
      this.state.elevationBarDeg = this.state.scanBarsElDeg[this.state.barIndex] ?? 6
    }

    // STT: full energy on one target
    if (this.state.mode === 'STT' && this.state.sttTargetId) {
      const target = enemies.find(e => e.entityId === this.state.sttTargetId)
      if (target) {
        this.updateTrack(target, ownState)
      } else {
        this.state.sttTargetId = null
        this.state.mode = 'TWS'
      }
      return
    }

    // Sweep detection
    for (const enemy of enemies) {
      const dist = v3dist(ownState.positionNED, enemy.state.positionNED)
      if (dist > this.state.rangeModeM * 1.2) continue

      const rcs = this.getTargetRCS(enemy)
      const maxRange = computeDetectionRange(this.spec, rcs)
      if (dist > maxRange) continue

      if (isInScanBeam(this.state, ownState, enemy.state)) {
        this.updateTrack(enemy, ownState)
      }
    }

    // Decay confidence on stale tracks
    this.state.tracks = this.state.tracks.filter(t => {
      t.confidence = Math.max(0, t.confidence - dt * 0.1)
      return t.confidence > 0.05
    })

    // Auto-lock first track in TWS if no STT
    if (this.state.mode === 'TWS' && this.state.tracks.length > 0 && !this.state.sttTargetId) {
      // sort by range
    }
  }

  private updateTrack(enemy: Aircraft, ownState: AircraftState): void {
    const existing = this.state.tracks.find(t => t.entityId === enemy.entityId)
    if (existing) {
      existing.positionNED = enemy.state.positionNED
      existing.velocityNED = enemy.state.velocityNED
      existing.lastUpdateSec = this.time
      existing.confidence = 1.0
    } else if (this.state.tracks.length < 8) {
      this.state.tracks.push({
        entityId: enemy.entityId,
        positionNED: enemy.state.positionNED,
        velocityNED: enemy.state.velocityNED,
        rcsM2: this.getTargetRCS(enemy),
        lastUpdateSec: this.time,
        confidence: 1.0,
        isSTT: false,
      })
      // Auto TWS on first contact
      if (this.state.mode === 'RWS') this.state.mode = 'TWS'
    }
  }

  private getTargetRCS(enemy: Aircraft): number {
    return enemy.spec.rcsTableM2[0] ?? 5.0  // head-on RCS
  }

  cycleMode(): void {
    const modes = ['OFF', 'RWS', 'TWS', 'STT'] as const
    const idx = modes.indexOf(this.state.mode)
    this.state.mode = modes[(idx + 1) % modes.length]!
  }

  getSttTargetId(): string | null {
    if (this.state.mode !== 'STT') return this.state.tracks[0]?.entityId ?? null
    return this.state.sttTargetId
  }

  lockSTT(entityId: string): void {
    this.state.mode = 'STT'
    this.state.sttTargetId = entityId
    const t = this.state.tracks.find(t => t.entityId === entityId)
    if (t) t.isSTT = true
  }
}
