import type { IRSeekerSpec } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import type { AircraftSpec } from '../types/aircraft'
import type { Vec3 } from '../types/common'
import { v3sub, v3norm, v3dot, v3len, RAD2DEG, DEG2RAD } from '../utils/MathUtils'

export function computeHeatSignatureKW(
  spec: AircraftSpec,
  state: AircraftState,
  seekerToTargetNED: Vec3
): number {
  const dir = v3norm(seekerToTargetNED)
  // tail-on: seeker sees nozzle
  const bodyForwardNED = [
    2*state.attitudeQuat[0]*state.attitudeQuat[1],
    state.attitudeQuat[0]**2 - state.attitudeQuat[1]**2,
    0
  ] as Vec3 // approximate

  // Aspect: dot of missile-to-target with target's forward
  const forward = [state.attitudeQuat[0], state.attitudeQuat[1], state.attitudeQuat[2]] as Vec3
  const aspect = v3dot(dir, forward)   // 1=head-on, -1=tail-on

  // Tail-on has highest signature
  const aspectFactor = 1.0 + Math.max(0, -aspect) * 3.0
  return spec.heatSignatureBaseKW * aspectFactor * (0.5 + state.throttle * 0.5)
}

export function angleBetweenVecsRad(a: Vec3, b: Vec3): number {
  const dot = v3dot(v3norm(a), v3norm(b))
  return Math.acos(Math.max(-1, Math.min(1, dot)))
}

export function canSeekerLock(
  seekerSpec: IRSeekerSpec,
  heatKW: number,
  offsetFromBoresightDeg: number
): boolean {
  return offsetFromBoresightDeg <= seekerSpec.gimbalLimitDeg &&
         heatKW >= seekerSpec.minHeatSignatureKW
}

export function evaluateFlareSeduction(
  seekerSpec: IRSeekerSpec,
  targetHeatKW: number,
  flareHeatKW: number
): boolean {
  if (flareHeatKW < targetHeatKW * 1.5) return false
  const susceptibility = 1 - seekerSpec.flareRejectionCapability
  return Math.random() < susceptibility
}
