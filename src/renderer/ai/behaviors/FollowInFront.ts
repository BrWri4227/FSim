import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import type { Aircraft } from '../../entities/Aircraft'
import { v3sub, v3len, quatRotateVec, quatConjugate, RAD2DEG } from '../../utils/MathUtils'

const LEAD_DIST_M = 500

export function followInFront(self: AIAircraft, leader: Aircraft, _dt: number): ControlInputs {
  const leaderPos = leader.state.positionNED
  const selfPos   = self.state.positionNED

  const bodyFwd: [number,number,number] = [1, 0, 0]
  const leaderFwd = quatRotateVec(leader.state.attitudeQuat, bodyFwd)
  const desired: [number,number,number] = [
    leaderPos[0] + leaderFwd[0] * LEAD_DIST_M,
    leaderPos[1] + leaderFwd[1] * LEAD_DIST_M,
    leaderPos[2] + leaderFwd[2] * LEAD_DIST_M
  ]

  const toDesired = v3sub(desired, selfPos)
  const dist      = v3len(toDesired)
  const bodyDir   = quatRotateVec(quatConjugate(self.state.attitudeQuat), toDesired)
  const azErr     = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG
  const elErr     = Math.atan2(-bodyDir[2], bodyDir[0]) * RAD2DEG

  const speedErr  = leader.state.iasKts - self.state.iasKts
  const throttle  = Math.max(0, Math.min(1, self.state.throttle + speedErr * 0.002 + (dist > LEAD_DIST_M ? 0.1 : -0.05)))
  // Positive elErr = desired is above the nose → pitch UP (positive command).
  const pitch     = Math.max(-1, Math.min(1,  elErr / 18))
  const roll      = Math.max(-1, Math.min(1,  azErr / 18))

  return { pitch, roll, yaw: 0, throttle, fireMissile: false, fireGun: false, cycleMissile: false, dispenseFlare: false, dispenseChaff: false, toggleGear: false, cycleFlaps: false, brakeHeld: false, speedBrakeToggle: false, radarModeNext: false, radarSelectNext: false, radarLockTarget: false, radarUnlock: false, ejectRequested: false }
}
