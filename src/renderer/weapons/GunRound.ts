import type { GunRoundState } from '../types/weapons'
import type { Vec3 } from '../types/common'
import { v3add, v3scale, v3len } from '../utils/MathUtils'

const G0 = 9.80665

export function updateGunRound(round: GunRoundState, dt: number): void {
  if (!round.active) return

  // Quadratic drag: F_drag = 0.5 * rho * Cd * A * v^2
  const rho = 1.1   // approximate mid-alt density
  const A = Math.PI * (round.spec.roundDiameterM / 2) ** 2
  const speed = v3len(round.velocityNED)
  const dragAccel = (0.5 * rho * round.spec.ballisticCd * A * speed * speed) / round.spec.roundMassKg

  // Drag decelerates: opposite to velocity direction
  const dragDir: Vec3 = speed > 0 ? [
    -round.velocityNED[0] / speed * dragAccel,
    -round.velocityNED[1] / speed * dragAccel,
    -round.velocityNED[2] / speed * dragAccel
  ] : [0,0,0]

  // Gravity in NED (+z = down)
  const gravity: Vec3 = [0, 0, G0]

  const accel = v3add(dragDir, gravity)
  round.velocityNED = v3add(round.velocityNED, v3scale(accel, dt))
  round.positionNED = v3add(round.positionNED, v3scale(round.velocityNED, dt))
  round.ageSec += dt

  // Deactivate if too old, on ground, or beyond max range
  if (round.ageSec > 5 || round.positionNED[2] > 0) {
    round.active = false
  }
}
