import type { AircraftSpec, AircraftState } from '../types/aircraft'
import type { RadarState, RadarTrack } from '../types/radar'
import type { Aircraft } from '../entities/Aircraft'
import { computeDetectionRange, isInScanBeam } from './RadarDetection'
import { v3dist } from '../utils/MathUtils'

export class Radar {
  state: RadarState
  private spec: AircraftSpec
  private time = 0
  /** O(1) track lookup — kept in sync with state.tracks at all mutation points. */
  private trackById = new Map<string, RadarTrack>()

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
      selectedTrackId: null,
      rangeModeM: 222240,  // 120nm default
      lastFullScanSec: 0,
    }
  }

  update(dt: number, ownState: AircraftState, enemies: Aircraft[], cycleMode: boolean): void {
    this.time += dt

    if (cycleMode) this.cycleMode()

    if (this.state.mode === 'OFF') return

    // Build live-trackable map in a single pass (avoids filter + separate map calls)
    const liveTrackable = new Map<string, Aircraft>()
    for (const e of enemies) {
      if (this.isRadarTrackable(e)) liveTrackable.set(e.entityId, e)
    }

    // Advance scan bar
    this.state.azimuthDeg += this.state.scanRateDegs * dt
    if (this.state.azimuthDeg > 60) {
      this.state.azimuthDeg = -60
      this.state.barIndex = (this.state.barIndex + 1) % this.state.scanBarsElDeg.length
      this.state.elevationBarDeg = this.state.scanBarsElDeg[this.state.barIndex] ?? 6
    }

    // STT: full energy on one target
    if (this.state.mode === 'STT' && this.state.sttTargetId) {
      const target = liveTrackable.get(this.state.sttTargetId)
      if (target) {
        this.updateTrack(target, ownState)
      } else {
        // Remove the lost STT track using the Map for O(1) lookup
        const lostId = this.state.sttTargetId
        this.state.tracks = this.state.tracks.filter(t => t.entityId !== lostId)
        this.trackById.delete(lostId)
        if (this.state.selectedTrackId === lostId) this.state.selectedTrackId = null
        this.state.sttTargetId = null
        this.state.mode = 'TWS'
      }
      return
    }

    // Sweep detection
    for (const [, enemy] of liveTrackable) {
      const dist = v3dist(ownState.positionNED, enemy.state.positionNED)
      if (dist > this.state.rangeModeM * 1.5) continue

      const rcs = this.getTargetRCS(enemy)
      const maxRange = computeDetectionRange(this.spec, rcs)
      if (dist > maxRange) continue

      if (isInScanBeam(this.state, ownState, enemy.state)) {
        this.updateTrack(enemy, ownState)
      }
    }

    // Single-pass: remove dead contacts AND decay confidence (was two separate filter calls)
    this.state.tracks = this.state.tracks.filter(t => {
      if (!liveTrackable.has(t.entityId)) {
        this.trackById.delete(t.entityId)
        return false
      }
      t.confidence = Math.max(0, t.confidence - dt * 0.1)
      if (t.confidence <= 0.05) {
        this.trackById.delete(t.entityId)
        return false
      }
      return true
    })

    // Keep selectedTrackId valid — use Map for O(1) existence check
    if (this.state.selectedTrackId && !this.trackById.has(this.state.selectedTrackId)) {
      this.state.selectedTrackId = this.state.tracks[0]?.entityId ?? null
    }
    // Auto-select first contact if none selected
    if (!this.state.selectedTrackId && this.state.tracks.length > 0) {
      this.state.selectedTrackId = this.state.tracks[0]!.entityId
    }
  }

  private isRadarTrackable(target: Aircraft): boolean {
    return !target.state.ejected &&
      !target.damage.structuralFailure &&
      target.damage.zones['ENGINE'] < 1.0 &&
      target.damage.zones['FUSELAGE'] < 1.0 &&
      target.damage.zones['COCKPIT'] < 1.0
  }

  selectNextTrack(): void {
    if (this.state.tracks.length === 0) { this.state.selectedTrackId = null; return }
    const ids = this.state.tracks.map(t => t.entityId)
    const idx = this.state.selectedTrackId !== null ? ids.indexOf(this.state.selectedTrackId) : -1
    this.state.selectedTrackId = ids[(idx + 1) % ids.length]!
  }

  lockSelectedTarget(): void {
    if (this.state.selectedTrackId) this.lockSTT(this.state.selectedTrackId)
  }

  unlockSTT(): void {
    if (this.state.mode !== 'STT') return
    const prevSelected = this.state.sttTargetId
    this.state.mode = 'TWS'
    this.state.sttTargetId = null
    for (const t of this.state.tracks) t.isSTT = false
    // Keep the cursor on the just-unlocked target so the player can see it
    if (prevSelected) this.state.selectedTrackId = prevSelected
  }

  private updateTrack(enemy: Aircraft, ownState: AircraftState): void {
    const existing = this.trackById.get(enemy.entityId)
    if (existing) {
      existing.positionNED = enemy.state.positionNED
      existing.velocityNED = enemy.state.velocityNED
      existing.lastUpdateSec = this.time
      existing.confidence = 1.0
    } else if (this.state.tracks.length < 8) {
      const track: RadarTrack = {
        entityId: enemy.entityId,
        positionNED: enemy.state.positionNED,
        velocityNED: enemy.state.velocityNED,
        rcsM2: this.getTargetRCS(enemy),
        lastUpdateSec: this.time,
        confidence: 1.0,
        isSTT: false,
      }
      this.state.tracks.push(track)
      this.trackById.set(enemy.entityId, track)
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

  /** O(1) track lookup — preferred over iterating state.tracks when only one track is needed. */
  getTrack(entityId: string): RadarTrack | undefined {
    return this.trackById.get(entityId)
  }

  getSttTargetId(): string | null {
    if (this.state.mode !== 'STT') return this.state.tracks[0]?.entityId ?? null
    return this.state.sttTargetId
  }

  lockSTT(entityId: string): void {
    this.state.mode = 'STT'
    this.state.sttTargetId = entityId
    const t = this.trackById.get(entityId)
    if (t) t.isSTT = true
  }
}
