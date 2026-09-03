import type { MissileState } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import { v3sub, v3dot, v3len, clamp } from '../utils/MathUtils'

export interface ProximityFuseResult {
  detonate: boolean
  /** Closest relative approach distance (m) reached during this tick. */
  missDistanceM: number
}

/**
 * Swept closest-approach proximity fuse.
 *
 * A same-tick point test misses high-closure shots: at ~1200 m/s closure the
 * missile can travel ~20 m in a single 1/60 s tick, stepping clean past a
 * 9-12 m fuse gate. Instead, treat missile and target as moving in straight
 * lines for the duration of the tick and solve for the time of closest
 * relative approach, clamped to [0, dt].
 */
export function checkProximityFuse(
  missile: MissileState,
  targetState: AircraftState,
  dt: number
): ProximityFuseResult {
  const gate = missile.spec.proxFuseRadiusM
  const rel = v3sub(targetState.positionNED, missile.positionNED)
  const relV = v3sub(targetState.velocityNED, missile.velocityNED)
  const relV2 = v3dot(relV, relV)
  const t = clamp(relV2 > 1e-6 ? -v3dot(rel, relV) / relV2 : 0, 0, dt)
  const closest: import('../types/common').Vec3 = [
    rel[0] + relV[0] * t,
    rel[1] + relV[1] * t,
    rel[2] + relV[2] * t,
  ]
  const missDistanceM = v3len(closest)
  return { detonate: missDistanceM <= gate, missDistanceM }
}

export function computeLethality(missDistanceM: number, lethalRadiusM: number): number {
  if (missDistanceM <= lethalRadiusM) return 1.0
  if (missDistanceM > lethalRadiusM * 3) return 0
  return Math.max(0, 1 - (missDistanceM - lethalRadiusM) / (lethalRadiusM * 2))
}

export function hitZoneFromMissileApproach(
  missileVelNED: import('../types/common').Vec3,
  _targetQuat: import('../types/common').Quat
): import('../types/damage').DamageZone {
  // Simplified: determine hit zone by approach vector
  // Head-on → FUSELAGE, from below → ENGINE, etc.
  const v = missileVelNED
  const spd = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2)
  if (spd < 1) return 'FUSELAGE'

  // If approaching mostly from below (positive NED z = downward, so z < 0 means from above)
  if (v[2] < -spd * 0.5) return 'ENGINE'
  if (Math.abs(v[1]) > spd * 0.4) return Math.random() < 0.5 ? 'WING_LEFT' : 'WING_RIGHT'
  return 'FUSELAGE'
}
