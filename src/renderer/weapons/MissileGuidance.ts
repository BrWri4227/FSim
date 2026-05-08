import type { MissileState } from '../types/weapons'
import type { Vec3 } from '../types/common'
import { v3sub, v3add, v3scale, v3dot, v3len, v3norm } from '../utils/MathUtils'

const G0 = 9.80665
const RAD2DEG = 180 / Math.PI

// ---------------------------------------------------------------------------
// Augmented Proportional Navigation (APN)
//
// The law used by modern AAMs (AIM-9X / AIM-120B / R-77 all benefit from APN).
//
//   a_cmd  =  N · Vc · λ̇  +  (N/2) · a_target⊥
//
// where:
//   λ̇  = dLOS/dt  (finite-difference of the unit line-of-sight vector)
//   Vc = closing velocity  (positive when range is shrinking)
//   a_target⊥ = target acceleration projected ⊥ to LOS  (APN feedforward)
//
// Note on the historical bug that was here:
//   ω_LOS = LOS × (dLOS/dt)  points along the LOS *rotation axis*, NOT the
//   guidance direction.  The commanded acceleration must lie in dLOS/dt direction.
// ---------------------------------------------------------------------------
function computeAPN(
  misPos: Vec3, misVel: Vec3,
  tgtPos: Vec3, tgtVel: Vec3,
  prevLOS: Vec3, prevTgtVel: Vec3,
  N: number, dt: number
): { accel: Vec3; newLOS: Vec3 } {
  const relPos = v3sub(tgtPos, misPos)
  const range = v3len(relPos)
  if (range < 1) return { accel: [0, 0, 0], newLOS: prevLOS }

  const los = v3norm(relPos)
  const relVel = v3sub(tgtVel, misVel)
  const closingVel = -v3dot(relVel, los)   // positive = closing

  // LOS rate vector: finite difference of unit LOS
  const losRate: Vec3 = [
    (los[0] - prevLOS[0]) / dt,
    (los[1] - prevLOS[1]) / dt,
    (los[2] - prevLOS[2]) / dt,
  ]

  // Pure PN term: N · Vc · λ̇
  const pn = v3scale(losRate, N * Math.max(closingVel, 50))

  // APN feedforward: estimate target acceleration from velocity change
  const tgtAccel: Vec3 = [
    (tgtVel[0] - prevTgtVel[0]) / dt,
    (tgtVel[1] - prevTgtVel[1]) / dt,
    (tgtVel[2] - prevTgtVel[2]) / dt,
  ]
  // Project ⊥ to LOS
  const along = v3dot(tgtAccel, los)
  const tgtAccelPerp: Vec3 = [
    tgtAccel[0] - along * los[0],
    tgtAccel[1] - along * los[1],
    tgtAccel[2] - along * los[2],
  ]
  const apn = v3scale(tgtAccelPerp, N / 2)

  return { accel: v3add(pn, apn), newLOS: los }
}

// ---------------------------------------------------------------------------
// Solve first-order intercept time for constant-speed missile and
// constant-velocity target:
//   |r + v_t * t| = s_m * t
// where r = tgtPos - misPos.
// ---------------------------------------------------------------------------
function solveInterceptTime(
  relPos: Vec3,
  tgtVel: Vec3,
  missileSpeed: number
): number {
  const a = v3dot(tgtVel, tgtVel) - missileSpeed * missileSpeed
  const b = 2 * v3dot(relPos, tgtVel)
  const c = v3dot(relPos, relPos)

  // Near-linear fallback when missile and target speed terms cancel.
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-6) return Math.sqrt(c) / Math.max(missileSpeed, 1)
    const t = -c / b
    return t > 0 ? t : Math.sqrt(c) / Math.max(missileSpeed, 1)
  }

  const disc = b * b - 4 * a * c
  if (disc < 0) return Math.sqrt(c) / Math.max(missileSpeed, 1)

  const root = Math.sqrt(disc)
  const t1 = (-b - root) / (2 * a)
  const t2 = (-b + root) / (2 * a)

  let best = Number.POSITIVE_INFINITY
  if (t1 > 0) best = Math.min(best, t1)
  if (t2 > 0) best = Math.min(best, t2)
  if (!Number.isFinite(best)) return Math.sqrt(c) / Math.max(missileSpeed, 1)
  return best
}

