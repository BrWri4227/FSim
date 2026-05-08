export type DamageZone = 'ENGINE' | 'WING_LEFT' | 'WING_RIGHT' | 'FUSELAGE' | 'TAIL' | 'COCKPIT'

export interface DamageState {
  zones: Record<DamageZone, number>  // 0 = intact, 1 = destroyed
  onFire: boolean
  engineFailed: boolean
  ejected: boolean
  structuralFailure: boolean         // catastrophic airframe loss
}

export interface FlightPenalties {
  thrustMultiplier: number      // 1.0 = full, 0 = zero thrust
  rollAuthorityMultiplier: number
  pitchAuthorityMultiplier: number
  asymmetricDragCD: number
  fuelLeakMultiplier: number    // 1.0 = normal consumption, 5.0 = fast leak
}

export function defaultDamageState(): DamageState {
  return {
    zones: {
      ENGINE: 0,
      WING_LEFT: 0,
      WING_RIGHT: 0,
      FUSELAGE: 0,
      TAIL: 0,
      COCKPIT: 0
    },
    onFire: false,
    engineFailed: false,
    ejected: false,
    structuralFailure: false,
  }
}
