import type { MissileState } from '../types/weapons'
import type { Vec3 } from '../types/common'
import { v3sub, v3add, v3scale, v3dot, v3len, v3norm } from '../utils/MathUtils'

const G0 = 9.80665
const RAD2DEG = 180 / Math.PI

// ---------------------------------------------------------------------------
// Augmented Proportional Navigation (APN)
//
// The law used by modern AAMs (AIM-9M uses pure PN; AIM-120B / R-77 use APN).
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
// Predicted intercept point — used during ARH inertial/datalink phase.
// The missile steers toward where the target will be, not where it is now.
// ---------------------------------------------------------------------------
function predictedInterceptPos(
  misPos: Vec3, misVel: Vec3,
  tgtPos: Vec3, tgtVel: Vec3
): Vec3 {
  const range = v3len(v3sub(tgtPos, misPos))
  const misSpeed = v3len(misVel)
  // Rough time-to-go from current range and missile speed
  const tgo = misSpeed > 1 ? range / misSpeed : 5.0
  return [
    tgtPos[0] + tgtVel[0] * tgo,
    tgtPos[1] + tgtVel[1] * tgo,
    tgtPos[2] + tgtVel[2] * tgo,
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

  // ARH mid-course: steer toward predicted intercept, not current target pos
  if (missile.spec.category === 'ARH_MISSILE' && missile.guidanceMode !== 'ACTIVE') {
    tgtPos = predictedInterceptPos(missile.positionNED, missile.velocityNED, tgtPos, tgtVel)
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
