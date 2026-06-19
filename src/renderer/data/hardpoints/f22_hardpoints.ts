import type { HardpointDef } from '../../types/aircraft'

/** F-22A — internal bays (stealth loadout) + optional underwing pylons. */
export const F22_HARDPOINTS: HardpointDef[] = [
  { id: 'SB-L', posBodyM: [1.8, -0.6, -0.15], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 85  },
  { id: 'SB-R', posBodyM: [1.8,  0.6, -0.15], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 85  },
  { id: 'MB1',  posBodyM: [0.5, -1.2, -0.35], compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 200 },
  { id: 'MB2',  posBodyM: [0.0,  0.0, -0.40], compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 200 },
  { id: 'MB3',  posBodyM: [0.5,  1.2, -0.35], compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 200 },
  { id: 'W1',   posBodyM: [-2.0,  5.5, 0.15], compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE'], maxStoreKg: 300 },
  { id: 'W2',   posBodyM: [-0.5,  4.5, 0.15], compatibleTypes: ['ARH_MISSILE', 'FUEL_TANK'],  maxStoreKg: 900 },
  { id: 'E2',   posBodyM: [-0.5, -4.5, 0.15], compatibleTypes: ['ARH_MISSILE', 'FUEL_TANK'],  maxStoreKg: 900 },
  { id: 'E1',   posBodyM: [-2.0, -5.5, 0.15], compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE'], maxStoreKg: 300 },
]
