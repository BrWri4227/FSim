import type { DamageState, DamageZone, FlightPenalties } from '../types/damage'
import { clamp } from '../utils/MathUtils'

export function applyHit(dmg: DamageState, zone: DamageZone, severity: number): void {
  dmg.zones[zone] = clamp(dmg.zones[zone] + severity, 0, 1)

  if (dmg.zones.ENGINE > 0.7) {
    dmg.engineFailed = true
    dmg.onFire = true
  }
  if (dmg.zones.FUSELAGE > 0.8 || dmg.zones.COCKPIT > 0.9) {
    dmg.engineFailed = true
  }
}

export function computeFlightPenalties(dmg: DamageState): FlightPenalties {
  const wl = dmg.zones.WING_LEFT
  const wr = dmg.zones.WING_RIGHT
  const en = dmg.zones.ENGINE
  const tail = dmg.zones.TAIL

  const rollMult = clamp(1 - (wl + wr) * 0.6, 0.1, 1)
  const pitchMult = clamp(1 - tail * 0.7, 0.1, 1)
  const thrustMult = dmg.engineFailed ? 0 : clamp(1 - en * 0.8, 0.05, 1)
  const asymDrag = Math.abs(wl - wr) * 0.05

  return {
    thrustMultiplier: thrustMult,
    rollAuthorityMultiplier: rollMult,
    pitchAuthorityMultiplier: pitchMult,
    asymmetricDragCD: asymDrag,
    fuelLeakMultiplier: en > 0.5 ? 5.0 : 1.0,
  }
}
