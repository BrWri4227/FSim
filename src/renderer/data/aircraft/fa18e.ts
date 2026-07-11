import type { AircraftSpec } from '../../types/aircraft'
import { FA18C } from './fa18c'

/**
 * F/A-18E Super Hornet — a larger, heavier development of the Hornet with more
 * powerful F414 engines and a bigger wing. Shares the Hornet aero shape (reuses
 * the F/A-18C aero/control tables and hardpoints) with scaled mass, thrust and
 * inertia. Flown with the detailed FA18Cockpit and animated stick/throttle.
 */
export const FA18E: AircraftSpec = {
  ...FA18C,
  id: 'fa18e',
  displayName: 'F/A-18E Super Hornet',
  engine: {
    // 2× GE F414-GE-400: 62.3 kN dry / 97.9 kN wet each → combined totals below
    maxThrustDryN: 124600,
    maxThrustWetN: 195800,
    idleThrustN: 13500,
    spoolTimeSec: 4.2,
    sfcDry: 2.05e-5, sfcWet: 4.7e-5,
    afterburnerThrottleMin: 0.75,
  },
  mass: {
    emptyMassKg: 14552, fuelCapacityKg: 6780,
    wingAreaM2: 46.45, wingspanM: 13.62, macM: 4.0,
    IxxKgM2: 21000, IyyKgM2: 128000, IzzKgM2: 143000, IxzKgM2: 1800,
  },
  maxAoADeg: 30, maxGPositive: 7.5, maxGNegative: -3.0,
  heatSignatureBaseKW: 48,
  rcsTableM2: [1.1, 2.0, 3.9, 2.4, 1.0, 2.4, 3.9, 2.0],
  pilotEyePointM: [3.8, 0, -1.3],
  cockpitFovDeg: 78,
  cmdsFlareCount: 60,
  cmdsChaffCount: 120,
}
