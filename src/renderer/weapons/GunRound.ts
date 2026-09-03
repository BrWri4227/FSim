import type { GunRoundState } from '../types/weapons'
import { dragCoefficient, stepProjectile } from '../physics/Ballistics'

export function updateGunRound(round: GunRoundState, dt: number): void {
  if (!round.active) return

  // Quadratic drag + gravity, shared with the HUD gun-lead solver so the
  // reticle predicts the same trajectory the round actually flies.
  const dragK = dragCoefficient(round.spec)
  const next = stepProjectile(round.positionNED, round.velocityNED, dragK, dt)
  round.velocityNED = next.velocityNED
  round.positionNED = next.positionNED
  round.ageSec += dt

  // Deactivate if too old, on ground, or beyond max range
  if (round.ageSec > 5 || round.positionNED[2] > 0) {
    round.active = false
  }
}
