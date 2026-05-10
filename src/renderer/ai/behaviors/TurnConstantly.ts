import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import { clamp } from '../../utils/MathUtils'

const TARGET_BANK_DEG = 45   // steady-state bank angle for the orbit

export function turnConstantly(self: AIAircraft, _dt: number): ControlInputs {
  // ── Bank angle control ─────────────────────────────────────────────────────
  // The old code applied a fixed aileron input (roll = 0.6) which never stops
  // rolling → aircraft spirals into the ground.  Instead we hold a target bank.
  const bankErr = TARGET_BANK_DEG - self.state.rollDeg
  const roll = clamp(bankErr * 0.04, -0.5, 0.5)

  // ── Altitude hold with bank compensation ──────────────────────────────────
  // In a banked turn, the lift vector tilts away from vertical.  To maintain
  // altitude the aircraft must pull additional G: G_req = 1 / cos(bank).
  const bankRad   = self.state.rollDeg * Math.PI / 180
  const gReq      = 1 / Math.max(0.25, Math.cos(bankRad))   // e.g. 1.41 at 45°
  const pitchTrim = clamp((gReq - 1) * 0.14, 0, 0.55)       // extra pull for bank

  const altErr = self.state.positionNED[2] - self.initPositionNED[2]
  const vvi    = self.state.vviMps
  const pitch  = clamp(altErr * 0.030 - vvi * 0.06 + pitchTrim, -0.30, 0.80)

  // More throttle needed to offset the extra induced drag in the turn
  const throttle = 0.82

  return {
    pitch, roll, yaw: 0, throttle,
    fireMissile: false, fireGun: false, cycleMissile: false,
    dispenseFlare: false, dispenseChaff: false, toggleGear: false, cycleFlaps: false, brakeHeld: false, speedBrakeToggle: false,
    radarModeNext: false, radarSelectNext: false, radarLockTarget: false, radarUnlock: false, ejectRequested: false,
    tgpToggle: false, tgpLock: false, tgpUnlock: false,
    wingmanEngage: false, wingmanCover: false, wingmanRTB: false, wingmanRejoin: false,
  }
}
