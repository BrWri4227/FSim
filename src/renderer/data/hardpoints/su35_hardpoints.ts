import type { HardpointDef } from '../../types/aircraft'

export const SU35_HARDPOINTS: HardpointDef[] = [
  { id: 'W1',  posBodyM: [-5.5, 7.0, 0.3],  compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120  },
  { id: 'W2',  posBodyM: [-3.0, 6.0, 0.3],  compatibleTypes: ['IR_MISSILE','ARH_MISSILE'], maxStoreKg: 300  },
  { id: 'W3',  posBodyM: [-1.0, 5.0, 0.3],  compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 350  },
  { id: 'W4',  posBodyM: [1.0,  4.0, 0.3],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 900  },
  { id: 'CL',  posBodyM: [0,    0,   0.5],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 1200 },
  { id: 'E4',  posBodyM: [1.0, -4.0, 0.3],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 900  },
  { id: 'E3',  posBodyM: [-1.0,-5.0, 0.3],  compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 350  },
  { id: 'E2',  posBodyM: [-3.0,-6.0, 0.3],  compatibleTypes: ['IR_MISSILE','ARH_MISSILE'], maxStoreKg: 300  },
  { id: 'E1',  posBodyM: [-5.5,-7.0, 0.3],  compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120  },
]
