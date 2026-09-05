import type { ControlInputs } from '../../types/aircraft'
import type { AIAircraft } from '../AIAircraft'
import type { Aircraft } from '../../entities/Aircraft'
import { v3sub, v3len, v3add, v3scale, quatRotateVec, quatConjugate, RAD2DEG, clamp } from '../../utils/MathUtils'
import { neutralControls } from '../../input/neutralControls'

const MERGE_RANGE_M = 5000
const IR_FIRE_RANGE_M = 3500
const GUN_RANGE_M = 1200
const IR_AZ_LIMIT_DEG = 35
const GUN_AZ_LIMIT_DEG = 8
const EXTEND_CLOSURE_MS = 70   // pull vertical when closing this fast inside gun range

/** Exported so BVREngage can delegate at merge range. */
export const WVR_MERGE_RANGE_M = MERGE_RANGE_M

/**
 * WVR / merge engagement:
 *   1. ENERGY  — extend vertically when about to overshoot; max AB when slow
 *   2. IR SHOT  — inside ~3.5 km, aspect < 35°, fire IR missile
 *   3. GUN TRACK — lead-computed pipper inside ~1.2 km
 */
export function wvrEngage(self: AIAircraft, target: Aircraft, _dt: number): ControlInputs {
  const relPos = v3sub(target.state.positionNED, self.state.positionNED)
  const relVel = v3sub(target.state.velocityNED, self.state.velocityNED)
  const range = v3len(relPos)

  // Simple lead point for gun solution (constant-velocity intercept).
  const closing = -(relPos[0] * relVel[0] + relPos[1] * relVel[1] + relPos[2] * relVel[2]) / Math.max(range, 1)
  const leadT = closing > 20 ? Math.min(range / closing, 3) : 0.5
  const leadPos = v3add(target.state.positionNED, v3scale(target.state.velocityNED, leadT))
  const toLead = v3sub(leadPos, self.state.positionNED)

  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toLead)
  const azDeg = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG
  const elDeg = Math.atan2(-bodyDir[2], Math.max(0.1, bodyDir[0])) * RAD2DEG

  const aspectBody = quatRotateVec(quatConjugate(self.state.attitudeQuat), relPos)
  const aspectDeg = Math.abs(Math.atan2(aspectBody[1], aspectBody[0]) * RAD2DEG)

  const iasDelta = self.state.iasKts - target.state.iasKts
  const irCooldown = self.wvrFireCooldownSec ?? 0
  const stockedIR = self.getRemainingIR?.() ?? 0
  const gunRounds = self.gun.getRoundsRemaining()

  let fireMissile = false
  if (
    irCooldown <= 0 &&
    stockedIR > 0 &&
    range < IR_FIRE_RANGE_M &&
    aspectDeg < IR_AZ_LIMIT_DEG &&
    Math.abs(azDeg) < IR_AZ_LIMIT_DEG
  ) {
    fireMissile = true
  }

  const onGunSolution =
    gunRounds > 0 &&
    range < GUN_RANGE_M &&
    Math.abs(azDeg) < GUN_AZ_LIMIT_DEG &&
    Math.abs(elDeg) < 12

  // Energy fighting: extend vertically when closing fast (overshoot risk).
  let pitchTarget = elDeg
  let rollTarget = azDeg
  let throttle = 1.0

  if (closing > EXTEND_CLOSURE_MS && range < 1800) {
    pitchTarget = 25
    rollTarget = azDeg * 0.4
  } else if (iasDelta < -40 && range < 2500) {
    // Slower than bandit — prioritize nose-on and max power.
    throttle = 1.0
    rollTarget = azDeg
    pitchTarget = elDeg + 4
  } else if (iasDelta > 60 && range < 2000) {
    // Faster — bleed energy with a slight climb before re-engaging.
    pitchTarget = Math.max(elDeg, 12)
    throttle = 0.85
  }

  const pitch = clamp(pitchTarget / 16, -0.5, 0.95)
  const roll = clamp(rollTarget / 16, -1, 1)

  return neutralControls({ pitch, roll, throttle, fireMissile, fireGun: onGunSolution })
}
