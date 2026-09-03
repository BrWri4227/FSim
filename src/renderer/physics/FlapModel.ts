import { clamp } from '../utils/MathUtils'

/**
 * Flap aerodynamics.
 *
 * Discrete positions: 0 = up, 1 = takeoff (~20°), 2 = landing (~40°).
 * Trailing-edge flaps add camber, so each deployed position contributes:
 *   - a lift increment       — fly slower / hold a lower nose attitude on approach
 *   - a profile-drag increment
 *   - a nose-down pitching moment the pilot trims out with a little aft stick
 *
 * Flaps are NOT locked out by airspeed. Past the placard speed they "blow
 * back" toward trail: aerodynamic hinge load overpowers the actuator, so the
 * effective deflection — and every increment below — decays smoothly to a
 * small residual. Selecting flaps fast is draggy and pitchy but not
 * catastrophic, and it buys almost no lift — which is the real trade-off.
 *
 * Simplification: the lift increment is added uniformly to CL rather than
 * reshaping the lift curve, so this model raises usable CL_max without also
 * lowering the stall AoA. That is consistent with the rest of the
 * table-driven aero (which has no sharp stall break) and is close enough for
 * approach and takeoff handling.
 */

/** ΔCL at each flap position, at full effectiveness. */
const FLAP_CL = [0, 0.40, 0.85] as const
/** ΔCD at each flap position, at full effectiveness. */
const FLAP_CD = [0, 0.018, 0.065] as const
/** ΔCm at each flap position (nose-down, negative), at full effectiveness. */
const FLAP_CM = [0, -0.006, -0.014] as const

/** Placard speed (KIAS); above it the position begins to blow back. */
export const FLAP_PLACARD_KTS = [Infinity, 250, 210] as const
/** Overspeed past the placard (kt) at which blow-back reaches the residual floor. */
const BLOWBACK_RANGE_KTS = 260
/** Fraction of the flap effect that survives full blow-back. */
const BLOWBACK_FLOOR = 0.1

export interface FlapAero {
  flapCL: number
  flapCD: number
  flapCm: number
  /** True when the selected position is past its placard and losing effectiveness. */
  blownBack: boolean
}

const NO_FLAP: FlapAero = { flapCL: 0, flapCD: 0, flapCm: 0, blownBack: false }

/**
 * Lift / drag / pitching-moment increments for the current flap selection,
 * with airspeed blow-back applied.
 */
export function computeFlapAero(flaps: 0 | 1 | 2, iasKts: number): FlapAero {
  if (flaps === 0) return NO_FLAP
  const overspeed = Math.max(0, iasKts - FLAP_PLACARD_KTS[flaps])
  const eff = clamp(1 - overspeed / BLOWBACK_RANGE_KTS, BLOWBACK_FLOOR, 1)
  return {
    flapCL: FLAP_CL[flaps] * eff,
    flapCD: FLAP_CD[flaps] * eff,
    flapCm: FLAP_CM[flaps] * eff,
    blownBack: overspeed > 0,
  }
}
