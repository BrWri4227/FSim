import type { Vec3 } from './common'

export type GroundCategory = 'SAM_SITE' | 'ARMOR' | 'SHIP' | 'STRUCTURE'

export interface GroundTargetSpec {
  id: string
  displayName: string
  category: GroundCategory
  hpMax: number
  /** Effective omni RCS (m²) for ground radar / GMTI. */
  rcsM2: number
  /** Steady-state IR signature (kW). */
  irSignatureKW: number
  /** Cruise speed (m/s). 0 for static targets. */
  speedMS: number
  /** Visual placeholder mesh size. */
  meshSize: { lengthM: number; widthM: number; heightM: number }
  /** Hex color for placeholder mesh. */
  meshColor: number
  /** SAM-only: detection range against fighter-class RCS (m). */
  samDetectionRangeM?: number
  /** SAM-only: missile catalog id used by the launcher. */
  samMissileId?: string
  /** SAM-only: max engagement range (m). */
  samEngagementRangeM?: number
  /** SAM-only: salvo cooldown (sec). */
  samReloadSec?: number
}

/** Live per-instance ground target state. */
export interface GroundTargetState {
  positionNED: Vec3
  velocityNED: Vec3
  /** Attitude is identity-quaternion for ground targets; provided so that the
   *  damage / collision plumbing that expects an `attitudeQuat` field works. */
  attitudeQuat: [number, number, number, number]
  /** Yaw / heading in degrees, used for ship motion and mesh orientation. */
  headingDeg: number
  hp: number
  invincible: boolean
  destroyed: boolean
}
