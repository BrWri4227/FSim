import type { MissileState } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import type { Vec3 } from '../types/common'
import { v3sub, v3add, v3scale, v3dot, v3len, v3norm, v3cross } from '../utils/MathUtils'

export function computePNAcceleration(
  missilePos: Vec3,
  missileVel: Vec3,
  targetPos: Vec3,
  targetVel: Vec3,
  prevLOS: Vec3,
  navigationConstant: number,
  dt: number
): { accel: Vec3; newLOS: Vec3 } {
  const los = v3norm(v3sub(targetPos, missilePos))
  const relVel = v3sub(targetVel, missileVel)
  const closingSpeed = -v3dot(relVel, los)

  // LOS rate (angular velocity of LOS vector)
  const dlos = v3scale(v3sub(los, prevLOS), 1 / dt)
  const omega = v3cross(los, dlos)  // LOS angular rate

  // PN: a = N' * Vc * omega_LOS × unit_LOS
  const aPNMag = navigationConstant * closingSpeed
  const accel: Vec3 = [
    aPNMag * omega[0],
    aPNMag * omega[1],
    aPNMag * omega[2]
  ]

  return { accel, newLOS: los }
}

export function guideMissile(missile: MissileState, targetState: AircraftState, dt: number): Vec3 {
  const { accel, newLOS } = computePNAcceleration(
    missile.positionNED,
    missile.velocityNED,
    targetState.positionNED,
    targetState.velocityNED,
    missile.prevLOSUnit,
    missile.spec.navigationConstant,
    dt
  )
  missile.prevLOSUnit = newLOS

  // Clamp to max G overload
  const G0 = 9.80665
  const maxAccel = missile.spec.maxGOverload * G0
  const accelMag = v3len(accel)
  if (accelMag > maxAccel) {
    return v3scale(accel, maxAccel / accelMag)
  }
  return accel
}
