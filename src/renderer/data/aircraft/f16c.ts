import type { AircraftSpec } from '../../types/aircraft'
import { M61A1 } from '../weapons/m61a1'
import { F16C_HARDPOINTS } from '../hardpoints/f16c_hardpoints'

// Alpha breakpoints in degrees
const ALPHA = [-10, -5, 0, 5, 10, 15, 20, 25, 30]
// Mach breakpoints
const MACH  = [0.0, 0.3, 0.6, 0.9, 1.2, 1.6, 2.0]

// CL[alpha_idx][mach_idx] — lift coefficient
const CL: number[][] = [
  [-0.65, -0.60, -0.58, -0.55, -0.50, -0.42, -0.35], // -10°
  [-0.25, -0.22, -0.20, -0.18, -0.16, -0.12, -0.08], // -5°
  [ 0.12,  0.13,  0.14,  0.14,  0.13,  0.10,  0.08], //  0°
  [ 0.50,  0.52,  0.54,  0.55,  0.50,  0.44,  0.38], //  5°
  [ 0.918, 0.938, 0.969, 0.979, 0.898, 0.78,  0.68], // 10°
  [ 1.230, 1.251, 1.281, 1.251, 1.128, 0.98,  0.85], // 15°
  [ 1.326, 1.306, 1.326, 1.275, 1.142, 1.00,  0.88], // 20°
  [ 1.15,  1.10,  1.10,  1.05,  0.96,  0.85,  0.75], // 25°
  [ 0.95,  0.90,  0.88,  0.85,  0.78,  0.70,  0.60], // 30°
]

// CD[alpha_idx][mach_idx]
const CD: number[][] = [
  [0.050, 0.048, 0.046, 0.060, 0.075, 0.070, 0.065],
  [0.025, 0.024, 0.023, 0.032, 0.040, 0.038, 0.035],
  [0.018, 0.018, 0.018, 0.025, 0.032, 0.028, 0.025],
  [0.026, 0.026, 0.028, 0.036, 0.042, 0.038, 0.034],
  [0.050, 0.052, 0.054, 0.066, 0.078, 0.072, 0.065],
  [0.097, 0.099, 0.102, 0.116, 0.131, 0.122, 0.110],
  [0.175, 0.177, 0.179, 0.204, 0.223, 0.210, 0.190],
  [0.280, 0.282, 0.285, 0.320, 0.350, 0.320, 0.290],
  [0.400, 0.402, 0.410, 0.460, 0.500, 0.460, 0.420],
]

// Cm[alpha_idx][mach_idx] — pitch moment (positive = nose-up)
const Cm: number[][] = [
  [ 0.04,  0.04,  0.04,  0.05,  0.05,  0.04,  0.03],
  [ 0.02,  0.02,  0.02,  0.02,  0.02,  0.02,  0.01],
  [ 0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00],
  [-0.02, -0.02, -0.02, -0.02, -0.02, -0.02, -0.01],
  [-0.04, -0.04, -0.04, -0.05, -0.05, -0.04, -0.03],
  [-0.06, -0.06, -0.06, -0.07, -0.07, -0.06, -0.05],
  [-0.08, -0.08, -0.08, -0.09, -0.09, -0.08, -0.07],
  [-0.10, -0.10, -0.10, -0.11, -0.11, -0.10, -0.09],
  [-0.12, -0.12, -0.12, -0.13, -0.13, -0.12, -0.11],
]

export const F16C: AircraftSpec = {
  id: 'f16c',
  displayName: 'F-16C Fighting Falcon',
  nation: 'USA',
  aero: {
    alphaBreakpointsDeg: ALPHA,
    machBreakpoints: MACH,
    CL, CD, Cm,
    CYbeta: -0.70,
    Clbeta: -0.08,
    Cnbeta:  0.12,
    Clp: -0.45,
    Cmq: -8.0,
    Cnr: -0.15,
  },
  controlEffectiveness: {
    machBreakpoints: [0.0, 0.5, 0.9, 1.2, 2.0],
    CLde: [0.255, 0.246, 0.225, 0.195, 0.150],
    CMde: [-0.150,-0.140,-0.125,-0.100,-0.075],
    CLda: [0.140, 0.133, 0.105, 0.077, 0.053],
    CNdr: [-0.050,-0.048,-0.040,-0.032,-0.024],
  },
  engine: {
    maxThrustDryN: 76300,
    maxThrustWetN: 129000,
    idleThrustN:  5000,
    spoolTimeSec: 4.0,
    sfcDry: 2.0e-5,
    sfcWet: 4.5e-5,
    afterburnerThrottleMin: 0.75,
  },
  mass: {
    emptyMassKg: 8570,
    fuelCapacityKg: 3175,
    wingAreaM2: 27.87,
    wingspanM: 9.45,
    macM: 3.05,
    IxxKgM2: 9496,
    IyyKgM2: 55814,
    IzzKgM2: 63100,
    IxzKgM2: 982,
  },
  hardpoints: F16C_HARDPOINTS,
  maxAoADeg: 27,
  maxGPositive: 9.0,
  maxGNegative: -3.0,
  gunSpec: M61A1,
  heatSignatureBaseKW: 35,
  rcsTableM2: [1.2, 2.0, 4.0, 2.5, 1.0, 2.5, 4.0, 2.0],
  pilotEyePointM: [3.5, 0, -1.2],
  cockpitFovDeg: 75,
  cmdsFlareCount: 90,
  cmdsChaffCount: 90,
}
