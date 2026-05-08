import type { HardpointDef } from '../../types/aircraft'

export const SU27_HARDPOINTS: HardpointDef[] = [
  { id: 'W1',  posBodyM: [-5.5, 6.0, 0.3],  compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120  },
  { id: 'W2',  posBodyM: [-2.5, 5.0, 0.3],  compatibleTypes: ['IR_MISSILE','ARH_MISSILE'], maxStoreKg: 300  },
  { id: 'W3',  posBodyM: [0,    4.0, 0.3],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 900  },
  { id: 'CL',  posBodyM: [0,    0,   0.5],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 1200 },
  { id: 'E3',  posBodyM: [0,   -4.0, 0.3],  compatibleTypes: ['ARH_MISSILE','FUEL_TANK'],  maxStoreKg: 900  },
  { id: 'E2',  posBodyM: [-2.5,-5.0, 0.3],  compatibleTypes: ['IR_MISSILE','ARH_MISSILE'], maxStoreKg: 300  },
  { id: 'E1',  posBodyM: [-5.5,-6.0, 0.3],  compatibleTypes: ['IR_MISSILE'],               maxStoreKg: 120  },
]
