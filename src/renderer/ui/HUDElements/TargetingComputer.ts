import type { Vec3, Quat } from '../../types/common'
import type { MissileSpec, MissileState, LoadedStore } from '../../types/weapons'
import { computeAtmosphere } from '../../physics/Atmosphere'
import { quatRotateVec, v3len, clamp, lerp, RAD2DEG } from '../../utils/MathUtils'
import { MISSILE_SPECS } from '../../data/weapons/catalog'

/**
 * Render-free air-to-air targeting math shared by the 2D HUD overlay and the
 * world-projected glass-HUD combiner. Every function takes explicit kinematics
 * so it stays unit-testable.
 */

const G0 = 9.80665
const MIN_INTERCEPT_TIME_S = 0.05
const MAX_INTERCEPT_TIME_S = 5

export interface OwnState {
  positionNED: Vec3
  velocityNED: Vec3
  attitudeQuat: Quat
}

export interface TargetState {
  positionNED: Vec3
  velocityNED: Vec3
}

export interface LARInfo {
  rangeM: number
  rMinM: number
  rNeM: number
  rMaxM: number
  inRange: boolean
  inNoEscapeZone: boolean
}

export interface MissileLeadSolution {
  interceptTimeSec: number
  aimPointNED: Vec3
  offBoresightDeg: number
  targetRangeM: number
}

function relPos(own: OwnState, tgt: TargetState): Vec3 {
  return [
    tgt.positionNED[0] - own.positionNED[0],
    tgt.positionNED[1] - own.positionNED[1],
    tgt.positionNED[2] - own.positionNED[2],
  ]
}

function relVel(own: OwnState, tgt: TargetState): Vec3 {
  return [
    tgt.velocityNED[0] - own.velocityNED[0],
    tgt.velocityNED[1] - own.velocityNED[1],
    tgt.velocityNED[2] - own.velocityNED[2],
  ]
}

/** The loaded A/A missile store matching the current weapon selection, if any. */
export function selectedAAMissileStore(
  stores: readonly LoadedStore[],
  selectedWeapon: string,
): LoadedStore | null {
  const sel = selectedWeapon.toLowerCase()
  return stores.find(s =>
    s.weaponId === sel &&
    (s.category === 'IR_MISSILE' || s.category === 'ARH_MISSILE') &&
    s.remainingRounds > 0,
  ) ?? null
}

/** Missile spec for the current A/A selection, or null (gun / bombs / empty). */
export function selectedAAMissileSpec(
  stores: readonly LoadedStore[],
  selectedWeapon: string,
): MissileSpec | null {
  const store = selectedAAMissileStore(stores, selectedWeapon)
  return store ? MISSILE_SPECS[store.weaponId] ?? null : null
}

/** Dynamic launch envelope (Rmin / Rne / Rmax) for a missile vs a target. */
export function computeLARInfo(spec: MissileSpec, own: OwnState, tgt: TargetState): LARInfo | null {
  const rp = relPos(own, tgt)
  const rv = relVel(own, tgt)
  const rangeM = Math.hypot(rp[0], rp[1], rp[2])
  if (!Number.isFinite(rangeM) || rangeM < 1) return null

  const rangeRate = (rp[0] * rv[0] + rp[1] * rv[1] + rp[2] * rv[2]) / rangeM
  const closingMS = -rangeRate
  const ownAltM = Math.max(0, -own.positionNED[2])
  const altFactor = clamp(0.8 + ownAltM / 50000, 0.8, 1.2)
  const closureFactor = clamp(0.55 + (closingMS + 120) / 520, 0.45, 1.15)

  let rMaxM = spec.maxRangeM * altFactor * closureFactor
  let rMinM = spec.category === 'ARH_MISSILE' ? 1800 : 500
  rMinM += Math.max(0, -closingMS) * 5
  rMinM = clamp(rMinM, 300, spec.maxRangeM * 0.5)
  rMaxM = Math.max(rMinM + 1000, rMaxM)

  const nezSpan = spec.category === 'ARH_MISSILE' ? 0.62 : 0.52
  const rNeM = clamp(rMinM + (rMaxM - rMinM) * nezSpan, rMinM + 300, rMaxM - 250)
  return {
    rangeM,
    rMinM,
    rNeM,
    rMaxM,
    inRange: rangeM >= rMinM && rangeM <= rMaxM,
    inNoEscapeZone: rangeM >= rMinM && rangeM <= rNeM,
  }
}

