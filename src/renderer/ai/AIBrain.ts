import type { ControlInputs } from '../types/aircraft'
import type { AIAircraft } from './AIAircraft'
import type { Aircraft } from '../entities/Aircraft'
import { followBehind }   from './behaviors/FollowBehind'
import { followInFront }  from './behaviors/FollowInFront'
import { flyStraight }    from './behaviors/FlyStraight'
import { turnConstantly } from './behaviors/TurnConstantly'

export function runAIBrain(self: AIAircraft, player: Aircraft, dt: number): ControlInputs {
  switch (self.behavior) {
    case 'FOLLOW_BEHIND':  return followBehind(self, player, dt)
    case 'FOLLOW_IN_FRONT': return followInFront(self, player, dt)
    case 'FLY_STRAIGHT':   return flyStraight(self, dt)
    case 'TURN_CONSTANTLY': return turnConstantly(self, dt)
  }
}
