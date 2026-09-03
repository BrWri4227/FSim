import type { AircraftSpec, ControlInputs } from '../types/aircraft'
import type { StateVec } from '../types/common'
import type { FlightPenalties } from '../types/damage'
import { thrustLapseFactor, thrustLapseFromDensity } from './Atmosphere'
import { computeAeroCoeffs } from './AeroCoefficients'
import { computeControlDeltas } from './ControlEffectiveness'
import { computeMassProperties, type InertiaMatrix, type MassProperties } from './MassProperties'
import { getWeather, turbulenceAmplitudeRadS } from './WeatherState'
import { computeFlightKinematics, eulerFromQuat } from './FlightKinematics'
import { advanceTurbulenceClock, sampleTurbulenceAxis } from './TurbulenceNoise'
import { DEG2RAD, clamp, quatFromEulerZYX } from '../utils/MathUtils'

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
  flapCm: number,
  inertia: InertiaMatrix,
  cgBodyM: import('../types/common').Vec3,
  actualThrustN: number,
  fuelKg: number,
  minAltM: number,
  out: number[]
): void {
  const kin = computeFlightKinematics(sv)
  const { vx, vy, vz, qw, qx, qy, qz, atm, mach, vt, alphaDeg, betaDeg } = kin
  const p = kin.pRate
  const qr = kin.qRate
  const r = kin.rRate

  // Control surface deflections (radians) with FCS limits applied
  const maxPitchRad = 28 * DEG2RAD
  // ~25–28° aileron travel typical for fighters; caps peak roll rate closer to published limits
  const maxRollRad  = 27 * DEG2RAD
  const maxYawRad   = 24 * DEG2RAD
  const pitchRadCmd = -controls.pitch * maxPitchRad * penalties.pitchAuthorityMultiplier
  const rollRadCmd  =  controls.roll  * maxRollRad  * penalties.rollAuthorityMultiplier
  const yawRadCmd   =  controls.yaw   * maxYawRad

  // Beta stabilization: suppress dutch-roll in straight-and-level flight.
  // Gated by lateral stick input AND bank angle so it does not fight maneuvering turns.
  const betaRad = betaDeg * DEG2RAD
  const lateralInput = Math.max(Math.abs(controls.roll), Math.abs(controls.yaw))
  const bankRad = Math.atan2(2*(qw*qx + qy*qz), 1 - 2*(qx*qx + qy*qy))
  const bankFrac = clamp(Math.abs(bankRad) / (25 * DEG2RAD), 0, 1)
  const stabilityAssist = (1 - clamp(lateralInput / 0.55, 0, 1)) * (1 - bankFrac)

  // No explicit rate feedback here — physical damping derivatives (Cmq, Clp, Cnr)
  // in computeAeroCoeffs handle rate damping correctly without fighting pilot inputs.
  const pitchDamped = clamp(pitchRadCmd, -maxPitchRad, maxPitchRad)
  const rollDamped = clamp(
    rollRadCmd - (0.05 * betaRad * stabilityAssist),
    -maxRollRad,
    maxRollRad
  )
  const yawDamped = clamp(
    yawRadCmd - (0.26 * betaRad * stabilityAssist),
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
  const Cm = aeroCoeffs.Cm + ctrlDeltas.dCm + flapCm
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

  // Thrust — lagged engine output; zero when fuel exhausted (flame-out)
  const thrustN = fuelKg <= 0 ? 0 :
    actualThrustN * thrustLapseFromDensity(atm.densityKgM3) * penalties.thrustMultiplier

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
  let L = Cl * qBar * S * b
  let M = Cm * qBar * S * c
  let N = Cn * qBar * S * b

  // CG offset pitch moment — stores/fuel shift the effective pitching moment.
  // Scaled by dynamic pressure so it fades out at low speed / on the ground: this
  // models an in-flight trim shift, not a static gravity moment, and left
  // unscaled it would slowly wind the nose up while parked.
  const cgPitch = massKg * G0 * (cgBodyM[2] * Math.cos(alphaRad) - cgBodyM[0] * Math.sin(alphaRad))
  M += cgPitch * c * 0.015 * clamp(qBar / 3000, 0, 1)

  // ─── Landing-gear ground reaction ───────────────────────────────────────────
  // Near the ground the gear behaves as a spring-damper that holds a level rest
  // attitude. It is weighted by weight-on-wheels (how much load the wheels still
  // carry), so as lift builds during the takeoff roll the gear stops fighting the
  // elevator and the nose rotates naturally. Without this the airframe is a free
  // rigid body in pitch on the runway and any residual moment tips it over.
  const nearGround = (-sv[2]!) - minAltM <= 0.6
  const wow = nearGround ? clamp(1 - (-Fz_aero) / (0.9 * massKg * G0), 0, 1) : 0
  if (nearGround) {
    const att = eulerFromQuat(qw, qx, qy, qz)
    const pitchErrRad = (att.pitch - (spec.groundRestPitchDeg ?? 0)) * DEG2RAD
    const rollErrRad = att.roll * DEG2RAD
    M += wow * (-inertia.Iyy * 6.0 * pitchErrRad - inertia.Iyy * 5.0 * qr)
    L += wow * (-inertia.Ixx * 6.0 * rollErrRad - inertia.Ixx * 5.0 * p)
    N += -wow * inertia.Izz * 2.5 * r
  }

  // ─── Low-speed pitch assist (carefree FBW) ─────────────────────────────────
  // Models an AoA-command flight control law: a firm nose-up pull adds authority
  // that bare aerodynamic surface power would lack at low q-bar, so a deliberate
  // yank actually reaches the high-alpha regime the FCS soft-limiter now allows
  // (cobra, high-AoA snap). Gated on a firm pull (>0.55 command) so ordinary
  // maneuvering is untouched, faded out by ~250 kt so the sustained-turn /
  // structural-G regime is untouched, and suppressed while on the wheels.
  const cmdFrac = Math.abs(pitchRadCmd) / maxPitchRad
  const pitchAssistEnv =
    clamp(1 - qBar / 11000, 0, 1) *
    clamp((cmdFrac - 0.55) / 0.35, 0, 1) *
    (1 - 0.85 * wow)
  if (pitchAssistEnv > 0) {
    M += (-pitchRadCmd / maxPitchRad) * inertia.Iyy * 2.4 * pitchAssistEnv
  }

  // ─── Thrust vectoring ───────────────────────────────────────────────────────
  // Adds a control moment independent of airspeed, so vectored jets keep pitch
  // (and, for 3D nozzles, yaw) authority at very low dynamic pressure — post-stall
  // nose-pointing and cobra recovery.
  if (spec.thrustVectoring && thrustN > 0) {
    const tvcAuth = clamp(1 - qBar / 8000, 0, 1)
    const armM = spec.mass.macM * 1.6
    const maxDeflRad = 17 * DEG2RAD
    const pitchDefl = clamp(pitchRadCmd / maxPitchRad, -1, 1) * maxDeflRad
    M += -Math.sin(pitchDefl) * thrustN * armM * tvcAuth * 0.55
    if (spec.thrustVectoring === '3d') {
      const yawDefl = clamp(yawRadCmd / maxYawRad, -1, 1) * maxDeflRad
      N += Math.sin(yawDefl) * thrustN * armM * tvcAuth * 0.4
    }
  }

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
  minAltM = 0,
  fuelKg = 0,
  massProps?: MassProperties,
  actualThrustN?: number,
  flapCm = 0,
): StateVec {
  const mp = massProps ?? computeMassProperties(spec, fuelKg, [])
  const thrustN = actualThrustN ?? computeCommandedThrustN(spec, controls.throttle)

  computeDerivativeInto(sv, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD, flapCm, mp, mp.cgBodyM, thrustN, fuelKg, minAltM, _k1)
  addScaledSVInto(sv, _k1, dt * 0.5, _svT)

  computeDerivativeInto(_svT, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD, flapCm, mp, mp.cgBodyM, thrustN, fuelKg, minAltM, _k2)
  addScaledSVInto(sv, _k2, dt * 0.5, _svT)

  computeDerivativeInto(_svT, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD, flapCm, mp, mp.cgBodyM, thrustN, fuelKg, minAltM, _k3)
  addScaledSVInto(sv, _k3, dt, _svT)

  computeDerivativeInto(_svT, spec, controls, massKg, penalties, storeDragCD, flapCL, flapCD, flapCm, mp, mp.cgBodyM, thrustN, fuelKg, minAltM, _k4)

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

  // Ground attitude backstop — the gear spring-damper in the derivative does the
  // real work; this is a hard limit so a large-dt frame spike can't tumble the
  // jet past a physically impossible attitude while it sits on the runway.
  if ((-result[2]) - minAltM <= 0.6) {
    const gAtt = eulerFromQuat(result[6], result[7], result[8], result[9])
    const clampedPitch = clamp(gAtt.pitch, -6, 20)
    if (clampedPitch !== gAtt.pitch) {
      const gq = quatFromEulerZYX(gAtt.yaw * DEG2RAD, clampedPitch * DEG2RAD, gAtt.roll * DEG2RAD)
      result[6] = gq[0]; result[7] = gq[1]; result[8] = gq[2]; result[9] = gq[3]
      result[11] = 0
    }
  }

  // Turbulence — band-limited angular-rate perturbation, rolled-off at high IAS where
  // the airframe inertia would naturally damp small gusts. Skipped on ground.
  advanceTurbulenceClock(dt)
  const altResultM = -result[2]
  if (altResultM > minAltM + 0.5) {
    const turbAmp = turbulenceAmplitudeRadS(getWeather().turbulence)
    if (turbAmp > 0) {
      const scale = turbAmp * dt * 4
      result[10] += sampleTurbulenceAxis(0) * scale
      result[11] += sampleTurbulenceAxis(1) * scale
      result[12] += sampleTurbulenceAxis(2) * scale
    }
  }

  return result
}

// ─── Engine helpers ──────────────────────────────────────────────────────────

/**
 * Instantaneous commanded thrust (N) at sea level, before spool lag or altitude lapse.
 *
 * Two linear segments so both endpoints are reachable:
 *  - throttle 0 … abMin   → idle … full military (dry) thrust
 *  - throttle abMin … 1    → full military … full wet (afterburner) thrust
 * The old single ramp maxed dry thrust at only `abMin` of its rated value, so
 * military power (and therefore supercruise) was unreachable.
 */
export function computeCommandedThrustN(spec: AircraftSpec, throttle: number): number {
  const t = clamp(throttle, 0, 1)
  const { idleThrustN: idle, maxThrustDryN: dry, maxThrustWetN: wet, afterburnerThrottleMin: abMin } = spec.engine
  if (t <= abMin) {
    return idle + (dry - idle) * (t / Math.max(abMin, 1e-3))
  }
  return dry + (wet - dry) * ((t - abMin) / Math.max(1 - abMin, 1e-3))
}

export interface EngineDynamicsState {
  thrustN: number
  abLightOffSec: number
}

/**
 * First-order thrust spool with afterburner light-off delay.
 * Returns the thrust (N) to feed the integrator (before altitude lapse).
 */
export function updateEngineDynamics(
  spec: AircraftSpec,
  throttle: number,
  engine: EngineDynamicsState,
  dt: number,
): number {
  const t = clamp(throttle, 0, 1)
  const wantAB = t >= spec.engine.afterburnerThrottleMin
  const idle = spec.engine.idleThrustN
  const dryMax = spec.engine.maxThrustDryN
  const wetMax = spec.engine.maxThrustWetN

  let commanded = computeCommandedThrustN(spec, t)

  const wasWet = engine.thrustN > dryMax * 1.05
  if (!wantAB && wasWet && engine.abLightOffSec <= 0) {
    engine.abLightOffSec = 0.35
  }
  if (engine.abLightOffSec > 0) {
    engine.abLightOffSec = Math.max(0, engine.abLightOffSec - dt)
    const wetHold = idle + (wetMax - idle) * spec.engine.afterburnerThrottleMin
    commanded = Math.max(commanded, wetHold * (engine.abLightOffSec / 0.35))
  }

  const tau = Math.max(0.05, spec.engine.spoolTimeSec)
  const alpha = 1 - Math.exp(-dt / tau)
  engine.thrustN += (commanded - engine.thrustN) * alpha
  return engine.thrustN
}

/**
 * Net engine thrust (N) at the given throttle and altitude, accounting for AB
 * step, idle floor, ISA thrust lapse, and damage penalty.
 */
export function computeActualThrustN(
  spec: AircraftSpec,
  throttle: number,
  altM: number,
  thrustMultiplier = 1,
  fuelKg = 1,
  engineThrustN?: number,
): number {
  if (fuelKg <= 0) return 0
  const base = engineThrustN ?? computeCommandedThrustN(spec, throttle)
  return base * thrustLapseFactor(altM) * thrustMultiplier
}

// ─── Derived flight state (HUD / instruments) ────────────────────────────────

/**
 * Compute derived flight state for HUD/instruments.
 *
 * Pass `controls` (the shaped+FCS-limited inputs that were fed to the integrator)
 * and `flapCL` so that G-load includes elevator and flap lift contributions,
 * matching what the integrator actually applied.  Both are optional for callers
 * that only need aero angles / attitude.
 */
export function computeDerivedState(
  sv: StateVec,
  spec: AircraftSpec,
  massKg: number,
  controls?: ControlInputs,
  flapCL = 0,
) {
  const kin = computeFlightKinematics(sv)
  const { altM, vz, qw, qx, qy, qz, pRate, qRate, rRate, speedMS, atm, mach, alphaDeg, betaDeg, vt } = kin

  // IAS approximation
  const iasMS = speedMS * Math.sqrt(atm.densityKgM3 / 1.225)
  const iasKts = iasMS * 1.94384

  const qBar = atm.dynamicPressurePa
  const S    = spec.mass.wingAreaM2

  // Base aero coefficients (CL, CD from alpha/Mach tables).
  const aeroCoeffs = computeAeroCoeffs(
    spec.aero, alphaDeg, betaDeg, mach,
    pRate, qRate, rRate, spec.mass.wingspanM, spec.mass.macM, vt,
  )

  // Total CL: match what the integrator used (base + elevator delta + flap).
  // When controls are not supplied fall back to table-only (used by non-physics callers).
  let totalCL = aeroCoeffs.CL
  if (controls) {
    const maxPitchRad = 28 * DEG2RAD
    const pitchRad = clamp(-controls.pitch * maxPitchRad, -maxPitchRad, maxPitchRad)
    const ctrlDeltas = computeControlDeltas(spec.controlEffectiveness, mach, pitchRad, 0, 0)
    totalCL += ctrlDeltas.dCL + flapCL
  }

  // Body-frame aerodynamic z-force (negative = lift, per wind-axis → body rotation).
  // G = accelerometer reading perpendicular to velocity: -Fz_aero / (m·g₀)
  const alphaRad = alphaDeg * DEG2RAD
  const Fz_aero  = (-aeroCoeffs.CD * Math.sin(alphaRad) - totalCL * Math.cos(alphaRad)) * qBar * S
  const gCurrent = -Fz_aero / (massKg * G0)

  const attitude = eulerFromQuat(qw, qx, qy, qz)

  return {
    alphaDeg, betaDeg, mach, iasKts, altitudeM: altM,
    gCurrent, yaw: attitude.yaw, pitch: attitude.pitch, roll: attitude.roll, speedMS,
    vviMps: -vz,  // NED: negative z = upward
    headingDeg: attitude.headingDeg,
  }
}

