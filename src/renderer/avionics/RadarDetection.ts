import type { AircraftSpec, AircraftState } from '../types/aircraft'
import type { RadarState } from '../types/radar'
import { v3sub, v3norm, v3dot, DEG2RAD } from '../utils/MathUtils'
import { quatRotateVec, quatConjugate } from '../utils/MathUtils'

// Blake radar range equation (simplified)
// R_max = ( P_t * G^2 * lambda^2 * sigma / ((4*pi)^3 * P_min * L) )^(1/4)
export function computeDetectionRange(spec: AircraftSpec, targetRcsM2: number): number {
  // Approximate radar parameters from aircraft type
  const Pt   = spec.nation === 'USA' ? 12000 : 10000  // Watts
  const G    = 2000  // linear gain
  const freq = 10e9  // Hz
  const c    = 3e8
  const lambda = c / freq
  const Pmin = 1e-12  // minimum detectable signal
  const L    = 6      // system losses (linear)

  const numerator = Pt * G * G * lambda * lambda * targetRcsM2
  const denominator = Math.pow(4 * Math.PI, 3) * Pmin * L
  return Math.pow(numerator / denominator, 0.25)
}

export function isInScanBeam(
  radarState: RadarState,
  ownState: AircraftState,
  targetState: AircraftState
): boolean {
  const toTarget = v3sub(targetState.positionNED, ownState.positionNED)
  const toTargetBody = quatRotateVec(quatConjugate(ownState.attitudeQuat), toTarget)

  // Az/el of target in body frame
  const range = Math.sqrt(toTargetBody[0]**2 + toTargetBody[1]**2 + toTargetBody[2]**2)
  if (range < 1) return false
  const azDeg = Math.atan2(toTargetBody[1], toTargetBody[0]) * (180/Math.PI)
  const elDeg = Math.asin(-toTargetBody[2] / range) * (180/Math.PI)

  const beamWidthDeg = 3  // beam azimuth width
  const azInBeam = Math.abs(azDeg - radarState.azimuthDeg) < beamWidthDeg
  const elInBeam = Math.abs(elDeg - radarState.elevationBarDeg) < 4  // 4° elevation coverage

  return azInBeam && elInBeam
}
