import type { ControlInputs } from '../types/aircraft'
import type { AIAircraft } from './AIAircraft'
import type { Aircraft } from '../entities/Aircraft'
import { followBehind }   from './behaviors/FollowBehind'
import { followInFront }  from './behaviors/FollowInFront'
import { flyStraight }    from './behaviors/FlyStraight'
import { turnConstantly } from './behaviors/TurnConstantly'
import { bvrEngage }      from './behaviors/BVREngage'
import { evadeMissile, type MissileThreat } from './behaviors/EvadeMissile'
import { avoidance }      from './behaviors/Avoidance'

const DEFENSIVE_RANGE_M = 8000   // start defending when missile is closer than this
const DEFENSIVE_TIME_MARGIN_S = 18

/**
 * Pick the most pressing inbound missile (lowest time-to-impact within range).
 * Returns null if nothing is threatening enough to warrant overriding the primary behaviour.
 */
function findLeadingThreat(self: AIAircraft, threats: MissileThreat[]): MissileThreat | null {
  if (threats.length === 0) return null
  let worst: MissileThreat | null = null
  let worstTimeS = Infinity
  for (const t of threats) {
    const dx = t.positionNED[0] - self.state.positionNED[0]
    const dy = t.positionNED[1] - self.state.positionNED[1]
    const dz = t.positionNED[2] - self.state.positionNED[2]
    const range = Math.hypot(dx, dy, dz)
    if (range > DEFENSIVE_RANGE_M * 2) continue
    // Closing speed via dot of relative velocity onto -LOS.
    const vrx = t.velocityNED[0] - self.state.velocityNED[0]
    const vry = t.velocityNED[1] - self.state.velocityNED[1]
    const vrz = t.velocityNED[2] - self.state.velocityNED[2]
    const closing = -(dx * vrx + dy * vry + dz * vrz) / Math.max(range, 1)
    if (closing < 50) continue
    const tti = range / closing
    if (tti < worstTimeS && tti < DEFENSIVE_TIME_MARGIN_S) {
      worstTimeS = tti
      worst = t
    }
  }
  return worst
}

export function runAIBrain(self: AIAircraft, player: Aircraft, dt: number, inboundThreats: MissileThreat[] = []): ControlInputs {
  // Defensive override — any inbound missile within the threat envelope preempts
  // the primary behaviour. Resumes once the threat opens or impacts.
  const threat = findLeadingThreat(self, inboundThreats)
  if (threat) return evadeMissile(self, threat, dt)

  switch (self.behavior) {
    case 'FOLLOW_BEHIND':  return followBehind(self, player, dt)
    case 'FOLLOW_IN_FRONT': return followInFront(self, player, dt)
    case 'FLY_STRAIGHT':   return flyStraight(self, dt)
    case 'TURN_CONSTANTLY': return turnConstantly(self, dt)
    case 'BVR_ENGAGE':     return bvrEngage(self, player, dt)
    case 'AVOIDANCE':      return avoidance(self, dt)
  }
}
