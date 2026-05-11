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

const NOTCH_BEAM_DEG   = 90
const FULL_AB_THROTTLE = 1.0
const NOTCH_DESCENT_FT = 1500
const RADAR_DESCENT_FT = 2500   // steeper terrain masking for radar threats

// IR break turn: bank toward the threat and max-G pull.
// Forces the seeker to track maximum angular rate; flares distract the heat seeker.
function evadeIR(self: AIAircraft, threat: MissileThreat): ControlInputs {
  const toMissile = v3sub(threat.positionNED, self.state.positionNED)
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toMissile)
  const azDeg = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG

  return {
    pitch: 0.9,
    roll: clamp(azDeg / 20, -1, 1),
    yaw: 0,
    throttle: FULL_AB_THROTTLE,
    fireMissile: false, fireGun: false, cycleMissile: false,
    dispenseFlare: true, dispenseChaff: false,
    toggleGear: false, cycleFlaps: false, brakeHeld: false, speedBrakeToggle: false,
    radarModeNext: false, radarSelectNext: false, radarLockTarget: false, radarUnlock: false,
    ejectRequested: false, tgpToggle: false, tgpLock: false, tgpUnlock: false,
    wingmanEngage: false, wingmanCover: false, wingmanRTB: false, wingmanRejoin: false,
  }
}

// Radar notch + terrain dive: threat at 90° off nose minimizes Doppler closing rate.
// 2500 ft descent adds terrain clutter and bleeds missile energy.
function evadeRadar(self: AIAircraft, threat: MissileThreat): ControlInputs {
  const toMissile = v3sub(threat.positionNED, self.state.positionNED)
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toMissile)
  const azDeg = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG

  const targetAz = azDeg >= 0 ? NOTCH_BEAM_DEG : -NOTCH_BEAM_DEG
  const azErr = targetAz - azDeg
  const altErr = self.state.positionNED[2] - (self.initPositionNED[2] + RADAR_DESCENT_FT * 0.3048)

  return {
    pitch: clamp(altErr * 0.018 - self.state.vviMps * 0.05 - 0.45, -0.6, 0.7),
    roll: clamp(azErr / 30, -1, 1),
    yaw: 0,
    throttle: FULL_AB_THROTTLE,
    fireMissile: false, fireGun: false, cycleMissile: false,
    dispenseFlare: false, dispenseChaff: true,
    toggleGear: false, cycleFlaps: false, brakeHeld: false, speedBrakeToggle: false,
    radarModeNext: false, radarSelectNext: false, radarLockTarget: false, radarUnlock: false,
    ejectRequested: false, tgpToggle: false, tgpLock: false, tgpUnlock: false,
    wingmanEngage: false, wingmanCover: false, wingmanRTB: false, wingmanRejoin: false,
  }
}

// Unknown guidance: notch + both countermeasures (original behavior preserved).
function evadeUnknown(self: AIAircraft, threat: MissileThreat): ControlInputs {
  const toMissile = v3sub(threat.positionNED, self.state.positionNED)
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toMissile)
  const azDeg = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG

  const targetAz = azDeg >= 0 ? NOTCH_BEAM_DEG : -NOTCH_BEAM_DEG
  const azErr = targetAz - azDeg
  const altErr = self.state.positionNED[2] - (self.initPositionNED[2] + NOTCH_DESCENT_FT * 0.3048)

  return {
    pitch: clamp(altErr * 0.020 - self.state.vviMps * 0.05 - 0.3, -0.5, 0.7),
    roll: clamp(azErr / 30, -1, 1),
    yaw: 0,
    throttle: FULL_AB_THROTTLE,
    fireMissile: false, fireGun: false, cycleMissile: false,
    dispenseFlare: threat.guidance !== 'RADAR',
    dispenseChaff: threat.guidance !== 'IR',
    toggleGear: false, cycleFlaps: false, brakeHeld: false, speedBrakeToggle: false,
    radarModeNext: false, radarSelectNext: false, radarLockTarget: false, radarUnlock: false,
    ejectRequested: false, tgpToggle: false, tgpLock: false, tgpUnlock: false,
    wingmanEngage: false, wingmanCover: false, wingmanRTB: false, wingmanRejoin: false,
  }
}

export function evadeMissile(self: AIAircraft, threat: MissileThreat, _dt: number): ControlInputs {
  if (threat.guidance === 'IR')    return evadeIR(self, threat)
  if (threat.guidance === 'RADAR') return evadeRadar(self, threat)
  return evadeUnknown(self, threat)
}
