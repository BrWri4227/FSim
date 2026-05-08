import type { AircraftSpec, ControlInputs } from '../types/aircraft'
import type { StateVec } from '../types/common'
import type { FlightPenalties } from '../types/damage'
import type { LoadedStore } from '../types/weapons'
import { computeAtmosphere, thrustLapseFactor } from './Atmosphere'
import { computeAeroCoeffs } from './AeroCoefficients'
import { computeControlDeltas } from './ControlEffectiveness'
import { computeTotalMass, computeInertia, computeStoreDrag } from './MassProperties'
import { quatRotateVec, quatConjugate, quatNorm, makeStateVec, DEG2RAD, RAD2DEG, clamp } from '../utils/MathUtils'
import type { Vec3, Quat } from '../types/common'

const G0 = 9.80665

function extractFromSV(sv: StateVec) {
  const pos: Vec3 = [sv[0], sv[1], sv[2]]
  const vel: Vec3 = [sv[3], sv[4], sv[5]]
  const q: Quat = [sv[6], sv[7], sv[8], sv[9]]
  const omega: Vec3 = [sv[10], sv[11], sv[12]]
  return { pos, vel, q, omega }
}

function computeDerivative(
  sv: StateVec,
  spec: AircraftSpec,
  controls: ControlInputs,
  massKg: number,
  penalties: FlightPenalties,
  storeDragCD: number,
  flapCL: number,
  flapCD: number
): StateVec {
  const { pos, vel, q, omega } = extractFromSV(sv)
  const [p, qr, r] = omega

  // Speed and altitude
  const speedMS = Math.sqrt(vel[0]**2 + vel[1]**2 + vel[2]**2)
  const altM = -pos[2]  // NED: Down is positive, altitude = -z
  const atm = computeAtmosphere(altM, speedMS)
  const mach = speedMS / Math.max(atm.speedOfSoundMS, 1)

  // Velocity in body frame
  const velBody = quatRotateVec(quatConjugate(q), vel)
  const u = velBody[0], v_b = velBody[1], w = velBody[2]
  const vt = Math.max(Math.sqrt(u*u + v_b*v_b + w*w), 0.1)

  const alphaDeg = Math.atan2(w, Math.max(u, 0.1)) * RAD2DEG
  const betaDeg  = Math.asin(clamp(v_b / vt, -1, 1)) * RAD2DEG

  // Control surface deflections (radians) with FCS limits applied
  const maxPitchRad = 25 * DEG2RAD
  const maxRollRad  = 25 * DEG2RAD
  const maxYawRad   = 20 * DEG2RAD
  const pitchRad = -controls.pitch * maxPitchRad * penalties.pitchAuthorityMultiplier
  const rollRad  = controls.roll  * maxRollRad  * penalties.rollAuthorityMultiplier
  const yawRad   = controls.yaw   * maxYawRad

  // Aerodynamic coefficients
  const aeroCoeffs = computeAeroCoeffs(
    spec.aero, alphaDeg, betaDeg, mach,
    p, qr, r, spec.mass.wingspanM, spec.mass.macM, vt
  )
  const ctrlDeltas = computeControlDeltas(spec.controlEffectiveness, mach, pitchRad, rollRad, yawRad)

  const CL = aeroCoeffs.CL + ctrlDeltas.dCL + flapCL
  const CD = Math.max(0, aeroCoeffs.CD + storeDragCD + flapCD)
  const Cm = aeroCoeffs.Cm + ctrlDeltas.dCm
  const CY = aeroCoeffs.CY
  const Cl = aeroCoeffs.Cl + ctrlDeltas.dCl
  const Cn = aeroCoeffs.Cn + ctrlDeltas.dCn

  const S  = spec.mass.wingAreaM2
  const b  = spec.mass.wingspanM
  const c  = spec.mass.macM
  const qBar = atm.dynamicPressurePa

  // Aero forces in wind frame → body frame
  // Wind frame: drag along -velocity, lift perpendicular up, side along y
  // Approximate transform: in body frame at small beta: Fa_x ≈ -CD*qBar*S, Fa_z ≈ -CL*qBar*S
  const Fx_aero = (-CD * Math.cos(alphaDeg*DEG2RAD) + CL * Math.sin(alphaDeg*DEG2RAD)) * qBar * S
  const Fy_aero = CY * qBar * S
  const Fz_aero = (-CD * Math.sin(alphaDeg*DEG2RAD) - CL * Math.cos(alphaDeg*DEG2RAD)) * qBar * S

  // Thrust in body x-direction
  const throttle = clamp(controls.throttle, 0, 1)
  const isAB = throttle >= spec.engine.afterburnerThrottleMin
  const maxThrust = isAB ? spec.engine.maxThrustWetN : spec.engine.maxThrustDryN
  const idleThrust = spec.engine.idleThrustN
  const thrustN = (idleThrust + (maxThrust - idleThrust) * throttle) *
    thrustLapseFactor(altM) * penalties.thrustMultiplier
  const Fx_total = Fx_aero + thrustN
  const Fy_total = Fy_aero
  const Fz_total = Fz_aero

  // Gravity in body frame
  const gNED: Vec3 = [0, 0, G0]  // NED: gravity points down (+z)
  const gBody = quatRotateVec(quatConjugate(q), gNED)
  const Fx_grav = massKg * gBody[0]
  const Fy_grav = massKg * gBody[1]
  const Fz_grav = massKg * gBody[2]

  // Total body forces
  const Fx = Fx_total + Fx_grav
  const Fy = Fy_total + Fy_grav
  const Fz = Fz_total + Fz_grav

  // Accelerations in body frame
  const ax_b = Fx / massKg
  const ay_b = Fy / massKg
  const az_b = Fz / massKg

  // Rotate body acceleration to NED for velocity derivative
  const accelBody: Vec3 = [ax_b, ay_b, az_b]
  const accelNED = quatRotateVec(q, accelBody)
  // Subtract centripetal terms from body: a_NED = R * a_body (no Coriolis for inertial sim)
  const dvdt: Vec3 = [accelNED[0], accelNED[1], accelNED[2]]

  // Moments in body frame
  const L = (Cl * qBar * S * b)
  const M = (Cm * qBar * S * c)
  const N = (Cn * qBar * S * b)

  // Angular acceleration from Euler equations
  const inertia = computeInertia(spec, 0) // approximation
  const { Ixx, Iyy, Izz, Ixz } = inertia
  const det = Ixx * Izz - Ixz * Ixz
  const pdot = (Izz * (L + Ixz * p * qr - (Izz - Iyy) * qr * r) + Ixz * (N + (Ixx - Iyy) * p * qr - Ixz * qr * r)) / det
  const qdot = (M - (Ixx - Izz) * p * r - Ixz * (p * p - r * r)) / Iyy
  const rdot = (Ixx * (N + (Ixx - Iyy) * p * qr - Ixz * qr * r) + Ixz * (L + Ixz * p * qr - (Izz - Iyy) * qr * r)) / det

  // Quaternion derivative: dq/dt = 0.5 * q ⊗ [0, p, q, r]
  const [qw, qx, qy, qz] = q
  const dqw = 0.5 * (-qx*p - qy*qr - qz*r)
  const dqx = 0.5 * ( qw*p + qy*r  - qz*qr)
  const dqy = 0.5 * ( qw*qr - qx*r  + qz*p)
  const dqz = 0.5 * ( qw*r  + qx*qr - qy*p)

  return makeStateVec(
    vel,                           // dpos/dt = vel
    dvdt,                          // dvel/dt = accel
    [dqw, dqx, dqy, dqz],          // dq/dt
    [pdot, qdot, rdot]             // domega/dt
  )
}

