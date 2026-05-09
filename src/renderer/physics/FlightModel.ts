import type { AircraftSpec, ControlInputs } from '../types/aircraft'
import type { StateVec } from '../types/common'
import type { FlightPenalties } from '../types/damage'
import { computeAtmosphere, thrustLapseFactor } from './Atmosphere'
import { computeAeroCoeffs, computeCL } from './AeroCoefficients'
import { computeControlDeltas } from './ControlEffectiveness'
import { computeInertia } from './MassProperties'
import type { InertiaMatrix } from './MassProperties'
import { DEG2RAD, RAD2DEG, clamp } from '../utils/MathUtils'

const G0 = 9.80665

// ─── Module-level RK4 scratch buffers ────────────────────────────────────────
// Safe to use at module scope: JS is single-threaded and stepRK4 is not reentrant.
// Using plain arrays (not Float64Array) so the JIT keeps the same type inference
// as the rest of the physics code.
const _k1:  number[] = new Array(13).fill(0)
const _k2:  number[] = new Array(13).fill(0)
const _k3:  number[] = new Array(13).fill(0)
const _k4:  number[] = new Array(13).fill(0)
const _svT: number[] = new Array(13).fill(0)  // intermediate sv (sv2 / sv3 / sv4)

// ─── Inline helpers ───────────────────────────────────────────────────────────


/** Write a + b*s into out (no allocation). */
function addScaledSVInto(a: ArrayLike<number>, b: ArrayLike<number>, s: number, out: number[]): void {
  for (let i = 0; i < 13; i++) out[i] = a[i]! + b[i]! * s
}

/** Write sv + (k1 + 2*k2 + 2*k3 + k4)*s into out (no allocation). */
function weightedRK4SumInto(
  sv: ArrayLike<number>,
  k1: ArrayLike<number>, k2: ArrayLike<number>,
  k3: ArrayLike<number>, k4: ArrayLike<number>,
  s: number, out: number[]
): void {
  for (let i = 0; i < 13; i++) {
    out[i] = sv[i]! + (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!) * s
  }
}

// ─── Core derivative (writes into pre-allocated out buffer) ──────────────────

