import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import { clamp } from '../../utils/MathUtils'

const PATROL_THROTTLE = 0.9
const ALTITUDE_GAIN_M = 152.4   // 500 ft above spawn
const WEAVE_PERIOD_S  = 12      // full S-turn cycle
const WEAVE_BANK_DEG  = 25      // peak bank angle

export function avoidance(self: AIAircraft, _dt: number): ControlInputs {
  const targetAltZ = self.initPositionNED[2] - ALTITUDE_GAIN_M  // NED: lower Z = higher alt
  const altErr = self.state.positionNED[2] - targetAltZ

  const bankRad   = self.state.rollDeg * Math.PI / 180
  const gReq      = 1 / Math.max(0.25, Math.cos(bankRad))
  const pitchTrim = clamp((gReq - 1) * 0.14, 0, 0.5)
  const pitch     = clamp(altErr * 0.030 - self.state.vviMps * 0.06 + pitchTrim, -0.35, 0.70)

  const tSec   = Date.now() / 1000
  const weavCmd = Math.sin((2 * Math.PI * tSec) / WEAVE_PERIOD_S) * WEAVE_BANK_DEG
  const roll   = clamp((weavCmd - self.state.rollDeg) * 0.05, -0.6, 0.6)

  return {
    pitch, roll, yaw: 0, throttle: PATROL_THROTTLE,
    fireMissile: false, fireGun: false, cycleMissile: false,
    dispenseFlare: false, dispenseChaff: false,
    toggleGear: false, cycleFlaps: false, brakeHeld: false, speedBrakeToggle: false,
    radarModeNext: false, radarSelectNext: false, radarLockTarget: false, radarUnlock: false,
    ejectRequested: false, tgpToggle: false, tgpLock: false, tgpUnlock: false,
    wingmanEngage: false, wingmanCover: false, wingmanRTB: false, wingmanRejoin: false,
  }
}
