import type { ActiveRadarSeekerSpec } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import { v3dist, v3sub, v3norm, v3dot } from '../utils/MathUtils'

export function isTargetInSeekerCone(
  missilePos: import('../types/common').Vec3,
  missileForward: import('../types/common').Vec3,
  targetPos: import('../types/common').Vec3,
  coneHalfAngleDeg = 45
): boolean {
  const toTarget = v3norm(v3sub(targetPos, missilePos))
  const dot = v3dot(missileForward, toTarget)
  return dot >= Math.cos(coneHalfAngleDeg * Math.PI / 180)
}

export function checkARHLock(
  seeker: ActiveRadarSeekerSpec,
  missilePos: import('../types/common').Vec3,
  missileForward: import('../types/common').Vec3,
  targetState: AircraftState,
  targetRcsM2: number
): boolean {
  const dist = v3dist(missilePos, targetState.positionNED)
  if (dist > 40000) return false
  return isTargetInSeekerCone(missilePos, missileForward, targetState.positionNED)
}