// RK4 integration
export function stepRK4(
  sv: StateVec,
  spec: AircraftSpec,
  controls: ControlInputs,
  massKg: number,
  penalties: FlightPenalties,
  storeDragCD: number,
  dt: number,
  flapCL = 0,
  flapCD = 0
): StateVec {
  const k1 = computeDerivative(sv, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD)
  const sv2 = addSV(sv, scaleSV(k1, dt * 0.5))
  const k2 = computeDerivative(sv2, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD)
  const sv3 = addSV(sv, scaleSV(k2, dt * 0.5))
  const k3 = computeDerivative(sv3, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD)
  const sv4 = addSV(sv, scaleSV(k3, dt))
  const k4 = computeDerivative(sv4, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD)

  const result = addSV(sv, scaleSV(addSV4(k1, k2, k3, k4), dt / 6)) as StateVec

  // Renormalize quaternion
  const qLen = Math.sqrt(result[6]**2 + result[7]**2 + result[8]**2 + result[9]**2)
  if (qLen > 1e-6) {
    result[6] /= qLen; result[7] /= qLen; result[8] /= qLen; result[9] /= qLen
  }

  // Ground clamp
  if (-result[2] < 0) {
    result[2] = 0
    if (result[5] > 0) result[5] = 0  // stop downward velocity
  }

  return result
}

