import type { ActiveRadarSeekerSpec } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import type { AircraftSpec } from '../types/aircraft'
import { v3dist, v3sub, v3norm, v3dot } from '../utils/MathUtils'

const C = 299792458
const BOLTZMANN = 1.38e-23
const RAD2DEG = 180 / Math.PI

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

/** Aspect-dependent RCS from the 8-point table (0° = head-on). */
export function targetRcsM2(spec: AircraftSpec, missilePos: import('../types/common').Vec3, targetState: AircraftState): number {
  const los = v3norm(v3sub(targetState.positionNED, missilePos))
  const fwd: import('../types/common').Vec3 = [1, 0, 0]
  const dot = Math.max(-1, Math.min(1, v3dot(los, fwd)))
  const aspectDeg = Math.acos(dot) * RAD2DEG
  const idx = Math.round(aspectDeg / 45) % 8
  return spec.rcsTableM2[idx] ?? spec.rcsTableM2[0] ?? 5
}

/**
 * Compute received SNR (linear, not dB) using a simplified radar equation.
 */
export function computeSeekerSNR(
  seeker: ActiveRadarSeekerSpec,
  rangeM: number,
  targetRcsM2: number,
): number {
  const lambda = C / (seeker.frequencyGHz * 1e9)
  const gainLin = Math.pow(10, seeker.antennaGainDB / 10)
  const r4 = Math.max(rangeM, 100) ** 4
  const noiseW = BOLTZMANN * 290 * 1e6 * 100  // ~100 MHz BW, 290 K
  const pr = (seeker.peakPowerW * gainLin * gainLin * lambda * lambda * targetRcsM2) /
    ((4 * Math.PI) ** 3 * r4)
  return pr / noiseW
}

/**
 * Doppler notch: seeker loses lock when closing velocity is near zero (beam aspect).
 */
export function isInDopplerNotch(
  missilePos: import('../types/common').Vec3,
  missileVel: import('../types/common').Vec3,
  targetState: AircraftState,
  notchWidthMS = 35,
): boolean {
  const los = v3norm(v3sub(targetState.positionNED, missilePos))
  const relVel: import('../types/common').Vec3 = [
    missileVel[0] - targetState.velocityNED[0],
    missileVel[1] - targetState.velocityNED[1],
    missileVel[2] - targetState.velocityNED[2],
  ]
  const closing = v3dot(relVel, los)
  return Math.abs(closing) < notchWidthMS
}

export function checkARHLock(
  seeker: ActiveRadarSeekerSpec,
  missilePos: import('../types/common').Vec3,
  missileVel: import('../types/common').Vec3,
  missileForward: import('../types/common').Vec3,
  targetState: AircraftState,
  targetSpec: AircraftSpec,
): boolean {
  const dist = v3dist(missilePos, targetState.positionNED)
  if (dist > 40000) return false

  const fovDeg = seeker.fovDeg ?? 45
  if (!isTargetInSeekerCone(missilePos, missileForward, targetState.positionNED, fovDeg)) {
    return false
  }

  if (isInDopplerNotch(missilePos, missileVel, targetState)) return false

  const rcs = targetRcsM2(targetSpec, missilePos, targetState)
  const snr = computeSeekerSNR(seeker, dist, rcs)
  const snrThreshold = seeker.snrThreshold ?? 8
  return snr >= snrThreshold
}
