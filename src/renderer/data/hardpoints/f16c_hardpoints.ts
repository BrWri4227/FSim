import type { HardpointDef } from '../../types/aircraft'

export const F16C_HARDPOINTS: HardpointDef[] = [
  { id: 'W1',  posBodyM: [-4.5, 3.2, 0.3],  compatibleTypes: ['IR_MISSILE'],                                                       maxStoreKg: 120  },
  { id: 'W2',  posBodyM: [-2.0, 3.2, 0.3],  compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE', 'AGM_MISSILE', 'BOMB', 'LGB'],            maxStoreKg: 500  },
  { id: 'W3',  posBodyM: [-1.0, 3.0, 0.3],  compatibleTypes: ['ARH_MISSILE', 'AGM_MISSILE', 'BOMB', 'LGB', 'FUEL_TANK'],             maxStoreKg: 800  },
  { id: 'CL',  posBodyM: [0,    0,   0.4],  compatibleTypes: ['ARH_MISSILE', 'BOMB', 'LGB', 'FUEL_TANK'],                            maxStoreKg: 1000 },
  { id: 'E3',  posBodyM: [1.0,  -3.0, 0.3], compatibleTypes: ['ARH_MISSILE', 'AGM_MISSILE', 'BOMB', 'LGB', 'FUEL_TANK'],             maxStoreKg: 800  },
  { id: 'E2',  posBodyM: [2.0,  -3.2, 0.3], compatibleTypes: ['IR_MISSILE', 'ARH_MISSILE', 'AGM_MISSILE', 'BOMB', 'LGB'],            maxStoreKg: 500  },
  { id: 'E1',  posBodyM: [4.5,  -3.2, 0.3], compatibleTypes: ['IR_MISSILE'],                                                       maxStoreKg: 120  },
  { id: 'WC',  posBodyM: [-0.5, 2.8, 0],    compatibleTypes: ['ARH_MISSILE'],                                                      maxStoreKg: 200  },
  { id: 'EC',  posBodyM: [0.5,  -2.8, 0],   compatibleTypes: ['ARH_MISSILE'],                                                      maxStoreKg: 200  },
]
