import type { ControlInputs, AircraftSpec, AircraftState } from '../types/aircraft'
import { clamp } from '../utils/MathUtils'

// Flight Control System: apply G and AoA limits to control inputs
export function applyFCSLimits(
  controls: ControlInputs,
  state: AircraftState,
  spec: AircraftSpec
): ControlInputs {
  let pitch = controls.pitch
  let roll = controls.roll
  let yaw = controls.yaw

  // Symmetric AoA limiter: protect both upright and inverted maneuvering.
  const alphaAbs = Math.abs(state.alphaDeg)
  const aoaMargin = spec.maxAoADeg - alphaAbs
  if (aoaMargin < 8 && Math.abs(controls.pitch) > 0) {
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

  // Soften lateral authority near the AoA edge to reduce departure-like wobble.
  const aoaFrac = clamp(alphaAbs / Math.max(spec.maxAoADeg, 1), 0, 1)
  const lateralScale = 1 - 0.35 * clamp((aoaFrac - 0.65) / 0.35, 0, 1)
  roll *= lateralScale
  yaw *= lateralScale

  return { ...controls, pitch, roll, yaw }
}