export function getMissileSeekerLimitDeg(spec: MissileSpec): number {
  if (spec.category === 'IR_MISSILE') return spec.irSeeker?.gimbalLimitDeg ?? 30
  return 30
}

export function computeMissileOptimalLaunchAngleDeg(spec: MissileSpec, rangeM: number): number {
  const rangeNorm = clamp(rangeM / Math.max(1000, spec.maxRangeM), 0, 1)
  const closeInFraction = 0.62
  const longRangeFraction = 0.24
  const baseLimit = getMissileSeekerLimitDeg(spec)
  const optimalFraction = lerp(closeInFraction, longRangeFraction, rangeNorm)
  return clamp(baseLimit * optimalFraction, 4, Math.max(8, baseLimit * 0.85))
}

/** Closed-form projectile intercept time; falls back to straight-line ToF. */
export function solveInterceptTime(rp: Vec3, rv: Vec3, projectileSpeedMS: number): number | null {
  const rDotV = rp[0] * rv[0] + rp[1] * rv[1] + rp[2] * rv[2]
  const rDotR = rp[0] * rp[0] + rp[1] * rp[1] + rp[2] * rp[2]
  const vDotV = rv[0] * rv[0] + rv[1] * rv[1] + rv[2] * rv[2]
  const speed2 = projectileSpeedMS * projectileSpeedMS

  const a = vDotV - speed2
  const b = 2 * rDotV
  const c = rDotR
  const eps = 1e-6

  let t: number | null = null
  if (Math.abs(a) < eps) {
    if (Math.abs(b) > eps) {
      const linearT = -c / b
      if (linearT > 0) t = linearT
    }
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const root = Math.sqrt(disc)
      const t1 = (-b - root) / (2 * a)
      const t2 = (-b + root) / (2 * a)
      const candidates = [t1, t2].filter(x => x > 0)
      if (candidates.length > 0) t = Math.min(...candidates)
    }
  }

  if (t === null) {
    const rangeM = Math.sqrt(rDotR)
    if (projectileSpeedMS > eps) t = rangeM / projectileSpeedMS
  }
  if (t === null) return null
  return clamp(t, MIN_INTERCEPT_TIME_S, MAX_INTERCEPT_TIME_S)
}

/** Gun lead point (lead + gravity drop) for the funnel pipper. */
export function computeGunLeadPointNED(
  own: OwnState,
  tgt: TargetState,
  muzzleVelocityMS: number,
): { aimPointNED: Vec3; interceptTimeSec: number } | null {
  const rp = relPos(own, tgt)
  const rv = relVel(own, tgt)
  const t = solveInterceptTime(rp, rv, muzzleVelocityMS)
  if (!t) return null
  return {
    interceptTimeSec: t,
    aimPointNED: [
      tgt.positionNED[0] + tgt.velocityNED[0] * t,
      tgt.positionNED[1] + tgt.velocityNED[1] * t,
      tgt.positionNED[2] + tgt.velocityNED[2] * t - 0.5 * G0 * t * t,
    ],
  }
}

