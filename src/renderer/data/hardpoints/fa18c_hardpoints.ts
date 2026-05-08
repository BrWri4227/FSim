import type { HardpointDef } from '../../types/aircraft'

export const FA18C_HARDPOINTS: HardpointDef[] = [
  { id: 'W1',  posBodyM: [-5.0, 5.0, 0.2],  compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120  },
  { id: 'W2',  posBodyM: [-2.5, 4.5, 0.2],  compatibleTypes: ['IR_MISSILE','ARH_MISSILE'], maxStoreKg: 250  },
  { id: 'W3',  posBodyM: [-0.5, 4.0, 0.2],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 800  },
  { id: 'W4',  posBodyM: [1.0,  3.5, 0.2],  compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 300  },
  { id: 'CL',  posBodyM: [0,    0,   0.4],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 1000 },
  { id: 'E4',  posBodyM: [1.0, -3.5, 0.2],  compatibleTypes: ['ARH_MISSILE'],              maxStoreKg: 300  },
  { id: 'E3',  posBodyM: [-0.5,-4.0, 0.2],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 800  },
  { id: 'E2',  posBodyM: [-2.5,-4.5, 0.2],  compatibleTypes: ['IR_MISSILE','ARH_MISSILE'], maxStoreKg: 250  },
  { id: 'E1',  posBodyM: [-5.0,-5.0, 0.2],  compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120  },
]
