import type { Vec3 } from '../../types/common'

/**
 * Pure geometry helpers shared by the HUD target-designator box, the radar
 * scope, and their unit tests. Everything here is frame-agnostic NED math with
 * no canvas / three.js dependency so it can be exercised in isolation.
 */

export interface RelativeKinematics {
  /** Slant range own→target (m). */
  rangeM: number
  /** Closure rate (m/s). Positive = closing, negative = opening. */
  closureMps: number
  /**
   * Aspect angle (deg): the angle measured at the target between its tail and
   * the line of sight to us. 0° = we sit on the target's 6 o'clock, 180° =
   * head-on / we are on the target's nose.
   */
  aspectDeg: number
  /** Which side of the target's tail we are on. '' when aspect ≈ 0 or 180. */
  aspectSide: 'L' | 'R' | ''
  /** Target altitude minus own altitude (m). Positive = target is higher. */
  altDeltaM: number
  /** Target speed over ground (m/s). */
  targetSpeedMps: number
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function len(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2])
}

export function computeRelativeKinematics(
  ownPos: Vec3,
  ownVel: Vec3,
  tgtPos: Vec3,
  tgtVel: Vec3,
): RelativeKinematics {
  const rel: Vec3 = [tgtPos[0] - ownPos[0], tgtPos[1] - ownPos[1], tgtPos[2] - ownPos[2]]
  const relVel: Vec3 = [tgtVel[0] - ownVel[0], tgtVel[1] - ownVel[1], tgtVel[2] - ownVel[2]]
  const rangeM = len(rel)

  const closureMps = rangeM > 1e-3 ? -dot(rel, relVel) / rangeM : 0

  const tgtSpeed = len(tgtVel)
  let aspectDeg = 0
  let aspectSide: 'L' | 'R' | '' = ''
  if (rangeM > 1e-3 && tgtSpeed > 1) {
    // LOS from the target back to us.
    const losFromTgt: Vec3 = [-rel[0] / rangeM, -rel[1] / rangeM, -rel[2] / rangeM]
    const heading: Vec3 = [tgtVel[0] / tgtSpeed, tgtVel[1] / tgtSpeed, tgtVel[2] / tgtSpeed]
    // Aspect is measured off the tail, i.e. off the reversed heading.
    const cosA = clampUnit(dot(losFromTgt, [-heading[0], -heading[1], -heading[2]]))
    aspectDeg = Math.acos(cosA) * (180 / Math.PI)

    // Left / right of the target's tail: sign of (heading × LOS)·down, using the
    // horizontal components so a climbing/diving target doesn't flip the side.
    const hx = heading[0], hy = heading[1]
    const lx = losFromTgt[0], ly = losFromTgt[1]
    const cross = hx * ly - hy * lx
    if (aspectDeg > 3 && aspectDeg < 177) aspectSide = cross > 0 ? 'R' : 'L'
  }

  return {
    rangeM,
    closureMps,
    aspectDeg,
    aspectSide,
    altDeltaM: -tgtPos[2] - -ownPos[2],
    targetSpeedMps: tgtSpeed,
  }
}

function clampUnit(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v
}

// ── Shoot-cue state machine ──────────────────────────────────────────────────

export type ShootCue = 'NONE' | 'IN_RNG' | 'SHOOT' | 'SHOOT_NEZ' | 'TOO_CLOSE'

export interface ShootCueLAR {
  rangeM: number
  rMinM: number
  rMaxM: number
  inRange: boolean
  inNoEscapeZone: boolean
}

export interface ShootCueInputs {
  hasMissileSelected: boolean
  lar: ShootCueLAR | null
  /** Off-boresight angle of the launch solution (deg), or null if unavailable. */
  offBoresightDeg: number | null
  /** Seeker / datalink hard gimbal limit for the selected missile (deg). */
  seekerLimitDeg: number
}

/**
 * Resolve the staged air-to-air shoot cue. Pure so each boundary can be tested.
 *
 * - NONE       — no missile, no LAR, or target outside Rmax
 * - TOO_CLOSE  — inside Rmin (minimum arming / turn radius)
 * - IN_RNG     — within launch envelope but launch geometry is poor
 * - SHOOT      — within envelope and inside the seeker cone
 * - SHOOT_NEZ  — as SHOOT and inside the no-escape zone (caller flashes it)
 */
export function resolveShootCue(inp: ShootCueInputs): ShootCue {
  const { lar } = inp
  if (!inp.hasMissileSelected || !lar) return 'NONE'
  if (lar.rangeM < lar.rMinM) return 'TOO_CLOSE'
  if (lar.rangeM > lar.rMaxM) return 'NONE'

  const geometryGood =
    inp.offBoresightDeg !== null && inp.offBoresightDeg <= inp.seekerLimitDeg
  if (!geometryGood) return 'IN_RNG'
  return lar.inNoEscapeZone ? 'SHOOT_NEZ' : 'SHOOT'
}

/** True for the cue states that mean "a valid launch solution exists". */
export function isShootCue(cue: ShootCue): boolean {
  return cue === 'SHOOT' || cue === 'SHOOT_NEZ'
}

/** Format an aspect readout like `120L` / `075R` / `000`. */
export function formatAspect(k: RelativeKinematics): string {
  const deg = Math.round(k.aspectDeg).toString().padStart(3, '0')
  return `${deg}${k.aspectSide}`
}