/** Iterated missile time-of-flight lead solution + off-boresight of the shot. */
export function computeMissileLeadSolution(
  spec: MissileSpec,
  own: OwnState,
  tgt: TargetState,
): MissileLeadSolution | null {
  const ownPos = own.positionNED
  const ownVel = own.velocityNED
  const tgtPos = tgt.positionNED
  const tgtVel = tgt.velocityNED

  const rp = relPos(own, tgt)
  const rangeM = Math.hypot(rp[0], rp[1], rp[2])
  if (!Number.isFinite(rangeM) || rangeM < 25) return null

  const ownSpeed = v3len(ownVel)
  const altM = Math.max(0, -ownPos[2])
  const speedOfSoundMS = computeAtmosphere(altM, ownSpeed).speedOfSoundMS
  const maxSpeedMS = Math.max(300, spec.maxSpeedMach * speedOfSoundMS)
  const accelMS2 = spec.maxThrustN / Math.max(1, spec.massKg)

  let t = clamp(rangeM / Math.max(1, ownSpeed + 350), 0.2, 25)
  for (let i = 0; i < 6; i++) {
    const predPos: Vec3 = [
      tgtPos[0] + tgtVel[0] * t,
      tgtPos[1] + tgtVel[1] * t,
      tgtPos[2] + tgtVel[2] * t,
    ]
    const dist = Math.hypot(predPos[0] - ownPos[0], predPos[1] - ownPos[1], predPos[2] - ownPos[2])
    const boostTime = Math.min(t, spec.burnTimeSec)
    const coastTime = Math.max(0, t - boostTime)
    const boostEndSpeed = Math.min(maxSpeedMS, ownSpeed + accelMS2 * boostTime * 0.7)
    const avgBoostSpeed = 0.5 * (ownSpeed + boostEndSpeed)
    const avgCoastSpeed = Math.max(ownSpeed + 120, boostEndSpeed * 0.72)
    const coveredDist = avgBoostSpeed * boostTime + avgCoastSpeed * coastTime
    if (coveredDist < 1) break
    t *= dist / coveredDist
    t = clamp(t, 0.2, 25)
  }

  const aimPointNED: Vec3 = [
    tgtPos[0] + tgtVel[0] * t,
    tgtPos[1] + tgtVel[1] * t,
    tgtPos[2] + tgtVel[2] * t,
  ]

  const bore = quatRotateVec(own.attitudeQuat, [1, 0, 0])
  const los: Vec3 = [aimPointNED[0] - ownPos[0], aimPointNED[1] - ownPos[1], aimPointNED[2] - ownPos[2]]
  const losLen = Math.hypot(los[0], los[1], los[2])
  if (losLen < 1e-3) return null
  const boreLen = Math.max(1e-6, v3len(bore))
  const dot = clamp(
    (bore[0] * los[0] + bore[1] * los[1] + bore[2] * los[2]) / (losLen * boreLen),
    -1, 1,
  )

  return {
    interceptTimeSec: t,
    aimPointNED,
    offBoresightDeg: Math.acos(dot) * RAD2DEG,
    targetRangeM: rangeM,
  }
}

/** Straight-line time-to-impact estimate for an in-flight missile. */
export function estimateMissileTTI(
  missile: MissileState,
  targetPos: readonly [number, number, number],
  targetVel: readonly [number, number, number],
): number | null {
  const rp: Vec3 = [
    targetPos[0] - missile.positionNED[0],
    targetPos[1] - missile.positionNED[1],
    targetPos[2] - missile.positionNED[2],
  ]
  const rv: Vec3 = [
    targetVel[0] - missile.velocityNED[0],
    targetVel[1] - missile.velocityNED[1],
    targetVel[2] - missile.velocityNED[2],
  ]
  const rangeM = Math.hypot(rp[0], rp[1], rp[2])
  if (rangeM < 1) return 0

  const rangeRate = (rp[0] * rv[0] + rp[1] * rv[1] + rp[2] * rv[2]) / rangeM
  const closingMS = -rangeRate
  if (closingMS > 5) return rangeM / closingMS

  const missileSpeed = Math.hypot(missile.velocityNED[0], missile.velocityNED[1], missile.velocityNED[2])
  if (missileSpeed > 10) return rangeM / missileSpeed
  return null
}

export interface MissileTTIEntry {
  missile: MissileState
  pitbull: boolean
  timeToImpactSec: number | null
}

/** Own in-flight missiles sorted soonest-impact-first, with pitbull flag + TTI. */
export function collectMissileTTI(
  missiles: readonly MissileState[],
  findTarget: (entityId: string) => TargetState | null,
): MissileTTIEntry[] {
  const entries: MissileTTIEntry[] = missiles
    .filter(m => m.active)
    .map(missile => {
      const target = findTarget(missile.targetEntityId)
      const targetPos = target?.positionNED ?? missile.lastKnownTargetPos
      const targetVel = target?.velocityNED ?? missile.lastKnownTargetVel
      return {
        missile,
        pitbull: missile.spec.category === 'ARH_MISSILE' && missile.guidanceMode === 'ACTIVE',
        timeToImpactSec: estimateMissileTTI(missile, targetPos, targetVel),
      }
    })

  entries.sort((a, b) => {
    if (a.timeToImpactSec === null) return b.timeToImpactSec === null ? 0 : 1
    if (b.timeToImpactSec === null) return -1
    return a.timeToImpactSec - b.timeToImpactSec
  })
  return entries
}
