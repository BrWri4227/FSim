import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import { clamp } from '../../utils/MathUtils'

export function flyStraight(self: AIAircraft, _dt: number): ControlInputs {
  // NED: positive Z = Down.  altErr > 0 → aircraft is below its target altitude.
  const altErr = self.state.positionNED[2] - self.initPositionNED[2]

  // vviMps: positive = climbing, negative = descending (computed as -vel[2] in NED).
  // Derivative term: counter descents before altitude error grows large.
  const vvi = self.state.vviMps

  // PD altitude hold.  The old formula included `pitchDeg * -0.03` which fought
  // the trim state and caused early nose-down commands → fixed by removing it.
  const pitch = clamp(altErr * 0.030 - vvi * 0.06, -0.40, 0.55)

  // Wings-level: proportional roll correction
  const roll = clamp(-self.state.rollDeg * 0.07, -0.5, 0.5)

  // Maintain sustainable cruise throttle
  const throttle = 0.72

  return {
    pitch, roll, yaw: 0, throttle,
    fireMissile: false, fireGun: false, cycleMissile: false,
    dispenseFlare: false, dispenseChaff: false,
    radarModeNext: false, radarSelectNext: false, radarLockTarget: false, radarUnlock: false
  }
}
