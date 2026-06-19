import type { HardpointDef } from '../../types/aircraft'

/** F-35A — internal weapon bays + wing pylons for non-stealth config. */
export const F35A_HARDPOINTS: HardpointDef[] = [
  { id: 'SB-L', posBodyM: [1.5, -0.55, -0.20], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 85  },
  { id: 'SB-R', posBodyM: [1.5,  0.55, -0.20], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 85  },
  { id: 'MB-L', posBodyM: [0.2, -0.8, -0.45],  compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 200 },
  { id: 'MB-R', posBodyM: [0.2,  0.8, -0.45],  compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 200 },
  { id: 'W1',   posBodyM: [-2.5,  4.0, 0.10], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120 },
  { id: 'W2',   posBodyM: [-1.0,  3.5, 0.10], compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE'], maxStoreKg: 300 },
  { id: 'W3',   posBodyM: [0.5,   3.0, 0.10], compatibleTypes: ['ARH_MISSILE', 'FUEL_TANK'],  maxStoreKg: 800 },
  { id: 'E3',   posBodyM: [0.5,  -3.0, 0.10], compatibleTypes: ['ARH_MISSILE', 'FUEL_TANK'],  maxStoreKg: 800 },
  { id: 'E2',   posBodyM: [-1.0, -3.5, 0.10], compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE'], maxStoreKg: 300 },
  { id: 'E1',   posBodyM: [-2.5, -4.0, 0.10], compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120 },
]
