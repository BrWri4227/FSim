import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import type { Aircraft } from '../../entities/Aircraft'
import { v3sub, v3len, quatRotateVec, quatConjugate, RAD2DEG } from '../../utils/MathUtils'

const FOLLOW_DIST_M = 700

export function followBehind(self: AIAircraft, leader: Aircraft, _dt: number): ControlInputs {
  const leaderPos = leader.state.positionNED
  const selfPos   = self.state.positionNED

  // Desired position: 700m behind leader (along leader's -X body axis)
  const bodyBack: [number,number,number] = [-1, 0, 0]
  const leaderBack = quatRotateVec(leader.state.attitudeQuat, bodyBack)
  const desired: [number,number,number] = [
    leaderPos[0] + leaderBack[0] * FOLLOW_DIST_M,
    leaderPos[1] + leaderBack[1] * FOLLOW_DIST_M,
    leaderPos[2] + leaderBack[2] * FOLLOW_DIST_M
  ]

  const toDesired = v3sub(desired, selfPos)
  const dist      = v3len(toDesired)

  // Express desired direction in own body frame
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toDesired)
  const azErr   = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG
  const elErr   = Math.atan2(-bodyDir[2], bodyDir[0]) * RAD2DEG

  // Speed control: match leader + correction for distance error
  const speedErr   = leader.state.iasKts - self.state.iasKts
  const throttle   = Math.max(0, Math.min(1, self.state.throttle + speedErr * 0.002 + (dist > FOLLOW_DIST_M ? 0.1 : -0.05)))
  const pitch      = Math.max(-1, Math.min(1, -elErr / 20))
  const roll       = Math.max(-1, Math.min(1,  azErr / 20))

  return { pitch, roll, yaw: 0, throttle, fireMissile: false, fireGun: false, cycleMissile: false, dispenseFlare: false, dispenseChaff: false, radarModeNext: false, radarSelectNext: false, radarLockTarget: false, radarUnlock: false }
}