export function computeDerivedState(sv: StateVec, spec: AircraftSpec) {
  const { pos, vel, q, omega } = extractFromSV(sv)
  const speedMS = Math.sqrt(vel[0]**2 + vel[1]**2 + vel[2]**2)
  const altM = -pos[2]
  const atm = computeAtmosphere(altM, speedMS)
  const mach = speedMS / atm.speedOfSoundMS

  const velBody = quatRotateVec(quatConjugate(q), vel)
  const u = velBody[0], v_b = velBody[1], w = velBody[2]
  const vt = Math.max(Math.sqrt(u*u + v_b*v_b + w*w), 0.1)
  const alphaDeg = Math.atan2(w, Math.max(u, 0.1)) * RAD2DEG
  const betaDeg  = Math.asin(clamp(v_b / vt, -1, 1)) * RAD2DEG

  // IAS (indicated airspeed) approximation
  const iasMS = speedMS * Math.sqrt(atm.densityKgM3 / 1.225)
  const iasKts = iasMS * 1.94384

  // Load factor (Gz): specific force in body z divided by g
  const gNED: Vec3 = [0, 0, G0]
  const gBody = quatRotateVec(quatConjugate(q), gNED)
  const qBar = atm.dynamicPressurePa
  const S = spec.mass.wingAreaM2
  const CL = computeAeroCoeffs(spec.aero, alphaDeg, betaDeg, mach, omega[0], omega[1], omega[2],
    spec.mass.wingspanM, spec.mass.macM, vt).CL
  const liftN = CL * qBar * S
  const massKg = computeTotalMass(spec, 0, [])
  const gCurrent = liftN / (massKg * G0)

  // Euler angles from quaternion
  const [qw, qx, qy, qz] = q
  const yaw   = Math.atan2(2*(qw*qz + qx*qy), 1 - 2*(qy*qy + qz*qz)) * RAD2DEG
  const pitch = Math.asin(clamp(2*(qw*qy - qz*qx), -1, 1)) * RAD2DEG
  const roll  = Math.atan2(2*(qw*qx + qy*qz), 1 - 2*(qx*qx + qy*qy)) * RAD2DEG

  return {
    alphaDeg, betaDeg, mach, iasKts, altitudeM: altM,
    gCurrent, yaw, pitch, roll, speedMS,
    vviMps: -vel[2],  // NED: negative z = upward
    headingDeg: (yaw + 360) % 360
  }
}

function addSV(a: StateVec, b: StateVec): StateVec {
  return a.map((v, i) => v + b[i]!) as StateVec
}

function scaleSV(a: StateVec, s: number): StateVec {
  return a.map(v => v * s) as StateVec
}

function addSV4(k1: StateVec, k2: StateVec, k3: StateVec, k4: StateVec): StateVec {
  return k1.map((_, i) => k1[i]! + 2*k2[i]! + 2*k3[i]! + k4[i]!) as StateVec
}