// ---------------------------------------------------------------------------
// Predicted intercept point for ARH missiles.
// Uses analytic lead and a limited target-acceleration extrapolation.
// ---------------------------------------------------------------------------
function predictedInterceptPos(
  missile: MissileState,
  misPos: Vec3, misVel: Vec3,
  tgtPos: Vec3, tgtVel: Vec3,
  dt: number
): Vec3 {
  const relPos = v3sub(tgtPos, misPos)
  const range = v3len(relPos)

  // Estimate missile intercept speed from current velocity. Keep a floor so
  // freshly launched missiles can still compute a meaningful lead solution.
  const missileSpeed = Math.max(v3len(misVel), 180)
  let tgo = solveInterceptTime(relPos, tgtVel, missileSpeed)

  // Keep lead horizon bounded by guidance phase to avoid over-leading.
  const maxLeadSec = missile.guidanceMode === 'ACTIVE' ? 3.0 : 10.0
  tgo = Math.max(0.05, Math.min(maxLeadSec, tgo))
  if (!Number.isFinite(tgo)) tgo = Math.min(maxLeadSec, range / missileSpeed)

  const dtSafe = Math.max(dt, 1e-3)
  const tgtAccelRaw: Vec3 = [
    (tgtVel[0] - missile.prevTargetVel[0]) / dtSafe,
    (tgtVel[1] - missile.prevTargetVel[1]) / dtSafe,
    (tgtVel[2] - missile.prevTargetVel[2]) / dtSafe,
  ]
  // Cap acceleration extrapolation to suppress noisy radar-track jumps.
  const accelMag = v3len(tgtAccelRaw)
  const accelCap = 90 // ~9 g
  const tgtAccel = accelMag > accelCap ? v3scale(tgtAccelRaw, accelCap / accelMag) : tgtAccelRaw

  const t2 = tgo * tgo * 0.5
  return [
    tgtPos[0] + tgtVel[0] * tgo + tgtAccel[0] * t2,
    tgtPos[1] + tgtVel[1] * tgo + tgtAccel[1] * t2,
    tgtPos[2] + tgtVel[2] * tgo + tgtAccel[2] * t2,
  ]
}

// ---------------------------------------------------------------------------
// IR seeker gimbal check
// Returns false if the target has moved outside the seeker's gimbal limit,
// meaning the seeker loses lock and the missile should enter COAST mode.
// ---------------------------------------------------------------------------
export function checkIRSeekerLock(missile: MissileState, targetPos: Vec3): boolean {
  const seeker = missile.spec.irSeeker
  if (!seeker) return false

  const losDir = v3norm(v3sub(targetPos, missile.positionNED))
  const bodyFwd = v3norm(missile.velocityNED)
  const cosAngle = v3dot(bodyFwd, losDir)
  const offBoresightDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * RAD2DEG
  return offBoresightDeg <= seeker.gimbalLimitDeg
}

// ---------------------------------------------------------------------------
// Main per-tick guidance call — mutates missile.prevLOSUnit and
// missile.prevTargetVel as side-effects (same pattern as before).
// ---------------------------------------------------------------------------
export function guideMissile(missile: MissileState, targetPos: Vec3, targetVel: Vec3, dt: number): Vec3 {
  let tgtPos = targetPos
  const tgtVel = targetVel

  // ARH missiles always steer to an intercept aimpoint, not pure pursuit.
  if (missile.spec.category === 'ARH_MISSILE') {
    tgtPos = predictedInterceptPos(missile, missile.positionNED, missile.velocityNED, tgtPos, tgtVel, dt)
  }

  const { accel, newLOS } = computeAPN(
    missile.positionNED, missile.velocityNED,
    tgtPos, tgtVel,
    missile.prevLOSUnit, missile.prevTargetVel,
    missile.spec.navigationConstant, dt
  )

  missile.prevLOSUnit = newLOS
  missile.prevTargetVel = [...tgtVel]

  // Clamp to structural G limit
  const maxAccel = missile.spec.maxGOverload * G0
  const mag = v3len(accel)
  return mag > maxAccel ? v3scale(accel, maxAccel / mag) : accel
}

// Coast guidance: no seeker — fly toward extrapolated last-known target pos
export function guideMissileCoast(missile: MissileState, dt: number): Vec3 {
  // Simple PN toward last-known position (no APN feedforward available)
  const tgtPos = missile.lastKnownTargetPos
  const tgtVel = missile.lastKnownTargetVel

  const relPos = v3sub(tgtPos, missile.positionNED)
  const range = v3len(relPos)
  if (range < 10) return [0, 0, 0]

  const los = v3norm(relPos)
  const relVel = v3sub(tgtVel, missile.velocityNED)
  const closingVel = -v3dot(relVel, los)

  const losRate: Vec3 = [
    (los[0] - missile.prevLOSUnit[0]) / dt,
    (los[1] - missile.prevLOSUnit[1]) / dt,
    (los[2] - missile.prevLOSUnit[2]) / dt,
  ]
  missile.prevLOSUnit = los

  const accel = v3scale(losRate, missile.spec.navigationConstant * Math.max(closingVel, 50))
  const maxAccel = missile.spec.maxGOverload * G0
  const mag = v3len(accel)
  return mag > maxAccel ? v3scale(accel, maxAccel / mag) : accel
}
