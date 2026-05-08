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
  if (aoaMargin < 5 && controls.pitch > 0) {
    pitch *= clamp(aoaMargin / 5, 0, 1)
  }

  // G limiter
  if (state.gCurrent > spec.maxGPositive - 0.5 && controls.pitch > 0) {
    pitch *= 0.2
  }
  if (state.gCurrent < spec.maxGNegative + 0.5 && controls.pitch < 0) {
    pitch *= 0.2
  }

  return { ...controls, pitch }
}
