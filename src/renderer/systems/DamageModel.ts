import type { DamageState, DamageZone, FlightPenalties } from '../types/damage'
import { clamp } from '../utils/MathUtils'

/**
 * Apply a damage hit to a specific zone.
 * invincible: when true (e.g. debug god-mode), hits are absorbed silently.
 * Returns true if the aircraft is now destroyed (should be removed from simulation).
 */
export function applyHit(dmg: DamageState, zone: DamageZone, severity: number, invincible = false): boolean {
  if (invincible) return false

  dmg.zones[zone] = clamp(dmg.zones[zone] + severity, 0, 1)

  // Engine zone: fire and failure cascade
  if (dmg.zones.ENGINE > 0.65) {
    dmg.onFire = true
  }
  if (dmg.zones.ENGINE > 0.85) {
    dmg.engineFailed = true
  }

  // Fuselage / cockpit hits can cause structural failure
  if (dmg.zones.FUSELAGE > 0.88 || dmg.zones.COCKPIT > 0.80) {
    dmg.engineFailed = true
    dmg.structuralFailure = true
  }

  // Total loss: catastrophic damage in any lethal combination
  const destroyed =
    dmg.zones.ENGINE    >= 1.0 ||
    dmg.zones.FUSELAGE  >= 1.0 ||
    dmg.zones.COCKPIT   >= 1.0 ||
    (dmg.zones.ENGINE > 0.9 && dmg.zones.FUSELAGE > 0.6) ||
    (dmg.zones.WING_LEFT >= 1.0 && dmg.zones.WING_RIGHT >= 1.0)

  if (destroyed) dmg.structuralFailure = true
  return destroyed
}

export function computeFlightPenalties(dmg: DamageState): FlightPenalties {
  const wl   = dmg.zones.WING_LEFT
  const wr   = dmg.zones.WING_RIGHT
  const en   = dmg.zones.ENGINE
  const tail = dmg.zones.TAIL
  const fus  = dmg.zones.FUSELAGE

  // Wing damage reduces roll authority and adds asymmetric drag
  const rollMult  = clamp(1 - (wl + wr) * 0.65, 0.05, 1)
  // Tail damage reduces pitch and yaw authority
  const pitchMult = clamp(1 - tail * 0.75 - fus * 0.25, 0.05, 1)
  // Engine damage reduces thrust; engineFailed = zero thrust
  const thrustMult = dmg.engineFailed
    ? 0
    : clamp(1 - en * 0.85, 0.05, 1)
  // Asymmetric drag from unequal wing damage
  const asymDrag = Math.abs(wl - wr) * 0.06
  // Fuel leak: ramps up quickly once engine is damaged
  const fuelLeakMult = en > 0.3 ? 1 + en * 6 : 1.0

  return {
    thrustMultiplier:          thrustMult,
    rollAuthorityMultiplier:   rollMult,
    pitchAuthorityMultiplier:  pitchMult,
    asymmetricDragCD:          asymDrag,
    fuelLeakMultiplier:        fuelLeakMult,
  }
}

/** Overall 0–1 damage level (for visual tinting). */
export function overallDamage(dmg: DamageState): number {
  const zones = dmg.zones
  return clamp(
    (zones.ENGINE * 0.35 + zones.FUSELAGE * 0.25 + zones.COCKPIT * 0.20 +
     (zones.WING_LEFT + zones.WING_RIGHT) * 0.10 + zones.TAIL * 0.10),
    0, 1
  )
}
