import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'

export function turnConstantly(self: AIAircraft, _dt: number): ControlInputs {
  // Constant 60° bank turn, maintaining altitude with pitch
  const altErr  = self.state.positionNED[2] - self.initPositionNED[2]
  const pitch   = Math.max(-0.3, Math.min(0.6, altErr * 0.01 + 0.15))  // pull up slightly to maintain alt in turn
  const roll    = 0.6   // sustained bank
  const throttle = 0.75

  return { pitch, roll, yaw: 0, throttle, fireMissile: false, fireGun: false, cycleMissile: false, dispenseFlare: false, dispenseChaff: false, radarModeNext: false }
}
