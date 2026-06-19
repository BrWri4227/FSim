import type { AircraftSpec } from '../../types/aircraft'
import { M61A1 } from '../weapons/m61a1'
import { F22_HARDPOINTS } from '../hardpoints/f22_hardpoints'

// F-22A Raptor — 18.92 m length, 13.56 m span, 78.04 m² wing area
// 2× F119-PW-100: 104 kN dry / 156 kN AB each; supercruise ~M1.5+
const ALPHA = [-10, -5, 0, 5, 10, 15, 20, 25, 30]
const MACH  = [0.0, 0.3, 0.6, 0.9, 1.2, 1.6, 2.0]

const CL: number[][] = [
  [-0.68,-0.65,-0.62,-0.58,-0.52,-0.44,-0.36],
  [-0.28,-0.25,-0.22,-0.20,-0.17,-0.13,-0.09],
  [ 0.15, 0.16, 0.17, 0.18, 0.17, 0.14, 0.11],
  [ 0.54, 0.56, 0.58, 0.60, 0.55, 0.49, 0.43],
  [ 1.020, 1.040, 1.070, 1.080, 1.000, 0.88, 0.77],
  [ 1.380, 1.400, 1.430, 1.410, 1.280, 1.12, 0.98],
  [ 1.520, 1.500, 1.530, 1.480, 1.350, 1.18, 1.04],
  [ 1.32, 1.27, 1.27, 1.22, 1.13, 1.00, 0.89],
  [ 1.08, 1.04, 1.02, 0.98, 0.92, 0.83, 0.72],
]

// Lower supersonic drag than 4th gen — supercruise capability
const CD: number[][] = [
  [0.042,0.040,0.038,0.050,0.062,0.055,0.050],
  [0.020,0.019,0.018,0.025,0.032,0.028,0.025],
  [0.014,0.014,0.014,0.019,0.024,0.021,0.018],
  [0.022,0.022,0.024,0.030,0.035,0.031,0.028],
  [0.044,0.046,0.048,0.056,0.065,0.058,0.052],
  [0.085,0.087,0.090,0.102,0.112,0.100,0.090],
  [0.152,0.154,0.158,0.178,0.192,0.175,0.158],
  [0.245,0.248,0.252,0.285,0.305,0.280,0.252],
  [0.360,0.362,0.370,0.415,0.440,0.405,0.370],
]

const Cm: number[][] = [
  [ 0.03, 0.03, 0.03, 0.04, 0.04, 0.03, 0.02],
  [ 0.01, 0.01, 0.01, 0.02, 0.02, 0.01, 0.01],
  [ 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  [-0.01,-0.01,-0.01,-0.02,-0.02,-0.01,-0.01],
  [-0.03,-0.03,-0.03,-0.04,-0.04,-0.03,-0.02],
  [-0.05,-0.05,-0.05,-0.06,-0.06,-0.05,-0.04],
  [-0.07,-0.07,-0.07,-0.08,-0.08,-0.07,-0.06],
  [-0.09,-0.09,-0.09,-0.10,-0.10,-0.09,-0.08],
  [-0.11,-0.11,-0.11,-0.12,-0.12,-0.11,-0.10],
]

export const F22: AircraftSpec = {
  id: 'f22',
  displayName: 'F-22A Raptor',
  nation: 'USA',
  aero: {
    alphaBreakpointsDeg: ALPHA, machBreakpoints: MACH,
    CL, CD, Cm,
    CYbeta: -0.72, Clbeta: -0.07, Cnbeta: 0.13,
    Clp: -0.42, Cmq: -8.5, Cnr: -0.16,
  },
  controlEffectiveness: {
    machBreakpoints: [0.0, 0.5, 0.9, 1.2, 2.0],
    CLde: [0.310, 0.298, 0.270, 0.235, 0.185],
    CMde: [-0.180,-0.170,-0.150,-0.125,-0.095],
    CLda: [0.150, 0.142, 0.115, 0.085, 0.058],
    CNdr: [-0.048,-0.046,-0.038,-0.030,-0.022],
  },
  engine: {
    maxThrustDryN: 208000,
    maxThrustWetN: 312000,
    idleThrustN: 8000,
    spoolTimeSec: 3.0,
    sfcDry: 1.7e-5, sfcWet: 3.8e-5,
    afterburnerThrottleMin: 0.70,
  },
  mass: {
    emptyMassKg: 19700, fuelCapacityKg: 8200,
    wingAreaM2: 78.04, wingspanM: 13.56, macM: 4.5,
    IxxKgM2: 28000, IyyKgM2: 175000, IzzKgM2: 195000, IxzKgM2: 1800,
  },
  hardpoints: F22_HARDPOINTS,
  maxAoADeg: 26, maxGPositive: 9.0, maxGNegative: -3.0,
  gunSpec: M61A1,
  heatSignatureBaseKW: 18,
  rcsTableM2: [0.05, 0.08, 0.15, 0.10, 0.04, 0.10, 0.15, 0.08],
  pilotEyePointM: [4.5, 0, -1.35],
  cockpitFovDeg: 80,
  cmdsFlareCount: 96,
  cmdsChaffCount: 96,
}
