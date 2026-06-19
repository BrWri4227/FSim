import type { HardpointDef } from '../../types/aircraft'

/** Su-57 — internal bays + wing/knee stations. */
export const SU57_HARDPOINTS: HardpointDef[] = [
  { id: 'IB-L', posBodyM: [1.0, -0.7, -0.30], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120 },
  { id: 'IB-R', posBodyM: [1.0,  0.7, -0.30], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120 },
  { id: 'MB-L', posBodyM: [-0.5, -1.0, -0.50], compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 350 },
  { id: 'MB-R', posBodyM: [-0.5,  1.0, -0.50], compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 350 },
  { id: 'W1',   posBodyM: [-4.0,  6.5, 0.25], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120 },
  { id: 'W2',   posBodyM: [-2.0,  5.5, 0.25], compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE'], maxStoreKg: 300 },
  { id: 'W3',   posBodyM: [0.0,   4.5, 0.25], compatibleTypes: ['ARH_MISSILE', 'FUEL_TANK'],  maxStoreKg: 900 },
  { id: 'E3',   posBodyM: [0.0,  -4.5, 0.25], compatibleTypes: ['ARH_MISSILE', 'FUEL_TANK'],  maxStoreKg: 900 },
  { id: 'E2',   posBodyM: [-2.0, -5.5, 0.25], compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE'], maxStoreKg: 300 },
  { id: 'E1',   posBodyM: [-4.0, -6.5, 0.25], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120 },
]
