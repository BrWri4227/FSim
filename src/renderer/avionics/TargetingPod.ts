import type { Vec3 } from '../types/common'
import type { GroundTarget } from '../entities/GroundTarget'
import { quatRotateVec, RAD2DEG } from '../utils/MathUtils'

export interface TargetingPodState {
  /** Pod power state. */
  active: boolean
  /** Body-relative azimuth (deg, +right). */
  gimbalAzDeg: number
  /** Body-relative depression (deg, +down). Pod points below the aircraft when slewing forward to a ground point. */
  gimbalElDeg: number
  /** Currently locked ground entity, if any. */
  lockedEntityId: string | null
  /** Designated ground point in NED (used by LGB guidance). */
  designatedNED: Vec3 | null
  /** True if the pod has a stable track on the locked target. */
  tracking: boolean
}

const MAX_AZ_DEG = 150     // ±150° from nose
const MAX_EL_DEG = 90      // 0..-90° below horizon (we store positive depression)
const SLEW_RATE_DEG_S = 60 // pod gimbal slew rate while operator is slewing

export class TargetingPod {
  state: TargetingPodState = {
    active: false,
    gimbalAzDeg: 0,
    gimbalElDeg: 30,    // start looking 30° down by default
    lockedEntityId: null,
    designatedNED: null,
    tracking: false,
  }

  toggle(): void {
    this.state.active = !this.state.active
    if (!this.state.active) {
      this.state.lockedEntityId = null
      this.state.designatedNED = null
      this.state.tracking = false
    }
  }

  /** Slew gimbal — values in [-1, 1]. */
  slew(dx: number, dy: number, dt: number): void {
    if (!this.state.active || this.state.lockedEntityId) return
    this.state.gimbalAzDeg = clampAz(this.state.gimbalAzDeg + dx * SLEW_RATE_DEG_S * dt)
    this.state.gimbalElDeg = clampEl(this.state.gimbalElDeg + dy * SLEW_RATE_DEG_S * dt)
  }

  /**
   * Auto-lock the closest ground target whose center is within `coneDeg` of the
   * pod boresight. Returns the locked target if any.
   */
  lockClosest(
    ownPositionNED: Vec3,
    ownAttitudeQuat: [number, number, number, number],
    groundTargets: GroundTarget[],
    coneDeg = 5,
  ): GroundTarget | null {
    if (!this.state.active) return null
    const boresightBody: Vec3 = bodyVecFromGimbal(this.state.gimbalAzDeg, this.state.gimbalElDeg)
    const boresightNED = quatRotateVec(ownAttitudeQuat, boresightBody)

    let best: GroundTarget | null = null
    let bestCos = Math.cos(coneDeg * Math.PI / 180)
    for (const gt of groundTargets) {
      if (gt.state.destroyed) continue
      const dx = gt.state.positionNED[0] - ownPositionNED[0]
      const dy = gt.state.positionNED[1] - ownPositionNED[1]
      const dz = gt.state.positionNED[2] - ownPositionNED[2]
      const d = Math.hypot(dx, dy, dz)
      if (d < 1) continue
      const cos = (dx * boresightNED[0] + dy * boresightNED[1] + dz * boresightNED[2]) / d
      if (cos > bestCos) { bestCos = cos; best = gt }
    }
    if (best) {
      this.state.lockedEntityId = best.entityId
      this.state.designatedNED = [...best.state.positionNED] as Vec3
      this.state.tracking = true
    }
    return best
  }

  unlock(): void {
    this.state.lockedEntityId = null
    this.state.designatedNED = null
    this.state.tracking = false
  }

  /** Each tick: keep gimbal pointed at the locked target's actual position. */
  update(
    ownPositionNED: Vec3,
    ownAttitudeQuat: [number, number, number, number],
    groundTargets: GroundTarget[],
  ): void {
    if (!this.state.active || !this.state.lockedEntityId) return
    const tgt = groundTargets.find(g => g.entityId === this.state.lockedEntityId)
    if (!tgt || tgt.state.destroyed) {
      this.unlock()
      return
    }
    const dx = tgt.state.positionNED[0] - ownPositionNED[0]
    const dy = tgt.state.positionNED[1] - ownPositionNED[1]
    const dz = tgt.state.positionNED[2] - ownPositionNED[2]
    // World→body
    const conjQ: [number, number, number, number] = [ownAttitudeQuat[0], -ownAttitudeQuat[1], -ownAttitudeQuat[2], -ownAttitudeQuat[3]]
    const bodyVec = quatRotateVec(conjQ, [dx, dy, dz])
    const az = Math.atan2(bodyVec[1], bodyVec[0]) * RAD2DEG
    const el = Math.atan2(bodyVec[2], Math.hypot(bodyVec[0], bodyVec[1])) * RAD2DEG
    this.state.gimbalAzDeg = clampAz(az)
    this.state.gimbalElDeg = clampEl(el)
    this.state.designatedNED = [...tgt.state.positionNED] as Vec3
    this.state.tracking = true
  }
}

function clampAz(a: number): number {
  return Math.max(-MAX_AZ_DEG, Math.min(MAX_AZ_DEG, a))
}

function clampEl(e: number): number {
  return Math.max(-10, Math.min(MAX_EL_DEG, e))
}

/** Convert pod gimbal angles to a unit body-frame vector pointing at the look-at point. */
function bodyVecFromGimbal(azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * Math.PI / 180
  const el = elDeg * Math.PI / 180
  // Body +x = nose, +y = right, +z = down. Az rotates +x toward +y; el tilts toward +z.
  const ce = Math.cos(el), se = Math.sin(el)
  return [Math.cos(az) * ce, Math.sin(az) * ce, se]
}
