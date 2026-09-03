import type { Vec3 } from '../types/common'
import { v3len } from '../utils/MathUtils'

/**
 * Shared un-guided-projectile ballistics: quadratic aerodynamic drag plus
 * gravity, integrated with semi-implicit Euler. Both the live gun rounds
 * (GunRound.updateGunRound) and the HUD gun-lead solver use these helpers so the
 * reticle can never disagree with the rounds it is predicting.
 */

const G0 = 9.80665
/** Mid-altitude air density used for gun-round drag (matches the round sim). */
export const GUN_AIR_DENSITY_KGM3 = 1.1

export interface ProjectileBallistics {
  roundMassKg: number
  roundDiameterM: number
  ballisticCd: number
}

/**
 * Drag coefficient `k` for the acceleration law `a_drag = -k * |v| * v`
 * (i.e. |a_drag| = k * |v|^2). Derived from `0.5 * rho * Cd * A / m`.
 */
export function dragCoefficient(b: ProjectileBallistics): number {
  const area = Math.PI * (b.roundDiameterM / 2) ** 2
  return (0.5 * GUN_AIR_DENSITY_KGM3 * b.ballisticCd * area) / Math.max(1e-3, b.roundMassKg)
}

/**
 * One semi-implicit Euler step of a drag + gravity projectile in NED
 * (+z = down). Pure — returns the next state, mutates nothing.
 */
export function stepProjectile(
  positionNED: Vec3,
  velocityNED: Vec3,
  dragK: number,
  dt: number,
): { positionNED: Vec3; velocityNED: Vec3 } {
  const speed = v3len(velocityNED)
  const d = speed > 0 ? -dragK * speed : 0
  const vx = velocityNED[0] + d * velocityNED[0] * dt
  const vy = velocityNED[1] + d * velocityNED[1] * dt
  const vz = velocityNED[2] + (d * velocityNED[2] + G0) * dt
  return {
    velocityNED: [vx, vy, vz],
    positionNED: [
      positionNED[0] + vx * dt,
      positionNED[1] + vy * dt,
      positionNED[2] + vz * dt,
    ],
  }
}

export interface GunLeadInput {
  ownPositionNED: Vec3
  ownVelocityNED: Vec3
  targetPositionNED: Vec3
  targetVelocityNED: Vec3
  muzzleVelocityMS: number
  ballistics: ProjectileBallistics
}

export interface GunLeadSolution {
  /** World point to place the gun cross on so rounds fired now strike the target. */
  aimPointNED: Vec3
  /** Time of flight of the round to the target's future position. */
  timeOfFlightSec: number
  /** Present slant range to the target. */
  slantRangeM: number
  /** Round speed as it reaches the target's range (drag-bled). */
  impactSpeedMS: number
  /** Angle between the present line of sight and the corrected aim direction. */
  leadAngleDeg: number
  converged: boolean
}

const SIM_DT = 1 / 120
const MAX_TOF_S = 6
const MIN_TOF_S = 0.02

/**
 * Drag-aware gun-lead solution. Fixed-point iteration: predict where the target
 * will be after the current time-of-flight guess, march a virtual round toward
 * that point, then steer the aim to null the residual miss and refine the
 * time-of-flight. Converges in a handful of iterations for realistic geometry.
 */
export function solveGunLead(input: GunLeadInput): GunLeadSolution | null {
  const ownPos = input.ownPositionNED
  const ownVel = input.ownVelocityNED
  const tgtPos = input.targetPositionNED
  const tgtVel = input.targetVelocityNED
  const Vm = input.muzzleVelocityMS

  const rp: Vec3 = [tgtPos[0] - ownPos[0], tgtPos[1] - ownPos[1], tgtPos[2] - ownPos[2]]
  const slantRangeM = v3len(rp)
  if (!Number.isFinite(slantRangeM) || slantRangeM < 1 || Vm <= 0) return null

  const dragK = dragCoefficient(input.ballistics)

  let aimDir: Vec3 = [rp[0] / slantRangeM, rp[1] / slantRangeM, rp[2] / slantRangeM]
  let tof = Math.min(MAX_TOF_S, Math.max(MIN_TOF_S, slantRangeM / Vm))
  let impactSpeedMS = Vm
  let converged = false

  for (let iter = 0; iter < 8; iter++) {
    const predTgt: Vec3 = [
      tgtPos[0] + tgtVel[0] * tof,
      tgtPos[1] + tgtVel[1] * tof,
      tgtPos[2] + tgtVel[2] * tof,
    ]
    const losPred: Vec3 = [predTgt[0] - ownPos[0], predTgt[1] - ownPos[1], predTgt[2] - ownPos[2]]
    const predRangeM = v3len(losPred)
    if (predRangeM < 1) break

    // March a round fired now along the current aim until it reaches the
    // predicted target's slant range (or the time cap).
    let pos: Vec3 = [...ownPos]
    let vel: Vec3 = [
      ownVel[0] + aimDir[0] * Vm,
      ownVel[1] + aimDir[1] * Vm,
      ownVel[2] + aimDir[2] * Vm,
    ]
    const timeCap = Math.min(MAX_TOF_S, tof * 2 + 0.5)
    let tSim = 0
    let reached = false
    while (tSim < timeCap) {
      const next = stepProjectile(pos, vel, dragK, SIM_DT)
      pos = next.positionNED
      vel = next.velocityNED
      tSim += SIM_DT
      const travelled = Math.hypot(pos[0] - ownPos[0], pos[1] - ownPos[1], pos[2] - ownPos[2])
      if (travelled >= predRangeM) { reached = true; break }
    }
    impactSpeedMS = v3len(vel)
    const newTof = reached ? tSim : timeCap

    // Newton step on the aim direction: endpoint(aimDir) = ownPos + aimDir*R + offset,
    // so aimDir_next = aimDir + (predTgt - endpoint) / R.
    const miss: Vec3 = [predTgt[0] - pos[0], predTgt[1] - pos[1], predTgt[2] - pos[2]]
    const missLen = v3len(miss)
    const corrected: Vec3 = [
      aimDir[0] * predRangeM + miss[0],
      aimDir[1] * predRangeM + miss[1],
      aimDir[2] * predRangeM + miss[2],
    ]
    const cl = v3len(corrected)
    if (cl < 1e-6) break
    const nextAim: Vec3 = [corrected[0] / cl, corrected[1] / cl, corrected[2] / cl]

    const aimShift = Math.hypot(
      nextAim[0] - aimDir[0], nextAim[1] - aimDir[1], nextAim[2] - aimDir[2],
    )
    const tofDelta = Math.abs(newTof - tof)
    aimDir = nextAim
    tof = Math.min(MAX_TOF_S, Math.max(MIN_TOF_S, newTof))

    if (missLen < 0.5 && aimShift < 1e-4 && tofDelta < 5e-4) { converged = true; break }
  }

  const aimPointNED: Vec3 = [
    ownPos[0] + aimDir[0] * slantRangeM,
    ownPos[1] + aimDir[1] * slantRangeM,
    ownPos[2] + aimDir[2] * slantRangeM,
  ]
  const losDot =
    (aimDir[0] * rp[0] + aimDir[1] * rp[1] + aimDir[2] * rp[2]) / Math.max(1e-6, slantRangeM)
  const leadAngleDeg = (Math.acos(Math.max(-1, Math.min(1, losDot))) * 180) / Math.PI

  return { aimPointNED, timeOfFlightSec: tof, slantRangeM, impactSpeedMS, leadAngleDeg, converged }
}
