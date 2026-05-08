import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'

export function flyStraight(self: AIAircraft, _dt: number): ControlInputs {
  // Hold altitude and wings-level
  const altErr   = self.state.positionNED[2] - self.initPositionNED[2]  // +ve = too low in NED
  const pitch    = Math.max(-0.3, Math.min(0.3, altErr * 0.01 + self.state.pitchDeg * -0.03))
  const roll     = Math.max(-0.5, Math.min(0.5, -self.state.rollDeg * 0.04))
  const throttle = 0.6

  return { pitch, roll, yaw: 0, throttle, fireMissile: false, fireGun: false, cycleMissile: false, dispenseFlare: false, dispenseChaff: false, radarModeNext: false }
}
