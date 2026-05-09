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

  // AoA limiter: constrain only inputs that increase |AoA|.
  // This keeps recovery authority at high alpha and allows reaching the
  // intended F-16 regime (~25-28 deg) instead of clamping too early.
  const alphaAbs = Math.abs(state.alphaDeg)
  const alphaSign = state.alphaDeg >= 0 ? 1 : -1
  const alphaIncreasing = alphaAbs < 0.5
    ? Math.abs(controls.pitch) > 0
    : controls.pitch * alphaSign > 0
  const aoaMargin = spec.maxAoADeg - alphaAbs
  const softBandDeg = 3.0
  const hardOvershootDeg = 2.0
  if (alphaIncreasing) {
    if (alphaAbs >= spec.maxAoADeg + hardOvershootDeg) {
      pitch = 0
    } else if (aoaMargin < softBandDeg) {
      pitch *= clamp(aoaMargin / softBandDeg, 0.1, 1)
    }
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
  const lateralScale = 1 - 0.18 * clamp((aoaFrac - 0.80) / 0.20, 0, 1)
  roll *= lateralScale
  yaw *= lateralScale

  return { ...controls, pitch, roll, yaw }
}
