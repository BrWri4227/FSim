import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import type { Aircraft } from '../../entities/Aircraft'
import { v3sub, v3len, quatRotateVec, quatConjugate, RAD2DEG, clamp } from '../../utils/MathUtils'

const MAX_RANGE_FIRE_M = 50000        // Rmax — outer launch limit
const NO_ESCAPE_RANGE_M = 22000       // Rne — fire if inside this range no matter the aspect
const CRANK_AZ_DEG = 35               // off-axis target after firing — drag the missile, stay defensive
const CLOSE_TO_FIRE_M = 70000         // start closing to engage when bandit closer than this
const MIN_FIRE_INTERVAL_S = 5         // throttle missile launches

/**
 * BVR engagement profile:
 *   1. CLOSE      — target outside Rmax: fly head-on at full mil
 *   2. SHOOT      — target inside Rmax: fire AMRAAM-class missile
 *   3. CRANK      — turn ~35° off the bandit to drag the missile, watch for return
 *   4. DEFEND     — defensive override is handled by AIBrain (notch + CMDS)
 */
export function bvrEngage(self: AIAircraft, target: Aircraft, _dt: number): ControlInputs {
  const toTarget = v3sub(target.state.positionNED, self.state.positionNED)
  const range = v3len(toTarget)
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toTarget)
  const azDeg = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG
  const elDeg = Math.atan2(-bodyDir[2], Math.max(0.1, bodyDir[0])) * RAD2DEG

  // Fire decision
  let fireMissile = false
  const cooldown = self.bvrFireCooldownSec ?? 0
  const stocked = self.getRemainingARH?.() ?? 0
  const inAzWindow = Math.abs(azDeg) < 25
  const inRangeWindow = range < MAX_RANGE_FIRE_M
  const insideRne = range < NO_ESCAPE_RANGE_M
  if (cooldown <= 0 && stocked > 0 && inAzWindow && inRangeWindow) {
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

  return {
    pitch,
    roll,
    yaw: 0,
    throttle,
    fireMissile,
    fireGun: false,
    cycleMissile: false,
    dispenseFlare: false,
    dispenseChaff: false,
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
