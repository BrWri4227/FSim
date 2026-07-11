import type { AtmosphericFactors } from '../types/common'
import { computeAtmosphere } from './Atmosphere'
import { windNEDAt } from './WeatherState'
import { clamp, RAD2DEG } from '../utils/MathUtils'

/** Wind-relative flight kinematics shared by the integrator and HUD/instruments. */
export interface FlightKinematics {
  altM: number
  vx: number
  vy: number
  vz: number
  qw: number
  qx: number
  qy: number
  qz: number
  pRate: number
  qRate: number
  rRate: number
  avx: number
  avy: number
  avz: number
  speedMS: number
  atm: AtmosphericFactors
  mach: number
  u: number
  v_b: number
  w: number
  vt: number
  alphaDeg: number
  betaDeg: number
}

/** Rotate NED velocity into body frame (inline conjugate quaternion rotation). */
export function nedVelocityToBody(
  avx: number, avy: number, avz: number,
  qw: number, qx: number, qy: number, qz: number,
): { u: number; v_b: number; w: number; vt: number } {
  const velTx = 2 * (-qy * avz + qz * avy)
  const velTy = 2 * (-qz * avx + qx * avz)
  const velTz = 2 * (-qx * avy + qy * avx)
  const u   = avx + qw * velTx - qy * velTz + qz * velTy
  const v_b = avy + qw * velTy - qz * velTx + qx * velTz
  const w   = avz + qw * velTz - qx * velTy + qy * velTx
  const vt  = Math.max(Math.sqrt(u * u + v_b * v_b + w * w), 0.1)
  return { u, v_b, w, vt }
}

export function computeFlightKinematics(sv: ArrayLike<number>): FlightKinematics {
  const vx = sv[3]!, vy = sv[4]!, vz = sv[5]!
  const qw = sv[6]!, qx = sv[7]!, qy = sv[8]!, qz = sv[9]!
  const pRate = sv[10]!, qRate = sv[11]!, rRate = sv[12]!
  const altM = -sv[2]!

  const wind = windNEDAt(altM)
  const avx = vx - wind[0]
  const avy = vy - wind[1]
  const avz = vz - wind[2]
  const speedMS = Math.sqrt(avx * avx + avy * avy + avz * avz)
  const atm = computeAtmosphere(altM, speedMS)
  const mach = speedMS / Math.max(atm.speedOfSoundMS, 1)

  const { u, v_b, w, vt } = nedVelocityToBody(avx, avy, avz, qw, qx, qy, qz)
  const alphaDeg = Math.atan2(w, Math.max(u, 0.1)) * RAD2DEG
  const betaDeg  = Math.asin(clamp(v_b / vt, -1, 1)) * RAD2DEG

  return {
    altM, vx, vy, vz, qw, qx, qy, qz, pRate, qRate, rRate,
    avx, avy, avz, speedMS, atm, mach, u, v_b, w, vt, alphaDeg, betaDeg,
  }
}

export function eulerFromQuat(qw: number, qx: number, qy: number, qz: number): {
  yaw: number
  pitch: number
  roll: number
  headingDeg: number
} {
  const yaw   = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) * RAD2DEG
  const pitch = Math.asin(clamp(2 * (qw * qy - qz * qx), -1, 1)) * RAD2DEG
  const roll  = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy)) * RAD2DEG
  return { yaw, pitch, roll, headingDeg: (yaw + 360) % 360 }
}
