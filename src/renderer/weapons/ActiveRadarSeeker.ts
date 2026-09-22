import type { ActiveRadarSeekerSpec } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import type { AircraftSpec } from '../types/aircraft'
import { v3dist, v3sub, v3norm, v3dot, quatRotateVec } from '../utils/MathUtils'

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

/**
 * Aspect-dependent RCS from the 8-point table (0° = head-on).
 *
 * Aspect is measured against where the target is actually pointing. The forward
 * vector used to be hardcoded to world north, which made the whole 8-point table
 * a function of the missile's position rather than the target's orientation —
 * every heading returned the same number, so turning to present a smaller aspect
 * did nothing and the per-airframe RCS tables were dead data.
 */
export function targetRcsM2(spec: AircraftSpec, missilePos: import('../types/common').Vec3, targetState: AircraftState): number {
  // Missile → target, so a target flying straight at the seeker reads 0° (head-on).
  const los = v3norm(v3sub(targetState.positionNED, missilePos))
  const fwd = quatRotateVec(targetState.attitudeQuat, [1, 0, 0])
  const dot = Math.max(-1, Math.min(1, -v3dot(los, fwd)))
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
 * How much of the target's own velocity lies along the seeker's line of sight.
 *
 * This is the quantity a pulse-Doppler seeker filters on, and it is what the
 * beam ("notch") manoeuvre drives to zero: fly perpendicular to the missile and
 * your return shifts into the ground-clutter bin.
 *
 * It deliberately excludes the missile's own velocity. Closure between missile
 * and target is ~1000 m/s in any live engagement and swamps everything else —
 * measuring that instead meant a *perfectly* beaming target still read 370 m/s,
 * so the notch gate below could never once trigger and beaming did nothing.
 */
export function targetRadialSpeedMS(
  missilePos: import('../types/common').Vec3,
  targetState: AircraftState,
): number {
  const los = v3norm(v3sub(targetState.positionNED, missilePos))
  return v3dot(targetState.velocityNED, los)
}

/**
 * Doppler notch: the seeker loses the target when its radial velocity falls
 * into the clutter notch (beam aspect).
 *
 * At a 250 m/s cruise the default width is roughly a ±11° window around pure
 * beam — deliberate to hold, but holdable.
 */
export function isInDopplerNotch(
  missilePos: import('../types/common').Vec3,
  targetState: AircraftState,
  notchWidthMS = 50,
): boolean {
  return Math.abs(targetRadialSpeedMS(missilePos, targetState)) < notchWidthMS
}

export function checkARHLock(
  seeker: ActiveRadarSeekerSpec,
  missilePos: import('../types/common').Vec3,
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

  if (isInDopplerNotch(missilePos, targetState)) return false

  const rcs = targetRcsM2(targetSpec, missilePos, targetState)
  const snr = computeSeekerSNR(seeker, dist, rcs)
  const snrThreshold = seeker.snrThreshold ?? 8
  return snr >= snrThreshold
}
