import type { AircraftSpec } from '../types/aircraft'
import type { LoadedStore } from '../types/weapons'
import type { Vec3 } from '../types/common'

export interface InertiaMatrix {
  Ixx: number; Iyy: number; Izz: number; Ixz: number
}

export interface MassProperties extends InertiaMatrix {
  massKg: number
  /** CG offset from the empty-aircraft reference in body frame (NED: fwd, right, down). */
  cgBodyM: Vec3
}

/** Typical internal fuel tank CG (body frame) — aft of reference. */
const FUEL_CG_BODY: Vec3 = [0.35, 0, 0.22]

export function computeTotalMass(spec: AircraftSpec, fuelKg: number, stores: LoadedStore[]): number {
  const storeMass = stores.reduce((sum, s) => sum + s.massKg * (s.remainingRounds > 0 ? 1 : 0), 0)
  return spec.mass.emptyMassKg + Math.max(0, fuelKg) + storeMass
}

export function computeMassProperties(
  spec: AircraftSpec,
  fuelKg: number,
  stores: LoadedStore[],
): MassProperties {
  const emptyMass = spec.mass.emptyMassKg
  const fuelMass = Math.max(0, fuelKg)
  const activeStores = stores.filter(s => s.remainingRounds > 0)

  let massKg = emptyMass + fuelMass
  let mx = 0
  let my = 0
  let mz = 0

  // Fuel CG contribution
  mx += FUEL_CG_BODY[0] * fuelMass
  my += FUEL_CG_BODY[1] * fuelMass
  mz += FUEL_CG_BODY[2] * fuelMass

  for (const store of activeStores) {
    massKg += store.massKg
    const hp = spec.hardpoints.find(h => h.id === store.hardpointId)
    if (!hp) continue
    const [px, py, pz] = hp.posBodyM
    mx += px * store.massKg
    my += py * store.massKg
    mz += pz * store.massKg
  }

  const cgBodyM: Vec3 = massKg > 0 ? [mx / massKg, my / massKg, mz / massKg] : [0, 0, 0]

  // Base inertia scaled by total mass vs reference (half-fuel empty baseline)
  const refMass = emptyMass + spec.mass.fuelCapacityKg * 0.5
  const massRatio = massKg / Math.max(refMass, 1)
  let Ixx = spec.mass.IxxKgM2 * massRatio
  let Iyy = spec.mass.IyyKgM2 * massRatio
  let Izz = spec.mass.IzzKgM2 * massRatio
  let Ixz = spec.mass.IxzKgM2

  // Parallel-axis increments for fuel and stores relative to the reference CG (origin)
  const addParallelAxis = (m: number, r: Vec3): void => {
    const [x, y, z] = r
    Ixx += m * (y * y + z * z)
    Iyy += m * (x * x + z * z)
    Izz += m * (x * x + y * y)
    Ixz += m * x * z
  }

  addParallelAxis(fuelMass, FUEL_CG_BODY)
  for (const store of activeStores) {
    const hp = spec.hardpoints.find(h => h.id === store.hardpointId)
    if (hp) addParallelAxis(store.massKg, hp.posBodyM)
  }

  // CG shift from reference: small pitch/yaw coupling via cross-product term adjustment
  const [cgx, cgy, cgz] = cgBodyM
  Ixx += massKg * (cgy * cgy + cgz * cgz) * 0.15
  Iyy += massKg * (cgx * cgx + cgz * cgz) * 0.15
  Izz += massKg * (cgx * cgx + cgy * cgy) * 0.15

  return { massKg, Ixx, Iyy, Izz, Ixz, cgBodyM }
}

/** @deprecated Use computeMassProperties — kept for callers that only need inertia. */
export function computeInertia(spec: AircraftSpec, fuelKg: number, stores: LoadedStore[] = []): InertiaMatrix {
  const mp = computeMassProperties(spec, fuelKg, stores)
  return { Ixx: mp.Ixx, Iyy: mp.Iyy, Izz: mp.Izz, Ixz: mp.Ixz }
}

export function computeStoreDrag(stores: LoadedStore[]): number {
  return stores.reduce((sum, s) => sum + (s.remainingRounds > 0 ? s.dragPenalty : 0), 0)
}
