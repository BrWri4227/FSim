import type { AircraftSpec, AircraftState } from '../types/aircraft'
import type { RadarState, RadarTrack } from '../types/radar'
import type { Vec3 } from '../types/common'
import type { Aircraft } from '../entities/Aircraft'
import type { GroundTarget } from '../entities/GroundTarget'
import { computeDetectionRange, isInScanBeam } from './RadarDetection'
import { v3dist } from '../utils/MathUtils'

function cloneVec3(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]]
}

/** Aircraft integration replaces state Vec3 arrays each tick — tracks must own copies. */
function syncTrackKinematics(track: RadarTrack, positionNED: Vec3, velocityNED: Vec3): void {
  track.positionNED[0] = positionNED[0]
  track.positionNED[1] = positionNED[1]
  track.positionNED[2] = positionNED[2]
  track.velocityNED[0] = velocityNED[0]
  track.velocityNED[1] = velocityNED[1]
  track.velocityNED[2] = velocityNED[2]
}

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

  /**
   * @param skipBeamCheck — When true (AI prosecuting a priority bandit), any target in kinematic range
   *   can be tracked without lying in the instantaneous scan beam. Player radar keeps default false.
   */
  update(dt: number, ownState: AircraftState, enemies: Aircraft[], cycleMode: boolean, skipBeamCheck = false, groundTargets: GroundTarget[] = []): void {
    this.time += dt

    if (cycleMode) this.cycleMode()

    if (this.state.mode === 'OFF') return

    // GMTI mode: scan ground targets only. Aircraft tracks are dropped while in GMTI.
    if (this.state.mode === 'GMTI') {
      this.updateGMTI(dt, ownState, groundTargets, skipBeamCheck)
      return
    }

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
        this.refreshLiveTrackKinematics(liveTrackable)
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

      if (skipBeamCheck || isInScanBeam(this.state, ownState, enemy.state)) {
        this.updateTrack(enemy, ownState)
      }
    }

    this.refreshLiveTrackKinematics(liveTrackable)

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
    if (!this.state.selectedTrackId) return
    // GMTI lock-on stays in GMTI — STT is the aircraft-tracking mode and would
    // immediately drop a ground entity (it isn't in the aircraft live-track set).
    if (this.state.mode === 'GMTI') {
      const t = this.trackById.get(this.state.selectedTrackId)
      if (t) t.isSTT = true
      this.state.sttTargetId = this.state.selectedTrackId
      return
    }
    this.lockSTT(this.state.selectedTrackId)
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

  private refreshLiveTrackKinematics(liveTrackable: Map<string, Aircraft>): void {
    for (const t of this.state.tracks) {
      const live = liveTrackable.get(t.entityId)
      if (live) syncTrackKinematics(t, live.state.positionNED, live.state.velocityNED)
    }
  }

  private updateTrack(enemy: Aircraft, _ownState: AircraftState): void {
    const existing = this.trackById.get(enemy.entityId)
    if (existing) {
      syncTrackKinematics(existing, enemy.state.positionNED, enemy.state.velocityNED)
      existing.lastUpdateSec = this.time
      existing.confidence = 1.0
    } else if (this.state.tracks.length < 8) {
      const track: RadarTrack = {
        entityId: enemy.entityId,
        positionNED: cloneVec3(enemy.state.positionNED),
        velocityNED: cloneVec3(enemy.state.velocityNED),
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
    const modes = ['OFF', 'RWS', 'TWS', 'STT', 'GMTI'] as const
    const idx = modes.indexOf(this.state.mode)
    this.state.mode = modes[(idx + 1) % modes.length]!
    // Switching modes drops the previous track set so air/ground tracks don't mix on screen.
    if (this.state.mode === 'GMTI' || this.state.mode === 'OFF') {
      this.state.tracks = []
      this.trackById.clear()
      this.state.selectedTrackId = null
      this.state.sttTargetId = null
    }
  }

  /** GMTI scan: detects ground targets within range (uses ground RCS, ignores aspect). */
  private updateGMTI(dt: number, ownState: AircraftState, groundTargets: GroundTarget[], skipBeamCheck: boolean): void {
    // Advance the scan bar like RWS but with a wider effective beam.
    this.state.azimuthDeg += this.state.scanRateDegs * dt
    if (this.state.azimuthDeg > 60) this.state.azimuthDeg = -60

    const live = new Map<string, GroundTarget>()
    for (const g of groundTargets) {
      if (g.state.destroyed) continue
      live.set(g.entityId, g)
    }

    for (const [, gt] of live) {
      const dist = v3dist(ownState.positionNED, gt.state.positionNED)
      if (dist > this.state.rangeModeM * 1.5) continue
      const maxRange = computeDetectionRange(this.spec, gt.spec.rcsM2)
      if (dist > maxRange) continue
      // GMTI uses an azimuth-only scan check — real GMTI radars sweep a wide elevation
      // cone aimed at the ground, so the standard ±4° elevation bar from `isInScanBeam`
      // would never catch targets directly below the aircraft.
      if (skipBeamCheck || this.isInGMTIBeam(ownState, gt.state.positionNED)) {
        this.upsertGroundTrack(gt)
      }
    }

    for (const t of this.state.tracks) {
      const gt = live.get(t.entityId)
      if (gt) syncTrackKinematics(t, gt.state.positionNED, gt.state.velocityNED)
    }

    // Decay / prune
    this.state.tracks = this.state.tracks.filter(t => {
      if (!live.has(t.entityId)) {
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

    if (this.state.selectedTrackId && !this.trackById.has(this.state.selectedTrackId)) {
      this.state.selectedTrackId = this.state.tracks[0]?.entityId ?? null
    }
    if (!this.state.selectedTrackId && this.state.tracks.length > 0) {
      this.state.selectedTrackId = this.state.tracks[0]!.entityId
    }
  }

  /** Azimuth-only scan check for GMTI — accepts any depression angle. */
  private isInGMTIBeam(ownState: AircraftState, targetPosNED: [number, number, number]): boolean {
    const dx = targetPosNED[0] - ownState.positionNED[0]
    const dy = targetPosNED[1] - ownState.positionNED[1]
    const dz = targetPosNED[2] - ownState.positionNED[2]
    // Rotate to body frame (inline conjugate-rotation)
    const q = ownState.attitudeQuat
    const conj: [number, number, number, number] = [q[0], -q[1], -q[2], -q[3]]
    // 2 * cross(conj.xyz, v)
    const tx = 2 * (conj[2] * dz - conj[3] * dy)
    const ty = 2 * (conj[3] * dx - conj[1] * dz)
    const tz = 2 * (conj[1] * dy - conj[2] * dx)
    const bx = dx + conj[0] * tx + (conj[2] * tz - conj[3] * ty)
    const by = dy + conj[0] * ty + (conj[3] * tx - conj[1] * tz)
    if (bx <= 0) return false   // behind us
    const azDeg = Math.atan2(by, bx) * (180 / Math.PI)
    return Math.abs(azDeg - this.state.azimuthDeg) < 4   // 4° beam width — wider than standard
  }

  private upsertGroundTrack(gt: GroundTarget): void {
    const existing = this.trackById.get(gt.entityId)
    if (existing) {
      syncTrackKinematics(existing, gt.state.positionNED, gt.state.velocityNED)
      existing.lastUpdateSec = this.time
      existing.confidence = 1.0
    } else if (this.state.tracks.length < 8) {
      const track: RadarTrack = {
        entityId: gt.entityId,
        positionNED: cloneVec3(gt.state.positionNED),
        velocityNED: cloneVec3(gt.state.velocityNED),
        rcsM2: gt.spec.rcsM2,
        lastUpdateSec: this.time,
        confidence: 1.0,
        isSTT: false,
      }
      this.state.tracks.push(track)
      this.trackById.set(gt.entityId, track)
    }
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
