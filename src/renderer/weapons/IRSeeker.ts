import type { IRSeekerSpec } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import type { AircraftSpec } from '../types/aircraft'
import type { Vec3 } from '../types/common'
import { v3norm, v3dot, RAD2DEG } from '../utils/MathUtils'

export function computeHeatSignatureKW(
  spec: AircraftSpec,
  state: AircraftState,
  seekerToTargetNED: Vec3
): number {
  const dir = v3norm(seekerToTargetNED)
  // tail-on: seeker sees nozzle
  const bodyForwardNED = [
    2*state.attitudeQuat[0]*state.attitudeQuat[1],
    state.attitudeQuat[0]**2 - state.attitudeQuat[1]**2,
    0
  ] as Vec3 // approximate

  // Aspect: dot of missile-to-target with target's forward
  const forward = [state.attitudeQuat[0], state.attitudeQuat[1], state.attitudeQuat[2]] as Vec3
  const aspect = v3dot(dir, forward)   // 1=head-on, -1=tail-on

  // Tail-on has highest signature
  const aspectFactor = 1.0 + Math.max(0, -aspect) * 3.0
  return spec.heatSignatureBaseKW * aspectFactor * (0.5 + state.throttle * 0.5)
}

export function angleBetweenVecsRad(a: Vec3, b: Vec3): number {
  const dot = v3dot(v3norm(a), v3norm(b))
  return Math.acos(Math.max(-1, Math.min(1, dot)))
}

export function canSeekerLock(
  seekerSpec: IRSeekerSpec,
  heatKW: number,
  offsetFromBoresightDeg: number
): boolean {
  return offsetFromBoresightDeg <= seekerSpec.gimbalLimitDeg &&
         heatKW >= seekerSpec.minHeatSignatureKW
}

export function evaluateFlareSeduction(
  seekerSpec: IRSeekerSpec,
  targetHeatKW: number,
  flareHeatKW: number
): boolean {
  if (flareHeatKW < targetHeatKW * 1.5) return false
  const susceptibility = 1 - seekerSpec.flareRejectionCapability
  return Math.random() < susceptibility
}

export interface ScoredFlare {
  positionNED: [number, number, number]
  velocityNED?: [number, number, number]
  heatSignatureKW: number
  ageSec: number
}

/**
 * Select the flare a seeker would most fixate on.
 * Scores each candidate by perceived irradiance (heatKW / dist²) after confirming
 * it falls within the seeker's gimbal cone from the missile boresight.
 * Separating scoring from the binary seduction roll lets pulling a hot flare
 * into the FOV matter independently of the random susceptibility check.
 */
export function selectBestFlare(
  missilePos: Vec3,
  missileVelUnit: Vec3,
  seekerGimbalDeg: number,
  flares: ReadonlyArray<ScoredFlare>,
): ScoredFlare | null {
  let best: ScoredFlare | null = null
  let bestScore = 0

  for (const flare of flares) {
    if (flare.heatSignatureKW <= 0) continue
    const dx = flare.positionNED[0] - missilePos[0]
    const dy = flare.positionNED[1] - missilePos[1]
    const dz = flare.positionNED[2] - missilePos[2]
    const dist2 = dx * dx + dy * dy + dz * dz
    if (dist2 < 1) continue

    const dist = Math.sqrt(dist2)
    const flareDir = [dx / dist, dy / dist, dz / dist] as Vec3
    const cosAngle = v3dot(missileVelUnit, flareDir)
    const offBoresightDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * RAD2DEG
    if (offBoresightDeg > seekerGimbalDeg) continue

    // Perceived irradiance falls off with inverse square of range
    const score = flare.heatSignatureKW / dist2
    if (score > bestScore) { bestScore = score; best = flare }
  }

  return best
}
