import type { AircraftSpec } from '../types/aircraft'
import type { LoadedStore } from '../types/weapons'

export interface InertiaMatrix {
  Ixx: number; Iyy: number; Izz: number; Ixz: number
}

export function computeTotalMass(spec: AircraftSpec, fuelKg: number, stores: LoadedStore[]): number {
  const storeMass = stores.reduce((sum, s) => sum + s.massKg * (s.remainingRounds > 0 ? 1 : 0), 0)
  return spec.mass.emptyMassKg + Math.max(0, fuelKg) + storeMass
}

export function computeInertia(spec: AircraftSpec, fuelKg: number): InertiaMatrix {
  // Simplified: inertia scales with total mass ratio
  const baseMass = spec.mass.emptyMassKg + spec.mass.fuelCapacityKg / 2
  const currentMass = spec.mass.emptyMassKg + fuelKg
  const ratio = currentMass / baseMass
  return {
    Ixx: spec.mass.IxxKgM2 * ratio,
    Iyy: spec.mass.IyyKgM2 * ratio,
    Izz: spec.mass.IzzKgM2 * ratio,
    Ixz: spec.mass.IxzKgM2,
  }
}

export function computeStoreDrag(stores: LoadedStore[]): number {
  return stores.reduce((sum, s) => sum + (s.remainingRounds > 0 ? s.dragPenalty : 0), 0)
}
