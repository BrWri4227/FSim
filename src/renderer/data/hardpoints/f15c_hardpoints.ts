import type { HardpointDef } from '../../types/aircraft'

export const F15C_HARDPOINTS: HardpointDef[] = [
  { id: 'W1',  posBodyM: [-4.5, 4.5, 0.2],  compatibleTypes: ['IR_MISSILE'],                        maxStoreKg: 120  },
  { id: 'W2',  posBodyM: [-2.0, 4.0, 0.2],  compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE'],          maxStoreKg: 300  },
  { id: 'W3',  posBodyM: [0,    3.5, 0.2],   compatibleTypes: ['ARH_MISSILE', 'FUEL_TANK'],           maxStoreKg: 900  },
  { id: 'W4',  posBodyM: [1.5,  3.0, 0.2],   compatibleTypes: ['ARH_MISSILE'],                       maxStoreKg: 300  },
  { id: 'E4',  posBodyM: [1.5, -3.0, 0.2],   compatibleTypes: ['ARH_MISSILE'],                       maxStoreKg: 300  },
  { id: 'E3',  posBodyM: [0,   -3.5, 0.2],   compatibleTypes: ['ARH_MISSILE', 'FUEL_TANK'],           maxStoreKg: 900  },
  { id: 'E2',  posBodyM: [-2.0,-4.0, 0.2],   compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE'],          maxStoreKg: 300  },
  { id: 'E1',  posBodyM: [-4.5,-4.5, 0.2],   compatibleTypes: ['IR_MISSILE'],                        maxStoreKg: 120  },
]