function computeDerivativeInto(
  sv: ArrayLike<number>,
  spec: AircraftSpec,
  controls: ControlInputs,
  massKg: number,
  penalties: FlightPenalties,
  storeDragCD: number,
  flapCL: number,
  flapCD: number,
  inertia: InertiaMatrix,
  out: number[]
): void {
  // Read state vector by index — avoids allocating pos/vel/q/omega sub-arrays
  const vx = sv[3]!, vy = sv[4]!, vz = sv[5]!           // velocity NED
  const qw = sv[6]!, qx = sv[7]!, qy = sv[8]!, qz = sv[9]!  // attitude quaternion
  const p  = sv[10]!, qr = sv[11]!, r = sv[12]!          // body angular rates
  const altM = -sv[2]!                                   // NED: altitude = -z

  // Speed and atmosphere
  const speedMS = Math.sqrt(vx*vx + vy*vy + vz*vz)
  const atm  = computeAtmosphere(altM, speedMS)
  const mach = speedMS / Math.max(atm.speedOfSoundMS, 1)

  // Velocity in body frame — inline conjugate rotation (no Quat allocation)
  const velTx = 2 * (-qy * vz + qz * vy)
  const velTy = 2 * (-qz * vx + qx * vz)
  const velTz = 2 * (-qx * vy + qy * vx)
  const u   = vx + qw * velTx - qy * velTz + qz * velTy
  const v_b = vy + qw * velTy - qz * velTx + qx * velTz
  const w   = vz + qw * velTz - qx * velTy + qy * velTx
  const vt  = Math.max(Math.sqrt(u*u + v_b*v_b + w*w), 0.1)

  const alphaDeg = Math.atan2(w, Math.max(u, 0.1)) * RAD2DEG
  const betaDeg  = Math.asin(clamp(v_b / vt, -1, 1)) * RAD2DEG

  // Control surface deflections (radians) with FCS limits applied
  const maxPitchRad = 28 * DEG2RAD
  // ~25–28° aileron travel typical for fighters; caps peak roll rate closer to published limits
  const maxRollRad  = 27 * DEG2RAD
  const maxYawRad   = 24 * DEG2RAD
  const pitchRadCmd = -controls.pitch * maxPitchRad * penalties.pitchAuthorityMultiplier
  const rollRadCmd  =  controls.roll  * maxRollRad  * penalties.rollAuthorityMultiplier
  const yawRadCmd   =  controls.yaw   * maxYawRad

  // SAS-like damping:
  // - Always damp body rates.
  // - Add stronger beta stabilization when pilot lateral inputs are low
  //   to suppress straight-flight dutch-roll oscillation.
  const betaRad = betaDeg * DEG2RAD
  const lateralInput = Math.max(Math.abs(controls.roll), Math.abs(controls.yaw))
  const stabilityAssist = 1 - clamp(lateralInput / 0.55, 0, 1)

  const pitchDamped = clamp(pitchRadCmd - 0.05 * qr, -maxPitchRad, maxPitchRad)
  const rollDamped = clamp(
    rollRadCmd - (0.10 * p) - (0.05 * betaRad * stabilityAssist),
    -maxRollRad,
    maxRollRad
  )
  const yawDamped = clamp(
    yawRadCmd - (0.10 * r) - (0.26 * betaRad * stabilityAssist),
    -maxYawRad,
    maxYawRad
  )

  // Aerodynamic coefficients and control increments
  const aeroCoeffs = computeAeroCoeffs(
    spec.aero, alphaDeg, betaDeg, mach,
    p, qr, r, spec.mass.wingspanM, spec.mass.macM, vt
  )
  const ctrlDeltas = computeControlDeltas(spec.controlEffectiveness, mach, pitchDamped, rollDamped, yawDamped)

  const CL = aeroCoeffs.CL + ctrlDeltas.dCL + flapCL
  const CD = Math.max(0, aeroCoeffs.CD + storeDragCD + flapCD)
  const Cm = aeroCoeffs.Cm + ctrlDeltas.dCm
  const CY = aeroCoeffs.CY
  const Cl = aeroCoeffs.Cl + ctrlDeltas.dCl
  const Cn = aeroCoeffs.Cn + ctrlDeltas.dCn

  const S    = spec.mass.wingAreaM2
  const b    = spec.mass.wingspanM
  const c    = spec.mass.macM
  const qBar = atm.dynamicPressurePa

  // Aero forces in body frame
  const alphaRad = alphaDeg * DEG2RAD
  const cosA = Math.cos(alphaRad), sinA = Math.sin(alphaRad)
  const Fx_aero = (-CD * cosA + CL * sinA) * qBar * S
  const Fy_aero = CY * qBar * S
  const Fz_aero = (-CD * sinA - CL * cosA) * qBar * S

  // Thrust
  const throttle  = clamp(controls.throttle, 0, 1)
  const isAB      = throttle >= spec.engine.afterburnerThrottleMin
  const maxThrust = isAB ? spec.engine.maxThrustWetN : spec.engine.maxThrustDryN
  const idleThrust = spec.engine.idleThrustN
  const thrustN   = (idleThrust + (maxThrust - idleThrust) * throttle) *
    thrustLapseFactor(altM) * penalties.thrustMultiplier

  const Fx_total = Fx_aero + thrustN

  // Gravity in body frame — specialized conjugate-rotate for gNED=[0,0,G0] (no allocations)
  const gBody_x = 2 * G0 * (qz * qx - qw * qy)
  const gBody_y = 2 * G0 * (qw * qx + qz * qy)
  const gBody_z =     G0 * (1 - 2 * (qx * qx + qy * qy))

  // Total body forces → body accelerations
  const ax_b = (Fx_total + massKg * gBody_x) / massKg
  const ay_b = (Fy_aero  + massKg * gBody_y) / massKg
  const az_b = (Fz_aero  + massKg * gBody_z) / massKg

  // Rotate body acceleration to NED — inline quatRotateVec (no Vec3 allocation)
  const acTx = 2 * (qy * az_b - qz * ay_b)
  const acTy = 2 * (qz * ax_b - qx * az_b)
  const acTz = 2 * (qx * ay_b - qy * ax_b)
  const dvdt_x = ax_b + qw * acTx + qy * acTz - qz * acTy
  const dvdt_y = ay_b + qw * acTy + qz * acTx - qx * acTz
  const dvdt_z = az_b + qw * acTz + qx * acTy - qy * acTx

  // Moments in body frame
  const L = Cl * qBar * S * b
  const M = Cm * qBar * S * c
  const N = Cn * qBar * S * b

  // Angular acceleration from Euler equations (uses pre-computed inertia)
  const { Ixx, Iyy, Izz, Ixz } = inertia
  const det  = Ixx * Izz - Ixz * Ixz
  const pdot = (Izz * (L + Ixz * p * qr - (Izz - Iyy) * qr * r) + Ixz * (N + (Ixx - Iyy) * p * qr - Ixz * qr * r)) / det
  const qdot = (M - (Ixx - Izz) * p * r - Ixz * (p * p - r * r)) / Iyy
  const rdot = (Ixx * (N + (Ixx - Iyy) * p * qr - Ixz * qr * r) + Ixz * (L + Ixz * p * qr - (Izz - Iyy) * qr * r)) / det

  // Quaternion derivative: dq/dt = 0.5 * q ⊗ [0, p, qr, r]
  const dqw = 0.5 * (-qx * p  - qy * qr - qz * r )
  const dqx = 0.5 * ( qw * p  + qy * r  - qz * qr)
  const dqy = 0.5 * ( qw * qr - qx * r  + qz * p )
  const dqz = 0.5 * ( qw * r  + qx * qr - qy * p )

  // Write into output buffer (no makeStateVec allocation)
  out[0] = vx;    out[1] = vy;    out[2] = vz     // dpos/dt = vel
  out[3] = dvdt_x; out[4] = dvdt_y; out[5] = dvdt_z  // dvel/dt
  out[6] = dqw;  out[7] = dqx;  out[8] = dqy;  out[9] = dqz  // dq/dt
  out[10] = pdot; out[11] = qdot; out[12] = rdot              // domega/dt
}

