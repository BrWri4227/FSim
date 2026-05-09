import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import { v3sub, quatRotateVec, quatConjugate, RAD2DEG, clamp } from '../../utils/MathUtils'

export interface MissileThreat {
  id: string
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  /** Best guess at seeker type — used to choose flares vs chaff. */
  guidance?: 'IR' | 'RADAR' | 'UNKNOWN'
}

const NOTCH_BEAM_DEG = 90      // ideal beam aspect — perpendicular to threat
const FULL_AB_THROTTLE = 1.0
const NOTCH_DESCENT_FT = 1500  // dive a bit during the notch to bleed the threat

/**
 * Evasive maneuver against an inbound missile:
 *  - Turn so the threat sits ~90° off the nose (the "notch") — defeats Doppler-rate
 *    radar gates and complicates IR seeker tracking.
 *  - Pump flares (IR threats) and chaff (radar threats) on every dispense window.
 *  - Pull a moderate descent to add gravity to the kinematic problem.
 */
export function evadeMissile(self: AIAircraft, threat: MissileThreat, _dt: number): ControlInputs {
  // Vector from self to missile
  const toMissile = v3sub(threat.positionNED, self.state.positionNED)
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toMissile)
  const azDeg = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG

  // Choose notch side: turn so the threat ends up directly off whichever wing is
  // closer (positive azDeg → threat to right, beam right). We want |az| → 90.
  const targetAz = azDeg >= 0 ? NOTCH_BEAM_DEG : -NOTCH_BEAM_DEG
  const azErr = targetAz - azDeg

  // Aggressive bank into the notch direction, with altitude pull-down
  const roll = clamp(azErr / 30, -1, 1)
  const altErr = self.state.positionNED[2] - (self.initPositionNED[2] + NOTCH_DESCENT_FT * 0.3048)
  const pitch = clamp(altErr * 0.020 - self.state.vviMps * 0.05 - 0.3, -0.5, 0.7)

  // Countermeasures: alternate flare + chaff so we cover both seeker types and
  // don't gate on guidance type guesses. Both methods are cooldown-gated in CMDS.
  const wantFlare = threat.guidance !== 'RADAR'
  const wantChaff = threat.guidance !== 'IR'

  return {
    pitch,
    roll,
    yaw: 0,
    throttle: FULL_AB_THROTTLE,
    fireMissile: false,
    fireGun: false,
    cycleMissile: false,
    dispenseFlare: wantFlare,
    dispenseChaff: wantChaff,
    toggleGear: false,
    cycleFlaps: false,
    brakeHeld: false,
    speedBrakeToggle: false,
    radarModeNext: false,
    radarSelectNext: false,
    radarLockTarget: false,
    radarUnlock: false,
    ejectRequested: false,
    tgpToggle: false,
    tgpLock: false,
    tgpUnlock: false,
    wingmanEngage: false,
    wingmanCover: false,
    wingmanRTB: false,
    wingmanRejoin: false,
  }
}
