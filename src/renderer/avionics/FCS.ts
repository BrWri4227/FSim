import type { ControlInputs, AircraftSpec, AircraftState } from '../types/aircraft'
import { clamp } from '../utils/MathUtils'

// Flight Control System: apply G and AoA limits to control inputs
export function applyFCSLimits(
  controls: ControlInputs,
  state: AircraftState,
  spec: AircraftSpec
): ControlInputs {
  let pitch = controls.pitch

  // AoA limiter: reduce pitch authority when approaching AoA limit
  const aoaMargin = spec.maxAoADeg - state.alphaDeg
  if (aoaMargin < 8 && controls.pitch > 0) {
    pitch *= clamp(aoaMargin / 8, 0, 1)
  }

  // G limiter: smooth ramp over 2G margin (avoids jarring cutoff)
  const gUpperMargin = spec.maxGPositive - state.gCurrent
  if (gUpperMargin < 2.0 && controls.pitch > 0) {
    pitch *= clamp(gUpperMargin / 2.0, 0.05, 1.0)
  }
  const gLowerMargin = state.gCurrent - spec.maxGNegative
  if (gLowerMargin < 2.0 && controls.pitch < 0) {
    pitch *= clamp(gLowerMargin / 2.0, 0.05, 1.0)
  }

  return { ...controls, pitch }
}
