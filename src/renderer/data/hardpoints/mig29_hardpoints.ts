import type { HardpointDef } from '../../types/aircraft'

export const MIG29_HARDPOINTS: HardpointDef[] = [
  { id: 'W1',  posBodyM: [-3.5, 4.0, 0.2],  compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120  },
  { id: 'W2',  posBodyM: [-1.0, 3.5, 0.2],  compatibleTypes: ['IR_MISSILE','ARH_MISSILE'], maxStoreKg: 250  },
  { id: 'CL',  posBodyM: [0,    0,   0.4],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 800  },
  { id: 'E2',  posBodyM: [-1.0,-3.5, 0.2],  compatibleTypes: ['IR_MISSILE','ARH_MISSILE'], maxStoreKg: 250  },
  { id: 'E1',  posBodyM: [-3.5,-4.0, 0.2],  compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120  },
]
