import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import type { Aircraft } from '../../entities/Aircraft'
import { v3sub, v3len, quatRotateVec, quatConjugate, RAD2DEG, clamp } from '../../utils/MathUtils'
import { wvrEngage, WVR_MERGE_RANGE_M } from './WVREngage'
import { neutralControls } from '../../input/neutralControls'

const NO_ESCAPE_RANGE_M = 22000       // Rne — a shot from here is very hard to defeat
const CRANK_AZ_DEG = 35               // off-axis target after firing — drag the missile, stay defensive
const CLOSE_TO_FIRE_M = 70000         // start closing to engage when bandit closer than this

/**
 * Launch envelope, by aspect.
 *
 * A missile's paper max range is what it can fly in a straight line, not a range
 * from which it can catch a manoeuvring target. Firing at that number meant a
 * bandit loosed everything it had the instant you crossed 50 km — shots that had
 * to burn their whole motor just to arrive, then had nothing left to turn with.
 *
 * A head-on target flies into the missile and can be engaged much further out
 * than one running away, which the missile has to chase down.
 */
const HEAD_ON_LAUNCH_RANGE_M = 32000
const TAIL_CHASE_LAUNCH_RANGE_M = 11000
/** Closure at which the envelope is fully open / fully collapsed. */
const CLOSURE_REFERENCE_MS = 500

/**
 * How many of its own missiles a bandit will have airborne against one target.
 *
 * This is the discipline that was missing entirely. Two bandits with four rounds
 * each used to put all eight in the air inside twenty seconds, which no amount
 * of countermeasure work can survive: a defender can beam one bearing, not six.
 * A shooter now commits one missile and waits to see whether it works.
 */
const MAX_SHOTS_IN_FLIGHT_PER_TARGET = 1

/** Minimum gap between launches, so a re-attack is a decision rather than a salvo. */
export const MIN_FIRE_INTERVAL_S = 12

/**
 * Range at which this shot is worth taking, given how fast the target is closing.
 * `closingMS` is positive when the target is coming toward the shooter.
 */
export function launchEnvelopeM(closingMS: number): number {
  const t = clamp((closingMS / CLOSURE_REFERENCE_MS + 1) / 2, 0, 1)
  return TAIL_CHASE_LAUNCH_RANGE_M + (HEAD_ON_LAUNCH_RANGE_M - TAIL_CHASE_LAUNCH_RANGE_M) * t
}

/**
 * BVR engagement profile:
 *   1. CLOSE      — target outside Rmax: fly head-on at full mil
 *   2. SHOOT      — target inside Rmax: fire AMRAAM-class missile
 *   3. CRANK      — turn ~35° off the bandit to drag the missile, watch for return
 *   4. DEFEND     — defensive override is handled by AIBrain (notch + CMDS)
 */
export function bvrEngage(self: AIAircraft, target: Aircraft, dt: number): ControlInputs {
  const toTarget = v3sub(target.state.positionNED, self.state.positionNED)
  const range = v3len(toTarget)
  if (range < WVR_MERGE_RANGE_M) return wvrEngage(self, target, dt)
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toTarget)
  const azDeg = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG
  const elDeg = Math.atan2(-bodyDir[2], Math.max(0.1, bodyDir[0])) * RAD2DEG

  // How fast the bandit is closing on us: positive means it is coming our way.
  const relVel = v3sub(target.state.velocityNED, self.state.velocityNED)
  const closingMS = -(
    (toTarget[0] * relVel[0] + toTarget[1] * relVel[1] + toTarget[2] * relVel[2]) /
    Math.max(range, 1)
  )

  // Fire decision
  let fireMissile = false
  const cooldown = self.bvrFireCooldownSec ?? 0
  const stocked = self.getRemainingARH?.() ?? 0
  const inFlight = self.missilesInFlightAt?.(target.entityId) ?? 0
  const inAzWindow = Math.abs(azDeg) < 25
  const inRangeWindow = range < launchEnvelopeM(closingMS)
  const insideRne = range < NO_ESCAPE_RANGE_M
  if (
    cooldown <= 0 &&
    stocked > 0 &&
    inAzWindow &&
    inRangeWindow &&
    inFlight < MAX_SHOTS_IN_FLIGHT_PER_TARGET
  ) {
    // Trigger one launch this tick — BVR brain will refresh cooldown on AIAircraft side.
    fireMissile = true
  }

  // Crank: if we have a missile in flight (cooldown active) and we're inside Rmax,
  // turn off the bandit by ~35° to keep them at the edge of our radar gimbal while
  // forcing them to defend. Outside Rmax, point at the bandit and close.
  let pitchTarget = elDeg
  let rollTarget = azDeg
  if (cooldown > 0 && cooldown < MIN_FIRE_INTERVAL_S * 0.7 && range < CLOSE_TO_FIRE_M) {
    const crankSide = azDeg >= 0 ? CRANK_AZ_DEG : -CRANK_AZ_DEG
    rollTarget = crankSide - azDeg
  }

  // Throttle: full power BVR until merge-1 (~3 km), then back off so we don't overshoot.
  const throttle = range > 6000 ? 1.0 : insideRne ? 0.9 : 0.85

  const pitch = clamp(pitchTarget / 18, -0.6, 0.8)
  const roll = clamp(rollTarget / 18, -1, 1)

  return neutralControls({ pitch, roll, throttle, fireMissile })
}
