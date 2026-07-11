import type { MissileState } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import { v3dist } from '../utils/MathUtils'

export function checkProximityFuse(missile: MissileState, targetState: AircraftState): boolean {
  const dist = v3dist(missile.positionNED, targetState.positionNED)
  const gate = missile.spec.proxFuseRadiusM

  if (dist <= gate) return true

  const prev = missile.prevMissDistanceM
  missile.prevMissDistanceM = dist

  // Closest-approach: detonate when miss distance starts increasing inside the fuse gate.
  if (prev !== null && dist > prev && prev <= gate) return true

  return false
}

export function computeLethality(
  detonationPos: import('../types/common').Vec3,
  targetPos: import('../types/common').Vec3,
  lethalRadiusM: number
): number {
  const dist = v3dist(detonationPos, targetPos)
  if (dist <= lethalRadiusM) return 1.0
  if (dist > lethalRadiusM * 3) return 0
  return Math.max(0, 1 - (dist - lethalRadiusM) / (lethalRadiusM * 2))
}

export function hitZoneFromMissileApproach(
  missileVelNED: import('../types/common').Vec3,
  targetQuat: import('../types/common').Quat
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
