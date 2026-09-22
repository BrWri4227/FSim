import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import type { Aircraft } from '../../entities/Aircraft'
import { v3sub, v3len, quatRotateVec, quatConjugate, RAD2DEG } from '../../utils/MathUtils'
import { neutralControls } from '../../input/neutralControls'

const COVER_DIST_M = 650
const COVER_LATERAL_M = 380
const COVER_ALT_OFFSET_M = 120

/**
 * Combat spread cover — offset high-right behind the flight lead, watching for threats.
 * Distinct from REJOIN (direct trail) and ENGAGE (BVR/WVR fight).
 */
export function coverLeader(self: AIAircraft, leader: Aircraft, _dt: number): ControlInputs {
  const leaderPos = leader.state.positionNED
  const selfPos = self.state.positionNED

  const bodyBack: [number, number, number] = [-1, 0, 0]
  const bodyRight: [number, number, number] = [0, 1, 0]
  const leaderBack = quatRotateVec(leader.state.attitudeQuat, bodyBack)
  const leaderRight = quatRotateVec(leader.state.attitudeQuat, bodyRight)

  const desired: [number, number, number] = [
    leaderPos[0] + leaderBack[0] * COVER_DIST_M + leaderRight[0] * COVER_LATERAL_M,
    leaderPos[1] + leaderBack[1] * COVER_DIST_M + leaderRight[1] * COVER_LATERAL_M,
    leaderPos[2] + leaderBack[2] * COVER_DIST_M + leaderRight[2] * COVER_LATERAL_M - COVER_ALT_OFFSET_M,
  ]

  const toDesired = v3sub(desired, selfPos)
  const dist = v3len(toDesired)
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toDesired)
  const azErr = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG
  const elErr = Math.atan2(-bodyDir[2], bodyDir[0]) * RAD2DEG

  const speedErr = leader.state.iasKts - self.state.iasKts
  const throttle = Math.max(0, Math.min(1, self.state.throttle + speedErr * 0.002 + (dist > COVER_DIST_M * 1.2 ? 0.12 : -0.04)))
  const pitch = Math.max(-1, Math.min(1, elErr / 18))
  const roll = Math.max(-1, Math.min(1, azErr / 18))

  return neutralControls({ pitch, roll, throttle })
}
