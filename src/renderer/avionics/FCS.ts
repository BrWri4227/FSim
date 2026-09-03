import type { ControlInputs, AircraftSpec, AircraftState } from '../types/aircraft'
import { clamp, lerp } from '../utils/MathUtils'

/**
 * Flight Control System — "carefree handling" AoA/G limiter.
 *
 * Rather than a hard fence at the placard AoA, this is a soft ceiling that the
 * pilot can lean on (and briefly punch through). The ceiling is speed-scheduled:
 *  - Fast (structural regime): held to the placard AoA / structural G.
 *  - Slow (< ~220 kt IAS): opens up to a post-stall gate so the player can pull
 *    off high-alpha nose-pointing (cobra, J-turn, high-AoA snaps).
 * Pitch authority is never fully zeroed — the stick always does something — with
 * a hard backstop only far past the gate to keep departures recoverable.
 */
export function applyFCSLimits(
  controls: ControlInputs,
  state: AircraftState,
  spec: AircraftSpec,
): ControlInputs {
  let pitch = controls.pitch
  let roll = controls.roll
  let yaw = controls.yaw

  const alphaAbs = Math.abs(state.alphaDeg)
  const alphaSign = state.alphaDeg >= 0 ? 1 : -1
  const alphaIncreasing = alphaAbs < 0.5
    ? Math.abs(controls.pitch) > 0
    : controls.pitch * alphaSign > 0

  // Speed-scheduled AoA ceiling. lowSpeedFrac: 0 above 250 kt, 1 below ~90 kt.
  const lowSpeedFrac = clamp((250 - state.iasKts) / 160, 0, 1)
  const postStallGateDeg = Math.min(72, spec.maxAoADeg * 2.3)
  const aoaCeilingDeg = lerp(spec.maxAoADeg, postStallGateDeg, lowSpeedFrac)

  if (alphaIncreasing) {
    const softBandDeg = 6.0
    const margin = aoaCeilingDeg - alphaAbs
    if (margin < softBandDeg) {
      // Floor at 0.15 — never a dead stick.
      pitch *= clamp(margin / softBandDeg, 0.15, 1)
    }
    // Hard backstop well past the gate: keeps a runaway tumble recoverable.
    if (alphaAbs > aoaCeilingDeg + 15) pitch *= 0.05
  }

  // G limiter: soft ramp over a 2.5 G margin, floored so it never fully cuts.
  const gUpperMargin = spec.maxGPositive - state.gCurrent
  if (gUpperMargin < 2.5 && controls.pitch > 0) {
    pitch *= clamp(gUpperMargin / 2.5, 0.1, 1.0)
  }
  const gLowerMargin = state.gCurrent - spec.maxGNegative
  if (gLowerMargin < 2.0 && controls.pitch < 0) {
    pitch *= clamp(gLowerMargin / 2.0, 0.1, 1.0)
  }

  // Trim lateral authority once well past the placard AoA (departure resistance),
  // but keep most of it so high-alpha rolls still work.
  const aoaFrac = clamp(alphaAbs / Math.max(spec.maxAoADeg, 1), 0, 1)
  const lateralScale = 1 - 0.35 * clamp((aoaFrac - 0.85) / 0.5, 0, 1)
  roll *= lateralScale
  yaw *= lateralScale

  return { ...controls, pitch, roll, yaw }
}