// ─── RK4 integration ─────────────────────────────────────────────────────────

export function stepRK4(
  sv: StateVec,
  spec: AircraftSpec,
  controls: ControlInputs,
  massKg: number,
  penalties: FlightPenalties,
  storeDragCD: number,
  dt: number,
  flapCL = 0,
  flapCD = 0,
  minAltM = 0
): StateVec {
  // Hoist inertia: it only depends on spec and fuelKg=0, so it is constant for all four stages.
  const inertia = computeInertia(spec, 0)

  computeDerivativeInto(sv, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD, inertia, _k1)
  addScaledSVInto(sv, _k1, dt * 0.5, _svT)

  computeDerivativeInto(_svT, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD, inertia, _k2)
  addScaledSVInto(sv, _k2, dt * 0.5, _svT)

  computeDerivativeInto(_svT, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD, inertia, _k3)
  addScaledSVInto(sv, _k3, dt, _svT)

  computeDerivativeInto(_svT, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD, inertia, _k4)

  // Allocate exactly one new array for the result that callers store in state.sv
  const result = new Array(13) as StateVec
  weightedRK4SumInto(sv, _k1, _k2, _k3, _k4, dt / 6, result)

  // Renormalize quaternion
  const qLen = Math.sqrt(result[6]**2 + result[7]**2 + result[8]**2 + result[9]**2)
  if (qLen > 1e-6) {
    result[6] /= qLen; result[7] /= qLen; result[8] /= qLen; result[9] /= qLen
  }

  // Ground clamp
  if (-result[2] < minAltM) {
    result[2] = -minAltM
    if (result[5] > 0) result[5] = 0
  }

  return result
}

// ─── Derived flight state (HUD / instruments) ────────────────────────────────

export function computeDerivedState(sv: StateVec, spec: AircraftSpec, massKg: number) {
  // Read from sv by index to avoid extractFromSV sub-array allocations
  const vx = sv[3]!, vy = sv[4]!, vz = sv[5]!
  const qw = sv[6]!, qx = sv[7]!, qy = sv[8]!, qz = sv[9]!
  const altM    = -sv[2]!
  const speedMS = Math.sqrt(vx*vx + vy*vy + vz*vz)

  const atm  = computeAtmosphere(altM, speedMS)
  const mach = speedMS / atm.speedOfSoundMS

  // Velocity in body frame — inline conjugate rotation (no Quat allocation)
  const velTx = 2 * (-qy * vz + qz * vy)
  const velTy = 2 * (-qz * vx + qx * vz)
  const velTz = 2 * (-qx * vy + qy * vx)
  const u   = vx + qw * velTx - qy * velTz + qz * velTy
  const v_b = vy + qw * velTy - qz * velTx + qx * velTz
  const w   = vz + qw * velTz - qx * velTy + qy * velTx
  const vt  = Math.max(Math.sqrt(u*u + v_b*v_b + w*w), 0.1)

  const alphaDeg = Math.atan2(w, Math.max(u, 0.1)) * RAD2DEG
  const betaDeg  = Math.asin(clamp(v_b / vt, -1, 1)) * RAD2DEG

  // IAS approximation
  const iasMS = speedMS * Math.sqrt(atm.densityKgM3 / 1.225)
  const iasKts = iasMS * 1.94384

  // Load factor: CL-only aero lookup (avoids the CD/Cm table lookups and object build)
  const qBar  = atm.dynamicPressurePa
  const S     = spec.mass.wingAreaM2
  const CL    = computeCL(spec.aero, alphaDeg, mach)
  const liftN = CL * qBar * S
  const gCurrent  = liftN / (massKg * G0)

  // Euler angles from quaternion
  const yaw   = Math.atan2(2*(qw*qz + qx*qy), 1 - 2*(qy*qy + qz*qz)) * RAD2DEG
  const pitch = Math.asin(clamp(2*(qw*qy - qz*qx), -1, 1)) * RAD2DEG
  const roll  = Math.atan2(2*(qw*qx + qy*qz), 1 - 2*(qx*qx + qy*qy)) * RAD2DEG

  return {
    alphaDeg, betaDeg, mach, iasKts, altitudeM: altM,
    gCurrent, yaw, pitch, roll, speedMS,
    vviMps: -vz,  // NED: negative z = upward
    headingDeg: (yaw + 360) % 360,
  }
}

