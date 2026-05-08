import { P as PlaneGeometry, C as CanvasTexture, R as RepeatWrapping, M as MeshLambertMaterial, a as Mesh, S as SphereGeometry, b as ShaderMaterial, B as BackSide, c as Color, d as Scene, W as WebGLRenderer, e as PCFSoftShadowMap, A as ACESFilmicToneMapping, f as PerspectiveCamera, D as DirectionalLight, g as AmbientLight, H as HemisphereLight, F as FogExp2, V as Vector3, Q as Quaternion, E as Euler, G as Group, h as MeshPhongMaterial, i as BoxGeometry, O as Object3D, j as MeshBasicMaterial, k as BufferGeometry, l as BufferAttribute, m as Points, n as PointsMaterial, o as AdditiveBlending, p as CylinderGeometry, q as OrthographicCamera, r as Float32BufferAttribute, U as UniformsUtils, s as Vector2, t as WebGLRenderTarget, u as HalfFloatType, N as NoBlending, v as Clock } from "./three-DUT7ZBbT.js";
const M61A1 = {
  id: "m61a1",
  muzzleVelocityMS: 1030,
  roundMassKg: 0.1,
  roundDiameterM: 0.02,
  ballisticCd: 0.3,
  rateOfFireRPM: 6e3,
  totalRounds: 511,
  maxRangeM: 3e3
};
const F16C_HARDPOINTS = [
  { id: "W1", posBodyM: [-4.5, 3.2, 0.3], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 },
  { id: "W2", posBodyM: [-2, 3.2, 0.3], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 250 },
  { id: "W3", posBodyM: [-1, 3, 0.3], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 800 },
  { id: "CL", posBodyM: [0, 0, 0.4], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 1e3 },
  { id: "E3", posBodyM: [1, -3, 0.3], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 800 },
  { id: "E2", posBodyM: [2, -3.2, 0.3], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 250 },
  { id: "E1", posBodyM: [4.5, -3.2, 0.3], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 },
  { id: "WC", posBodyM: [-0.5, 2.8, 0], compatibleTypes: ["ARH_MISSILE"], maxStoreKg: 200 },
  { id: "EC", posBodyM: [0.5, -2.8, 0], compatibleTypes: ["ARH_MISSILE"], maxStoreKg: 200 }
];
const ALPHA$5 = [-10, -5, 0, 5, 10, 15, 20, 25, 30];
const MACH$5 = [0, 0.3, 0.6, 0.9, 1.2, 1.6, 2];
const CL$5 = [
  [-0.65, -0.6, -0.58, -0.55, -0.5, -0.42, -0.35],
  // -10°
  [-0.25, -0.22, -0.2, -0.18, -0.16, -0.12, -0.08],
  // -5°
  [0.12, 0.13, 0.14, 0.14, 0.13, 0.1, 0.08],
  //  0°
  [0.5, 0.52, 0.54, 0.55, 0.5, 0.44, 0.38],
  //  5°
  [0.9, 0.92, 0.95, 0.96, 0.88, 0.78, 0.68],
  // 10°
  [1.2, 1.22, 1.25, 1.22, 1.1, 0.98, 0.85],
  // 15°
  [1.3, 1.28, 1.3, 1.25, 1.12, 1, 0.88],
  // 20°
  [1.15, 1.1, 1.1, 1.05, 0.96, 0.85, 0.75],
  // 25°
  [0.95, 0.9, 0.88, 0.85, 0.78, 0.7, 0.6]
  // 30°
];
const CD$5 = [
  [0.05, 0.048, 0.046, 0.06, 0.075, 0.07, 0.065],
  [0.025, 0.024, 0.023, 0.032, 0.04, 0.038, 0.035],
  [0.018, 0.018, 0.018, 0.025, 0.032, 0.028, 0.025],
  [0.026, 0.026, 0.028, 0.036, 0.042, 0.038, 0.034],
  [0.052, 0.054, 0.056, 0.068, 0.08, 0.072, 0.065],
  [0.1, 0.102, 0.105, 0.12, 0.135, 0.122, 0.11],
  [0.18, 0.182, 0.185, 0.21, 0.23, 0.21, 0.19],
  [0.28, 0.282, 0.285, 0.32, 0.35, 0.32, 0.29],
  [0.4, 0.402, 0.41, 0.46, 0.5, 0.46, 0.42]
];
const Cm$5 = [
  [0.04, 0.04, 0.04, 0.05, 0.05, 0.04, 0.03],
  [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.01],
  [0, 0, 0, 0, 0, 0, 0],
  [-0.02, -0.02, -0.02, -0.02, -0.02, -0.02, -0.01],
  [-0.04, -0.04, -0.04, -0.05, -0.05, -0.04, -0.03],
  [-0.06, -0.06, -0.06, -0.07, -0.07, -0.06, -0.05],
  [-0.08, -0.08, -0.08, -0.09, -0.09, -0.08, -0.07],
  [-0.1, -0.1, -0.1, -0.11, -0.11, -0.1, -0.09],
  [-0.12, -0.12, -0.12, -0.13, -0.13, -0.12, -0.11]
];
const F16C = {
  id: "f16c",
  displayName: "F-16C Fighting Falcon",
  nation: "USA",
  aero: {
    alphaBreakpointsDeg: ALPHA$5,
    machBreakpoints: MACH$5,
    CL: CL$5,
    CD: CD$5,
    Cm: Cm$5,
    CYbeta: -0.7,
    Clbeta: -0.08,
    Cnbeta: 0.12,
    Clp: -0.45,
    Cmq: -8,
    Cnr: -0.15
  },
  controlEffectiveness: {
    machBreakpoints: [0, 0.5, 0.9, 1.2, 2],
    CLde: [0.085, 0.082, 0.075, 0.065, 0.05],
    CMde: [-0.03, -0.028, -0.025, -0.02, -0.015],
    CLda: [0.04, 0.038, 0.03, 0.022, 0.015],
    CNdr: [-0.025, -0.024, -0.02, -0.016, -0.012]
  },
  engine: {
    maxThrustDryN: 76300,
    maxThrustWetN: 129e3,
    idleThrustN: 5e3,
    spoolTimeSec: 4,
    sfcDry: 2e-5,
    sfcWet: 45e-6,
    afterburnerThrottleMin: 0.75
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
    IxzKgM2: 982
  },
  hardpoints: F16C_HARDPOINTS,
  maxAoADeg: 26,
  maxGPositive: 9,
  maxGNegative: -3,
  gunSpec: M61A1,
  heatSignatureBaseKW: 35,
  rcsTableM2: [1.2, 2, 4, 2.5, 1, 2.5, 4, 2],
  pilotEyePointM: [3.5, 0, -1.2],
  cockpitFovDeg: 75
};
const F15C_HARDPOINTS = [
  { id: "W1", posBodyM: [-4.5, 4.5, 0.2], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 },
  { id: "W2", posBodyM: [-2, 4, 0.2], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 300 },
  { id: "W3", posBodyM: [0, 3.5, 0.2], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 900 },
  { id: "W4", posBodyM: [1.5, 3, 0.2], compatibleTypes: ["ARH_MISSILE"], maxStoreKg: 300 },
  { id: "E4", posBodyM: [1.5, -3, 0.2], compatibleTypes: ["ARH_MISSILE"], maxStoreKg: 300 },
  { id: "E3", posBodyM: [0, -3.5, 0.2], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 900 },
  { id: "E2", posBodyM: [-2, -4, 0.2], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 300 },
  { id: "E1", posBodyM: [-4.5, -4.5, 0.2], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 }
];
const ALPHA$4 = [-10, -5, 0, 5, 10, 15, 20, 25, 30];
const MACH$4 = [0, 0.3, 0.6, 0.9, 1.2, 1.6, 2];
const CL$4 = [
  [-0.6, -0.58, -0.55, -0.52, -0.48, -0.4, -0.33],
  [-0.22, -0.2, -0.18, -0.16, -0.14, -0.1, -0.07],
  [0.1, 0.11, 0.12, 0.13, 0.12, 0.09, 0.07],
  [0.48, 0.5, 0.52, 0.53, 0.48, 0.42, 0.36],
  [0.88, 0.9, 0.92, 0.93, 0.85, 0.76, 0.65],
  [1.18, 1.2, 1.22, 1.2, 1.08, 0.96, 0.83],
  [1.28, 1.26, 1.28, 1.22, 1.1, 0.98, 0.86],
  [1.12, 1.08, 1.08, 1.02, 0.94, 0.83, 0.73],
  [0.92, 0.88, 0.86, 0.82, 0.76, 0.68, 0.58]
];
const CD$4 = [
  [0.045, 0.043, 0.042, 0.055, 0.07, 0.065, 0.06],
  [0.022, 0.021, 0.02, 0.028, 0.036, 0.034, 0.031],
  [0.016, 0.016, 0.016, 0.022, 0.028, 0.026, 0.022],
  [0.024, 0.024, 0.025, 0.033, 0.038, 0.035, 0.031],
  [0.048, 0.05, 0.052, 0.063, 0.075, 0.068, 0.06],
  [0.095, 0.097, 0.1, 0.115, 0.13, 0.118, 0.105],
  [0.17, 0.172, 0.175, 0.2, 0.22, 0.2, 0.18],
  [0.265, 0.268, 0.272, 0.31, 0.34, 0.31, 0.28],
  [0.38, 0.382, 0.39, 0.44, 0.48, 0.44, 0.4]
];
const Cm$4 = [
  [0.04, 0.04, 0.04, 0.05, 0.05, 0.04, 0.03],
  [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.01],
  [0, 0, 0, 0, 0, 0, 0],
  [-0.02, -0.02, -0.02, -0.02, -0.02, -0.02, -0.01],
  [-0.04, -0.04, -0.04, -0.05, -0.05, -0.04, -0.03],
  [-0.06, -0.06, -0.06, -0.07, -0.07, -0.06, -0.05],
  [-0.08, -0.08, -0.08, -0.09, -0.09, -0.08, -0.07],
  [-0.1, -0.1, -0.1, -0.11, -0.11, -0.1, -0.09],
  [-0.12, -0.12, -0.12, -0.13, -0.13, -0.12, -0.11]
];
const F15C = {
  id: "f15c",
  displayName: "F-15C Eagle",
  nation: "USA",
  aero: {
    alphaBreakpointsDeg: ALPHA$4,
    machBreakpoints: MACH$4,
    CL: CL$4,
    CD: CD$4,
    Cm: Cm$4,
    CYbeta: -0.75,
    Clbeta: -0.06,
    Cnbeta: 0.14,
    Clp: -0.4,
    Cmq: -7.5,
    Cnr: -0.18
  },
  controlEffectiveness: {
    machBreakpoints: [0, 0.5, 0.9, 1.2, 2],
    CLde: [0.09, 0.086, 0.078, 0.068, 0.052],
    CMde: [-0.032, -0.03, -0.026, -0.022, -0.016],
    CLda: [0.035, 0.033, 0.026, 0.018, 0.012],
    CNdr: [-0.022, -0.021, -0.018, -0.014, -0.01]
  },
  engine: {
    maxThrustDryN: 106e3,
    maxThrustWetN: 13e4,
    idleThrustN: 7e3,
    spoolTimeSec: 3.5,
    sfcDry: 19e-6,
    sfcWet: 42e-6,
    afterburnerThrottleMin: 0.75
  },
  mass: {
    emptyMassKg: 12700,
    fuelCapacityKg: 6103,
    wingAreaM2: 56.5,
    wingspanM: 13.05,
    macM: 4.3,
    IxxKgM2: 18300,
    IyyKgM2: 14e4,
    IzzKgM2: 158e3,
    IxzKgM2: 1500
  },
  hardpoints: F15C_HARDPOINTS,
  maxAoADeg: 28,
  maxGPositive: 9,
  maxGNegative: -3,
  gunSpec: M61A1,
  heatSignatureBaseKW: 55,
  rcsTableM2: [5, 8, 15, 9, 4, 9, 15, 8],
  pilotEyePointM: [4, 0, -1.4],
  cockpitFovDeg: 75
};
const FA18C_HARDPOINTS = [
  { id: "W1", posBodyM: [-5, 5, 0.2], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 },
  { id: "W2", posBodyM: [-2.5, 4.5, 0.2], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 250 },
  { id: "W3", posBodyM: [-0.5, 4, 0.2], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 800 },
  { id: "W4", posBodyM: [1, 3.5, 0.2], compatibleTypes: ["ARH_MISSILE"], maxStoreKg: 300 },
  { id: "CL", posBodyM: [0, 0, 0.4], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 1e3 },
  { id: "E4", posBodyM: [1, -3.5, 0.2], compatibleTypes: ["ARH_MISSILE"], maxStoreKg: 300 },
  { id: "E3", posBodyM: [-0.5, -4, 0.2], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 800 },
  { id: "E2", posBodyM: [-2.5, -4.5, 0.2], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 250 },
  { id: "E1", posBodyM: [-5, -5, 0.2], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 }
];
const ALPHA$3 = [-10, -5, 0, 5, 10, 15, 20, 25, 30];
const MACH$3 = [0, 0.3, 0.6, 0.9, 1.2, 1.6, 2];
const CL$3 = [
  [-0.62, -0.6, -0.57, -0.54, -0.49, -0.41, -0.34],
  [-0.24, -0.21, -0.19, -0.17, -0.15, -0.11, -0.07],
  [0.11, 0.12, 0.13, 0.14, 0.13, 0.1, 0.08],
  [0.52, 0.54, 0.56, 0.57, 0.52, 0.46, 0.4],
  [0.95, 0.97, 1, 1.01, 0.93, 0.82, 0.72],
  [1.3, 1.32, 1.35, 1.32, 1.18, 1.05, 0.92],
  [1.4, 1.38, 1.4, 1.35, 1.22, 1.08, 0.95],
  [1.2, 1.15, 1.15, 1.1, 1.01, 0.9, 0.8],
  [0.98, 0.94, 0.92, 0.88, 0.82, 0.73, 0.63]
];
const CD$3 = [
  [0.048, 0.046, 0.044, 0.058, 0.072, 0.068, 0.062],
  [0.024, 0.022, 0.021, 0.03, 0.038, 0.036, 0.033],
  [0.019, 0.019, 0.019, 0.026, 0.034, 0.03, 0.027],
  [0.027, 0.027, 0.029, 0.038, 0.044, 0.04, 0.036],
  [0.054, 0.056, 0.058, 0.07, 0.082, 0.074, 0.067],
  [0.108, 0.11, 0.112, 0.128, 0.142, 0.13, 0.118],
  [0.19, 0.192, 0.195, 0.22, 0.242, 0.22, 0.2],
  [0.29, 0.292, 0.296, 0.332, 0.362, 0.332, 0.302],
  [0.42, 0.422, 0.43, 0.48, 0.52, 0.48, 0.44]
];
const Cm$3 = [
  [0.05, 0.05, 0.05, 0.06, 0.06, 0.05, 0.04],
  [0.02, 0.02, 0.02, 0.03, 0.03, 0.02, 0.01],
  [0, 0, 0, 0, 0, 0, 0],
  [-0.02, -0.02, -0.02, -0.03, -0.03, -0.02, -0.01],
  [-0.05, -0.05, -0.05, -0.06, -0.06, -0.05, -0.04],
  [-0.07, -0.07, -0.07, -0.08, -0.08, -0.07, -0.06],
  [-0.09, -0.09, -0.09, -0.1, -0.1, -0.09, -0.08],
  [-0.11, -0.11, -0.11, -0.12, -0.12, -0.11, -0.1],
  [-0.13, -0.13, -0.13, -0.14, -0.14, -0.13, -0.12]
];
const FA18C = {
  id: "fa18c",
  displayName: "F/A-18C Hornet",
  nation: "USA",
  aero: {
    alphaBreakpointsDeg: ALPHA$3,
    machBreakpoints: MACH$3,
    CL: CL$3,
    CD: CD$3,
    Cm: Cm$3,
    CYbeta: -0.72,
    Clbeta: -0.09,
    Cnbeta: 0.13,
    Clp: -0.42,
    Cmq: -7.8,
    Cnr: -0.16
  },
  controlEffectiveness: {
    machBreakpoints: [0, 0.5, 0.9, 1.2, 2],
    CLde: [0.092, 0.088, 0.08, 0.07, 0.054],
    CMde: [-0.031, -0.029, -0.025, -0.021, -0.016],
    CLda: [0.042, 0.04, 0.032, 0.024, 0.016],
    CNdr: [-0.024, -0.023, -0.019, -0.015, -0.011]
  },
  engine: {
    maxThrustDryN: 79e3,
    maxThrustWetN: 98e3,
    idleThrustN: 6e3,
    spoolTimeSec: 4.5,
    sfcDry: 21e-6,
    sfcWet: 48e-6,
    afterburnerThrottleMin: 0.75
  },
  mass: {
    emptyMassKg: 10433,
    fuelCapacityKg: 4925,
    wingAreaM2: 37.16,
    wingspanM: 11.43,
    macM: 3.51,
    IxxKgM2: 14e3,
    IyyKgM2: 9e4,
    IzzKgM2: 102e3,
    IxzKgM2: 1200
  },
  hardpoints: FA18C_HARDPOINTS,
  maxAoADeg: 30,
  maxGPositive: 7.5,
  maxGNegative: -3,
  gunSpec: M61A1,
  heatSignatureBaseKW: 40,
  rcsTableM2: [1, 1.8, 3.5, 2.2, 0.9, 2.2, 3.5, 1.8],
  pilotEyePointM: [3.8, 0, -1.3],
  cockpitFovDeg: 78
};
const GSH301 = {
  id: "gsh301",
  muzzleVelocityMS: 860,
  roundMassKg: 0.39,
  roundDiameterM: 0.03,
  ballisticCd: 0.35,
  rateOfFireRPM: 1800,
  totalRounds: 150,
  maxRangeM: 2500
};
const MIG29_HARDPOINTS = [
  { id: "W1", posBodyM: [-3.5, 4, 0.2], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 },
  { id: "W2", posBodyM: [-1, 3.5, 0.2], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 250 },
  { id: "CL", posBodyM: [0, 0, 0.4], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 800 },
  { id: "E2", posBodyM: [-1, -3.5, 0.2], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 250 },
  { id: "E1", posBodyM: [-3.5, -4, 0.2], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 }
];
const ALPHA$2 = [-10, -5, 0, 5, 10, 15, 20, 25, 30];
const MACH$2 = [0, 0.3, 0.6, 0.9, 1.2, 1.6, 2];
const CL$2 = [
  [-0.63, -0.61, -0.58, -0.55, -0.5, -0.42, -0.35],
  [-0.24, -0.21, -0.19, -0.17, -0.15, -0.11, -0.07],
  [0.11, 0.12, 0.13, 0.14, 0.13, 0.1, 0.07],
  [0.51, 0.53, 0.55, 0.56, 0.51, 0.45, 0.39],
  [0.92, 0.94, 0.97, 0.98, 0.9, 0.8, 0.7],
  [1.25, 1.27, 1.3, 1.27, 1.14, 1.01, 0.88],
  [1.35, 1.33, 1.35, 1.3, 1.17, 1.04, 0.91],
  [1.18, 1.13, 1.13, 1.08, 0.99, 0.88, 0.77],
  [0.96, 0.92, 0.9, 0.86, 0.8, 0.71, 0.61]
];
const CD$2 = [
  [0.05, 0.048, 0.046, 0.06, 0.074, 0.069, 0.063],
  [0.025, 0.023, 0.022, 0.031, 0.039, 0.037, 0.034],
  [0.018, 0.018, 0.018, 0.025, 0.032, 0.028, 0.025],
  [0.026, 0.026, 0.028, 0.037, 0.043, 0.039, 0.035],
  [0.052, 0.054, 0.056, 0.068, 0.08, 0.073, 0.065],
  [0.1, 0.102, 0.105, 0.12, 0.135, 0.123, 0.11],
  [0.18, 0.182, 0.185, 0.21, 0.232, 0.212, 0.192],
  [0.28, 0.282, 0.286, 0.322, 0.352, 0.322, 0.292],
  [0.402, 0.404, 0.412, 0.462, 0.502, 0.462, 0.422]
];
const Cm$2 = [
  [0.04, 0.04, 0.04, 0.05, 0.05, 0.04, 0.03],
  [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.01],
  [0, 0, 0, 0, 0, 0, 0],
  [-0.02, -0.02, -0.02, -0.02, -0.02, -0.02, -0.01],
  [-0.04, -0.04, -0.04, -0.05, -0.05, -0.04, -0.03],
  [-0.06, -0.06, -0.06, -0.07, -0.07, -0.06, -0.05],
  [-0.08, -0.08, -0.08, -0.09, -0.09, -0.08, -0.07],
  [-0.1, -0.1, -0.1, -0.11, -0.11, -0.1, -0.09],
  [-0.12, -0.12, -0.12, -0.13, -0.13, -0.12, -0.11]
];
const MIG29 = {
  id: "mig29",
  displayName: "MiG-29A Fulcrum",
  nation: "RUS",
  aero: {
    alphaBreakpointsDeg: ALPHA$2,
    machBreakpoints: MACH$2,
    CL: CL$2,
    CD: CD$2,
    Cm: Cm$2,
    CYbeta: -0.68,
    Clbeta: -0.07,
    Cnbeta: 0.11,
    Clp: -0.43,
    Cmq: -7.9,
    Cnr: -0.14
  },
  controlEffectiveness: {
    machBreakpoints: [0, 0.5, 0.9, 1.2, 2],
    CLde: [0.082, 0.079, 0.072, 0.062, 0.048],
    CMde: [-0.028, -0.026, -0.023, -0.019, -0.014],
    CLda: [0.038, 0.036, 0.028, 0.02, 0.013],
    CNdr: [-0.023, -0.022, -0.018, -0.014, -0.01]
  },
  engine: {
    maxThrustDryN: 81400,
    maxThrustWetN: 98e3,
    idleThrustN: 6e3,
    spoolTimeSec: 4,
    sfcDry: 2e-5,
    sfcWet: 44e-6,
    afterburnerThrottleMin: 0.75
  },
  mass: {
    emptyMassKg: 10900,
    fuelCapacityKg: 3500,
    wingAreaM2: 38.06,
    wingspanM: 11.36,
    macM: 3.74,
    IxxKgM2: 16e3,
    IyyKgM2: 85e3,
    IzzKgM2: 98e3,
    IxzKgM2: 1100
  },
  hardpoints: MIG29_HARDPOINTS,
  maxAoADeg: 28,
  maxGPositive: 9,
  maxGNegative: -3,
  gunSpec: GSH301,
  heatSignatureBaseKW: 50,
  rcsTableM2: [5, 8, 14, 8.5, 3.5, 8.5, 14, 8],
  pilotEyePointM: [3.6, 0, -1.3],
  cockpitFovDeg: 75
};
const SU27_HARDPOINTS = [
  { id: "W1", posBodyM: [-5.5, 6, 0.3], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 },
  { id: "W2", posBodyM: [-2.5, 5, 0.3], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 300 },
  { id: "W3", posBodyM: [0, 4, 0.3], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 900 },
  { id: "CL", posBodyM: [0, 0, 0.5], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 1200 },
  { id: "E3", posBodyM: [0, -4, 0.3], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 900 },
  { id: "E2", posBodyM: [-2.5, -5, 0.3], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 300 },
  { id: "E1", posBodyM: [-5.5, -6, 0.3], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 }
];
const ALPHA$1 = [-10, -5, 0, 5, 10, 15, 20, 25, 30];
const MACH$1 = [0, 0.3, 0.6, 0.9, 1.2, 1.6, 2];
const CL$1 = [
  [-0.65, -0.63, -0.6, -0.57, -0.52, -0.44, -0.37],
  [-0.26, -0.23, -0.21, -0.19, -0.17, -0.13, -0.09],
  [0.13, 0.14, 0.15, 0.16, 0.15, 0.12, 0.09],
  [0.54, 0.56, 0.58, 0.59, 0.54, 0.48, 0.42],
  [0.96, 0.98, 1.01, 1.02, 0.94, 0.84, 0.73],
  [1.3, 1.32, 1.36, 1.33, 1.2, 1.07, 0.93],
  [1.42, 1.4, 1.43, 1.38, 1.25, 1.11, 0.97],
  [1.26, 1.21, 1.21, 1.16, 1.07, 0.95, 0.84],
  [1.04, 1, 0.98, 0.94, 0.88, 0.79, 0.68]
];
const CD$1 = [
  [0.046, 0.044, 0.042, 0.056, 0.07, 0.065, 0.06],
  [0.022, 0.02, 0.019, 0.027, 0.035, 0.033, 0.03],
  [0.016, 0.016, 0.016, 0.022, 0.028, 0.025, 0.022],
  [0.024, 0.024, 0.026, 0.035, 0.041, 0.037, 0.033],
  [0.05, 0.052, 0.054, 0.065, 0.077, 0.07, 0.062],
  [0.097, 0.099, 0.102, 0.117, 0.132, 0.12, 0.107],
  [0.175, 0.177, 0.18, 0.205, 0.225, 0.205, 0.185],
  [0.272, 0.274, 0.278, 0.316, 0.346, 0.316, 0.286],
  [0.392, 0.394, 0.402, 0.452, 0.492, 0.452, 0.412]
];
const Cm$1 = [
  [0.03, 0.03, 0.03, 0.04, 0.04, 0.03, 0.02],
  [0.01, 0.01, 0.01, 0.02, 0.02, 0.01, 0.01],
  [0, 0, 0, 0, 0, 0, 0],
  [-0.01, -0.01, -0.01, -0.02, -0.02, -0.01, -0.01],
  [-0.03, -0.03, -0.03, -0.04, -0.04, -0.03, -0.02],
  [-0.05, -0.05, -0.05, -0.06, -0.06, -0.05, -0.04],
  [-0.07, -0.07, -0.07, -0.08, -0.08, -0.07, -0.06],
  [-0.09, -0.09, -0.09, -0.1, -0.1, -0.09, -0.08],
  [-0.11, -0.11, -0.11, -0.12, -0.12, -0.11, -0.1]
];
const SU27 = {
  id: "su27",
  displayName: "Su-27 Flanker-B",
  nation: "RUS",
  aero: {
    alphaBreakpointsDeg: ALPHA$1,
    machBreakpoints: MACH$1,
    CL: CL$1,
    CD: CD$1,
    Cm: Cm$1,
    CYbeta: -0.76,
    Clbeta: -0.07,
    Cnbeta: 0.13,
    Clp: -0.38,
    Cmq: -7.2,
    Cnr: -0.16
  },
  controlEffectiveness: {
    machBreakpoints: [0, 0.5, 0.9, 1.2, 2],
    CLde: [0.095, 0.091, 0.083, 0.072, 0.056],
    CMde: [-0.033, -0.031, -0.027, -0.023, -0.017],
    CLda: [0.036, 0.034, 0.027, 0.019, 0.013],
    CNdr: [-0.021, -0.02, -0.017, -0.013, -9e-3]
  },
  engine: {
    maxThrustDryN: 122600,
    maxThrustWetN: 137300,
    idleThrustN: 8e3,
    spoolTimeSec: 3.5,
    sfcDry: 185e-7,
    sfcWet: 4e-5,
    afterburnerThrottleMin: 0.75
  },
  mass: {
    emptyMassKg: 16380,
    fuelCapacityKg: 9400,
    wingAreaM2: 62,
    wingspanM: 14.7,
    macM: 4.7,
    IxxKgM2: 24e3,
    IyyKgM2: 18e4,
    IzzKgM2: 2e5,
    IxzKgM2: 2e3
  },
  hardpoints: SU27_HARDPOINTS,
  maxAoADeg: 30,
  maxGPositive: 9,
  maxGNegative: -3,
  gunSpec: GSH301,
  heatSignatureBaseKW: 70,
  rcsTableM2: [10, 16, 25, 18, 8, 18, 25, 16],
  pilotEyePointM: [4.2, 0, -1.5],
  cockpitFovDeg: 75
};
const SU35_HARDPOINTS = [
  { id: "W1", posBodyM: [-5.5, 7, 0.3], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 },
  { id: "W2", posBodyM: [-3, 6, 0.3], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 300 },
  { id: "W3", posBodyM: [-1, 5, 0.3], compatibleTypes: ["ARH_MISSILE"], maxStoreKg: 350 },
  { id: "W4", posBodyM: [1, 4, 0.3], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 900 },
  { id: "CL", posBodyM: [0, 0, 0.5], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 1200 },
  { id: "E4", posBodyM: [1, -4, 0.3], compatibleTypes: ["ARH_MISSILE", "FUEL_TANK"], maxStoreKg: 900 },
  { id: "E3", posBodyM: [-1, -5, 0.3], compatibleTypes: ["ARH_MISSILE"], maxStoreKg: 350 },
  { id: "E2", posBodyM: [-3, -6, 0.3], compatibleTypes: ["IR_MISSILE", "ARH_MISSILE"], maxStoreKg: 300 },
  { id: "E1", posBodyM: [-5.5, -7, 0.3], compatibleTypes: ["IR_MISSILE"], maxStoreKg: 120 }
];
const ALPHA = [-10, -5, 0, 5, 10, 15, 20, 25, 30];
const MACH = [0, 0.3, 0.6, 0.9, 1.2, 1.6, 2];
const CL = [
  [-0.66, -0.64, -0.61, -0.58, -0.53, -0.45, -0.38],
  [-0.27, -0.24, -0.22, -0.2, -0.18, -0.14, -0.1],
  [0.14, 0.15, 0.16, 0.17, 0.16, 0.13, 0.1],
  [0.56, 0.58, 0.6, 0.61, 0.56, 0.5, 0.44],
  [0.98, 1, 1.03, 1.04, 0.96, 0.86, 0.75],
  [1.32, 1.34, 1.38, 1.35, 1.22, 1.09, 0.95],
  [1.45, 1.43, 1.46, 1.41, 1.28, 1.14, 1],
  [1.28, 1.23, 1.23, 1.18, 1.09, 0.97, 0.86],
  [1.06, 1.02, 1, 0.96, 0.9, 0.81, 0.7]
];
const CD = [
  [0.044, 0.042, 0.04, 0.054, 0.068, 0.063, 0.058],
  [0.021, 0.019, 0.018, 0.026, 0.034, 0.032, 0.029],
  [0.015, 0.015, 0.015, 0.021, 0.027, 0.024, 0.021],
  [0.023, 0.023, 0.025, 0.034, 0.04, 0.036, 0.032],
  [0.048, 0.05, 0.052, 0.063, 0.075, 0.068, 0.06],
  [0.095, 0.097, 0.1, 0.115, 0.13, 0.118, 0.105],
  [0.172, 0.174, 0.178, 0.202, 0.222, 0.202, 0.182],
  [0.268, 0.27, 0.274, 0.312, 0.342, 0.312, 0.282],
  [0.388, 0.39, 0.398, 0.448, 0.488, 0.448, 0.408]
];
const Cm = [
  [0.03, 0.03, 0.03, 0.04, 0.04, 0.03, 0.02],
  [0.01, 0.01, 0.01, 0.02, 0.02, 0.01, 0.01],
  [0, 0, 0, 0, 0, 0, 0],
  [-0.01, -0.01, -0.01, -0.02, -0.02, -0.01, -0.01],
  [-0.03, -0.03, -0.03, -0.04, -0.04, -0.03, -0.02],
  [-0.05, -0.05, -0.05, -0.06, -0.06, -0.05, -0.04],
  [-0.07, -0.07, -0.07, -0.08, -0.08, -0.07, -0.06],
  [-0.09, -0.09, -0.09, -0.1, -0.1, -0.09, -0.08],
  [-0.11, -0.11, -0.11, -0.12, -0.12, -0.11, -0.1]
];
const SU35 = {
  id: "su35",
  displayName: "Su-35S Flanker-E",
  nation: "RUS",
  aero: {
    alphaBreakpointsDeg: ALPHA,
    machBreakpoints: MACH,
    CL,
    CD,
    Cm,
    CYbeta: -0.78,
    Clbeta: -0.08,
    Cnbeta: 0.14,
    Clp: -0.37,
    Cmq: -7,
    Cnr: -0.17
  },
  controlEffectiveness: {
    machBreakpoints: [0, 0.5, 0.9, 1.2, 2],
    CLde: [0.098, 0.094, 0.085, 0.074, 0.058],
    CMde: [-0.034, -0.032, -0.028, -0.024, -0.018],
    CLda: [0.038, 0.036, 0.029, 0.021, 0.014],
    CNdr: [-0.022, -0.021, -0.018, -0.014, -0.01]
  },
  engine: {
    maxThrustDryN: 137300,
    maxThrustWetN: 142e3,
    idleThrustN: 9e3,
    spoolTimeSec: 3,
    sfcDry: 175e-7,
    sfcWet: 39e-6,
    afterburnerThrottleMin: 0.75
  },
  mass: {
    emptyMassKg: 18400,
    fuelCapacityKg: 11500,
    wingAreaM2: 62,
    wingspanM: 14.75,
    macM: 4.7,
    IxxKgM2: 25e3,
    IyyKgM2: 19e4,
    IzzKgM2: 212e3,
    IxzKgM2: 2100
  },
  hardpoints: SU35_HARDPOINTS,
  maxAoADeg: 30,
  maxGPositive: 9,
  maxGNegative: -3,
  gunSpec: GSH301,
  heatSignatureBaseKW: 75,
  rcsTableM2: [4, 7, 14, 8, 3.5, 8, 14, 7],
  pilotEyePointM: [4.2, 0, -1.5],
  cockpitFovDeg: 75
};
const AIM9M = {
  id: "aim9m",
  displayName: "AIM-9M Sidewinder",
  category: "IR_MISSILE",
  nation: "USA",
  massKg: 85,
  dragCd: 0.4,
  bodyDiameterM: 0.127,
  maxThrustN: 14e3,
  burnTimeSec: 3.2,
  maxGOverload: 35,
  maxSpeedMach: 2.5,
  proxFuseRadiusM: 10,
  lethalRadiusM: 8,
  maxRangeM: 18e3,
  navigationConstant: 4,
  irSeeker: {
    gimbalLimitDeg: 35,
    trackingRateRadS: 12,
    minHeatSignatureKW: 2,
    flareRejectionCapability: 0.4,
    fovDeg: 4,
    hmsCapable: false
  },
  dataLinkUpdateHz: 0
};
const AIM120B = {
  id: "aim120b",
  displayName: "AIM-120B AMRAAM",
  category: "ARH_MISSILE",
  nation: "USA",
  massKg: 152,
  dragCd: 0.35,
  bodyDiameterM: 0.178,
  maxThrustN: 22e3,
  burnTimeSec: 6.5,
  maxGOverload: 30,
  maxSpeedMach: 4,
  proxFuseRadiusM: 12,
  lethalRadiusM: 10,
  maxRangeM: 55e3,
  navigationConstant: 3.5,
  arSeeker: {
    peakPowerW: 150,
    antennaGainDB: 28,
    frequencyGHz: 10,
    terminalActivationRangeM: 12e3
  },
  dataLinkUpdateHz: 2
};
const R73 = {
  id: "r73",
  displayName: "R-73 Archer",
  category: "IR_MISSILE",
  nation: "RUS",
  massKg: 105,
  dragCd: 0.42,
  bodyDiameterM: 0.17,
  maxThrustN: 16e3,
  burnTimeSec: 3,
  maxGOverload: 40,
  maxSpeedMach: 2.5,
  proxFuseRadiusM: 9,
  lethalRadiusM: 7,
  maxRangeM: 2e4,
  navigationConstant: 4.5,
  irSeeker: {
    gimbalLimitDeg: 60,
    trackingRateRadS: 18,
    minHeatSignatureKW: 1.5,
    flareRejectionCapability: 0.85,
    fovDeg: 3,
    hmsCapable: true
  },
  dataLinkUpdateHz: 0
};
const R77 = {
  id: "r77",
  displayName: "R-77 Adder",
  category: "ARH_MISSILE",
  nation: "RUS",
  massKg: 175,
  dragCd: 0.38,
  bodyDiameterM: 0.2,
  maxThrustN: 24e3,
  burnTimeSec: 7,
  maxGOverload: 35,
  maxSpeedMach: 4,
  proxFuseRadiusM: 12,
  lethalRadiusM: 10,
  maxRangeM: 8e4,
  navigationConstant: 3.5,
  arSeeker: {
    peakPowerW: 180,
    antennaGainDB: 30,
    frequencyGHz: 9,
    terminalActivationRangeM: 15e3
  },
  dataLinkUpdateHz: 2
};
const AIRCRAFT_ROSTER = [F16C, F15C, FA18C, MIG29, SU27, SU35];
const WEAPON_OPTIONS = {
  "aim9m": { label: "AIM-9M Sidewinder", count: 1 },
  "aim120b": { label: "AIM-120B AMRAAM", count: 1 },
  "r73": { label: "R-73 Archer", count: 1 },
  "r77": { label: "R-77 Adder", count: 1 },
  "none": { label: "(Empty)", count: 0 }
};
class LoadoutScreen {
  el;
  selectedSpec = F16C;
  onLaunch;
  constructor(_container, onLaunch) {
    this.onLaunch = onLaunch;
    this.el = document.createElement("div");
    Object.assign(this.el.style, {
      position: "fixed",
      inset: "0",
      background: "#0a0f0a",
      color: "#00ff88",
      fontFamily: "monospace",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "8000",
      gap: "20px"
    });
    document.body.appendChild(this.el);
    this.render();
  }
  render() {
    this.el.innerHTML = "";
    const title = document.createElement("h1");
    title.textContent = "FSIM — SELECT AIRCRAFT";
    title.style.cssText = "color:#00ff88;letter-spacing:4px;font-size:22px;margin:0";
    this.el.appendChild(title);
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:900px";
    for (const spec of AIRCRAFT_ROSTER) {
      const card = document.createElement("div");
      const selected = spec === this.selectedSpec;
      card.style.cssText = `border:1px solid ${selected ? "#00ff88" : "#226644"};padding:12px;cursor:pointer;background:${selected ? "#0f2a1a" : "#0a150a"};min-width:140px`;
      card.innerHTML = `
        <div style="font-size:15px;font-weight:bold;color:${spec.nation === "USA" ? "#4488ff" : "#ff4444"}">${spec.displayName}</div>
        <div style="font-size:11px;color:#88bb88;margin-top:4px">
          Nation: ${spec.nation}<br>
          Max G: +${spec.maxGPositive}<br>
          Max AoA: ${spec.maxAoADeg}°
        </div>
      `;
      card.onclick = () => {
        this.selectedSpec = spec;
        this.render();
      };
      grid.appendChild(card);
    }
    this.el.appendChild(grid);
    const hpSection = document.createElement("div");
    hpSection.style.cssText = "border:1px solid #226644;padding:12px;max-width:900px;width:100%";
    hpSection.innerHTML = '<div style="margin-bottom:8px;color:#aaffcc">HARDPOINTS</div>';
    const selects = [];
    for (const hp of this.selectedSpec.hardpoints) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin:4px 0";
      const lbl = document.createElement("span");
      lbl.textContent = hp.id.padEnd(4, " ");
      lbl.style.width = "40px";
      const sel = document.createElement("select");
      sel.style.cssText = "background:#0a150a;color:#00ff88;border:1px solid #226644;font:11px monospace";
      sel.innerHTML = `<option value="none">(Empty)</option>`;
      for (const [id, info] of Object.entries(WEAPON_OPTIONS)) {
        if (id === "none") continue;
        const wSpec = id === "aim9m" ? AIM9M : id === "aim120b" ? AIM120B : id === "r73" ? R73 : R77;
        if (!hp.compatibleTypes.includes(wSpec.category)) continue;
        if ((wSpec.category === "IR_MISSILE" || wSpec.category === "ARH_MISSILE") && (id.startsWith("aim") && this.selectedSpec.nation !== "USA" || id.startsWith("r") && this.selectedSpec.nation !== "RUS")) continue;
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = info.label;
        sel.appendChild(opt);
      }
      selects.push({ hpId: hp.id, sel });
      row.appendChild(lbl);
      row.appendChild(sel);
      hpSection.appendChild(row);
    }
    this.el.appendChild(hpSection);
    const btn = document.createElement("button");
    btn.textContent = "LAUNCH MISSION";
    btn.style.cssText = "padding:14px 48px;font:bold 16px monospace;background:#0a2a0a;color:#00ff88;border:2px solid #00ff88;cursor:pointer;letter-spacing:3px";
    btn.onclick = () => {
      const stores = selects.filter((s) => s.sel.value !== "none").map((s) => {
        const wSpec = s.sel.value === "aim9m" ? AIM9M : s.sel.value === "aim120b" ? AIM120B : s.sel.value === "r73" ? R73 : R77;
        return {
          hardpointId: s.hpId,
          weaponId: s.sel.value,
          category: wSpec.category,
          massKg: wSpec.massKg,
          dragPenalty: 2e-3,
          remainingRounds: 1
        };
      });
      this.onLaunch(this.selectedSpec, stores);
      this.dispose();
    };
    this.el.appendChild(btn);
  }
  dispose() {
    document.body.removeChild(this.el);
  }
}
const TERRAIN_SIZE = 3e5;
class Terrain {
  mesh;
  constructor(scene) {
    const geo = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 64, 64);
    geo.rotateX(-Math.PI / 2);
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#3a5c2a";
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.strokeStyle = "#2a4a1a";
    ctx.lineWidth = 1;
    const gridSize = 64;
    for (let i = 0; i <= 1024; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }
    ctx.strokeStyle = "#6a7a5a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 512);
    ctx.lineTo(1024, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(512, 0);
    ctx.lineTo(512, 1024);
    ctx.stroke();
    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(200, 200);
    const mat = new MeshLambertMaterial({ map: tex });
    this.mesh = new Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.position.y = 0;
    scene.add(this.mesh);
  }
}
class Sky {
  mesh;
  constructor(scene) {
    const geo = new SphereGeometry(18e4, 32, 16);
    geo.scale(-1, 1, 1);
    const mat = new ShaderMaterial({
      uniforms: {
        topColor: { value: new Color(662074) },
        horizonColor: { value: new Color(8894680) },
        groundColor: { value: new Color(1714704) },
        offset: { value: 400 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          vec3 col;
          if (h > 0.0) {
            col = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
          } else {
            col = groundColor;
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false
    });
    this.mesh = new Mesh(geo, mat);
    scene.add(this.mesh);
  }
}
class SceneManager {
  scene;
  renderer;
  camera;
  terrain;
  sky;
  constructor(canvas) {
    this.scene = new Scene();
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 2e5);
    const sun = new DirectionalLight(16775400, 3);
    sun.position.set(5e4, 8e4, -2e4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 2e5;
    sun.shadow.camera.left = -2e4;
    sun.shadow.camera.right = 2e4;
    sun.shadow.camera.top = 2e4;
    sun.shadow.camera.bottom = -2e4;
    this.scene.add(sun);
    const ambient = new AmbientLight(8425648, 0.8);
    this.scene.add(ambient);
    const sky_hemi = new HemisphereLight(8900331, 4881471, 0.6);
    this.scene.add(sky_hemi);
    this.terrain = new Terrain(this.scene);
    this.sky = new Sky(this.scene);
    this.scene.fog = new FogExp2(13162728, 8e-6);
    window.addEventListener("resize", this.onResize);
  }
  onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
  render(camera) {
    this.renderer.render(this.scene, camera);
  }
  dispose() {
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
  }
}
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function v3add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function v3sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function v3scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function v3dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function v3cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function v3len(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}
function v3norm(a) {
  const l = v3len(a);
  if (l < 1e-12) return [0, 0, 0];
  return [a[0] / l, a[1] / l, a[2] / l];
}
function v3dist(a, b) {
  return v3len(v3sub(a, b));
}
function quatRotateVec(q, v) {
  const [qw, qx, qy, qz] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx
  ];
}
function quatConjugate(q) {
  return [q[0], -q[1], -q[2], -q[3]];
}
function quatFromEulerZYX(yawRad, pitchRad, rollRad) {
  const cy = Math.cos(yawRad * 0.5), sy = Math.sin(yawRad * 0.5);
  const cp = Math.cos(pitchRad * 0.5), sp = Math.sin(pitchRad * 0.5);
  const cr = Math.cos(rollRad * 0.5), sr = Math.sin(rollRad * 0.5);
  return [
    cr * cp * cy + sr * sp * sy,
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy
  ];
}
function nedToThree(pos) {
  return new Vector3(pos[1], -pos[2], -pos[0]);
}
function nedQuatToThree(q) {
  const ned = new Quaternion(q[1], q[2], q[3], q[0]);
  const basisChange = new Quaternion();
  basisChange.setFromEuler(new Euler(Math.PI / 2, 0, 0));
  return ned.multiply(basisChange);
}
function makeStateVec(pos, vel, q, omega) {
  return [
    pos[0],
    pos[1],
    pos[2],
    vel[0],
    vel[1],
    vel[2],
    q[0],
    q[1],
    q[2],
    q[3],
    omega[0],
    omega[1],
    omega[2]
  ];
}
class CockpitCamera {
  yaw = 0;
  // head look yaw, radians
  pitch = 0;
  // head look pitch, radians
  mouseSensitivity = 2e-3;
  MAX_YAW = Math.PI / 2.2;
  // ±80°
  MAX_PITCH = 0.7;
  // ±40°
  constructor() {
    window.addEventListener("mousemove", this.onMouse);
    document.getElementById("three-canvas")?.addEventListener("click", () => {
      document.getElementById("three-canvas")?.requestPointerLock();
    });
  }
  onMouse = (e) => {
    if (document.pointerLockElement) {
      this.yaw = clamp(this.yaw - e.movementX * this.mouseSensitivity, -this.MAX_YAW, this.MAX_YAW);
      this.pitch = clamp(this.pitch - e.movementY * this.mouseSensitivity, -this.MAX_PITCH, this.MAX_PITCH);
    }
  };
  update(camera, player) {
    const { spec, state } = player;
    const aircraftPos = nedToThree(state.positionNED);
    const aircraftQuat = nedQuatToThree(state.attitudeQuat);
    const [ex, ey, ez] = spec.pilotEyePointM;
    const eyeBody = new Vector3(ex, ey, ez);
    eyeBody.applyQuaternion(aircraftQuat);
    const eyeWorld = aircraftPos.clone().add(eyeBody);
    const gShake = Math.max(0, state.gCurrent - 4) * 8e-3;
    eyeWorld.y += (Math.random() - 0.5) * gShake;
    camera.position.copy(eyeWorld);
    const headYaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -this.yaw);
    const headPitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), this.pitch);
    camera.quaternion.copy(aircraftQuat).multiply(headYaw).multiply(headPitch);
    camera.fov = spec.cockpitFovDeg;
    camera.updateProjectionMatrix();
  }
  getHeadAzDeg() {
    return this.yaw * (180 / Math.PI);
  }
  getHeadElDeg() {
    return this.pitch * (180 / Math.PI);
  }
  dispose() {
    window.removeEventListener("mousemove", this.onMouse);
  }
}
class ExternalCamera {
  distance = 30;
  azimuth = Math.PI;
  // behind aircraft
  elevation = 0.3;
  isDragging = false;
  lastMouse = { x: 0, y: 0 };
  constructor() {
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("wheel", this.onWheel, { passive: true });
  }
  onMouseDown = (e) => {
    if (e.button === 2) {
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    }
  };
  onMouseMove = (e) => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;
    this.azimuth += dx * 6e-3;
    this.elevation = clamp(this.elevation - dy * 6e-3, -0.5, 1.2);
    this.lastMouse = { x: e.clientX, y: e.clientY };
  };
  onMouseUp = (e) => {
    if (e.button === 2) this.isDragging = false;
  };
  onWheel = (e) => {
    this.distance = clamp(this.distance + e.deltaY * 0.05, 8, 200);
  };
  update(camera, player) {
    const target = nedToThree(player.state.positionNED);
    const offset = new Vector3(
      Math.sin(this.azimuth) * Math.cos(this.elevation),
      Math.sin(this.elevation),
      Math.cos(this.azimuth) * Math.cos(this.elevation)
    ).multiplyScalar(this.distance);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.fov = 60;
    camera.updateProjectionMatrix();
  }
  dispose() {
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("wheel", this.onWheel);
  }
}
class CameraManager {
  mode = "COCKPIT";
  cockpit;
  external;
  camera;
  constructor(camera) {
    this.camera = camera;
    this.cockpit = new CockpitCamera();
    this.external = new ExternalCamera();
    window.addEventListener("keydown", this.onKey);
  }
  onKey = (e) => {
    if (e.code === "Tab") {
      e.preventDefault();
      this.mode = this.mode === "COCKPIT" ? "EXTERNAL" : "COCKPIT";
      if (this.mode === "EXTERNAL") document.exitPointerLock();
    }
  };
  update(player) {
    if (this.mode === "COCKPIT") {
      this.cockpit.update(this.camera, player);
    } else {
      this.external.update(this.camera, player);
    }
  }
  getMode() {
    return this.mode;
  }
  getHeadAzDeg() {
    return this.cockpit.getHeadAzDeg();
  }
  getHeadElDeg() {
    return this.cockpit.getHeadElDeg();
  }
  dispose() {
    window.removeEventListener("keydown", this.onKey);
    this.cockpit.dispose();
    this.external.dispose();
  }
}
function defaultDamageState() {
  return {
    zones: {
      ENGINE: 0,
      WING_LEFT: 0,
      WING_RIGHT: 0,
      FUSELAGE: 0,
      TAIL: 0,
      COCKPIT: 0
    },
    onFire: false,
    engineFailed: false,
    ejected: false
  };
}
const SEA_LEVEL_DENSITY = 1.225;
const SEA_LEVEL_TEMP = 288.15;
const SEA_LEVEL_PRESSURE = 101325;
const LAPSE_RATE = 65e-4;
const TROPOPAUSE_ALT = 11e3;
const TROPOPAUSE_TEMP = 216.65;
const GAS_CONSTANT = 287.05;
const GAMMA = 1.4;
const G0$3 = 9.80665;
function computeAtmosphere(altitudeM, speedMS) {
  altitudeM = Math.max(0, altitudeM);
  let tempK;
  let pressurePa;
  let densityKgM3;
  if (altitudeM <= TROPOPAUSE_ALT) {
    tempK = SEA_LEVEL_TEMP - LAPSE_RATE * altitudeM;
    const ratio = tempK / SEA_LEVEL_TEMP;
    pressurePa = SEA_LEVEL_PRESSURE * Math.pow(ratio, G0$3 / (LAPSE_RATE * GAS_CONSTANT));
    densityKgM3 = SEA_LEVEL_DENSITY * Math.pow(ratio, G0$3 / (LAPSE_RATE * GAS_CONSTANT) - 1);
  } else {
    tempK = TROPOPAUSE_TEMP;
    const dh = altitudeM - TROPOPAUSE_ALT;
    const factor = Math.exp(-G0$3 * dh / (GAS_CONSTANT * TROPOPAUSE_TEMP));
    pressurePa = 22632 * factor;
    densityKgM3 = 0.3639 * factor;
  }
  const speedOfSoundMS = Math.sqrt(GAMMA * GAS_CONSTANT * tempK);
  const dynamicPressurePa = 0.5 * densityKgM3 * speedMS * speedMS;
  return { densityKgM3, temperatureK: tempK, pressurePa, speedOfSoundMS, dynamicPressurePa };
}
function thrustLapseFactor(altitudeM) {
  return Math.max(0.05, 1 - altitudeM / 55e3);
}
function interp1D(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) {
      lo = i;
      break;
    }
  }
  const t = (x - xs[lo]) / (xs[lo + 1] - xs[lo]);
  return ys[lo] + t * (ys[lo + 1] - ys[lo]);
}
function interp2D(xs, ys, table, x, y) {
  const xi = clampIdx(xs, x);
  const yi = clampIdx(ys, y);
  const tx = (x - xs[xi]) / ((xs[xi + 1] ?? xs[xi]) - xs[xi] || 1);
  const ty = (y - ys[yi]) / ((ys[yi + 1] ?? ys[yi]) - ys[yi] || 1);
  const r0 = table[xi], r1 = table[Math.min(xi + 1, xs.length - 1)];
  const v00 = r0[yi], v01 = r0[Math.min(yi + 1, ys.length - 1)];
  const v10 = r1[yi], v11 = r1[Math.min(yi + 1, ys.length - 1)];
  return (1 - tx) * ((1 - ty) * v00 + ty * v01) + tx * ((1 - ty) * v10 + ty * v11);
}
function clampIdx(xs, x) {
  if (x <= xs[0]) return 0;
  if (x >= xs[xs.length - 1]) return xs.length - 2;
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) return i;
  }
  return xs.length - 2;
}
function computeAeroCoeffs(aero, alphaDeg, betaDeg, machNumber, pRad, qRad, rRad, wingspanM, macM, speedMS) {
  const { alphaBreakpointsDeg: alphaBP, machBreakpoints: machBP } = aero;
  const alphaLook = Math.max(alphaBP[0], Math.min(alphaBP[alphaBP.length - 1], alphaDeg));
  const machLook = Math.max(machBP[0], Math.min(machBP[machBP.length - 1], machNumber));
  const CL2 = interp2D(alphaBP, machBP, aero.CL, alphaLook, machLook);
  const CD2 = Math.max(0, interp2D(alphaBP, machBP, aero.CD, alphaLook, machLook));
  const Cm2 = interp2D(alphaBP, machBP, aero.Cm, alphaLook, machLook);
  const denom = 2 * Math.max(speedMS, 1);
  const pHat = pRad * wingspanM / denom;
  const qHat = qRad * macM / denom;
  const rHat = rRad * wingspanM / denom;
  const betaRad = betaDeg * (Math.PI / 180);
  const CY = aero.CYbeta * betaRad;
  const Cl = aero.Clbeta * betaRad + aero.Clp * pHat;
  const Cn = aero.Cnbeta * betaRad + aero.Cnr * rHat;
  const CmWithDamping = Cm2 + aero.Cmq * qHat;
  return { CL: CL2, CD: CD2, Cm: CmWithDamping, CY, Cl, Cn };
}
function computeControlDeltas(table, mach, elevatorRad, aileronRad, rudderRad) {
  const { machBreakpoints: bp } = table;
  const CLde = interp1D(bp, table.CLde, mach);
  const CMde = interp1D(bp, table.CMde, mach);
  const CLda = interp1D(bp, table.CLda, mach);
  const CNdr = interp1D(bp, table.CNdr, mach);
  return {
    dCL: CLde * elevatorRad,
    dCm: CMde * elevatorRad,
    dCl: CLda * aileronRad,
    dCn: CNdr * rudderRad
  };
}
function computeTotalMass(spec, fuelKg, stores) {
  const storeMass = stores.reduce((sum, s) => sum + s.massKg * (s.remainingRounds > 0 ? 1 : 0), 0);
  return spec.mass.emptyMassKg + Math.max(0, fuelKg) + storeMass;
}
function computeInertia(spec, fuelKg) {
  const baseMass = spec.mass.emptyMassKg + spec.mass.fuelCapacityKg / 2;
  const currentMass = spec.mass.emptyMassKg + fuelKg;
  const ratio = currentMass / baseMass;
  return {
    Ixx: spec.mass.IxxKgM2 * ratio,
    Iyy: spec.mass.IyyKgM2 * ratio,
    Izz: spec.mass.IzzKgM2 * ratio,
    Ixz: spec.mass.IxzKgM2
  };
}
function computeStoreDrag(stores) {
  return stores.reduce((sum, s) => sum + (s.remainingRounds > 0 ? s.dragPenalty : 0), 0);
}
const G0$2 = 9.80665;
function extractFromSV(sv) {
  const pos = [sv[0], sv[1], sv[2]];
  const vel = [sv[3], sv[4], sv[5]];
  const q = [sv[6], sv[7], sv[8], sv[9]];
  const omega = [sv[10], sv[11], sv[12]];
  return { pos, vel, q, omega };
}
function computeDerivative(sv, spec, controls, massKg, penalties, storeDragCD) {
  const { pos, vel, q, omega } = extractFromSV(sv);
  const [p, qr, r] = omega;
  const speedMS = Math.sqrt(vel[0] ** 2 + vel[1] ** 2 + vel[2] ** 2);
  const altM = -pos[2];
  const atm = computeAtmosphere(altM, speedMS);
  const mach = speedMS / Math.max(atm.speedOfSoundMS, 1);
  const velBody = quatRotateVec(quatConjugate(q), vel);
  const u = velBody[0], v_b = velBody[1], w = velBody[2];
  const vt = Math.max(Math.sqrt(u * u + v_b * v_b + w * w), 0.1);
  const alphaDeg = Math.atan2(w, Math.max(u, 0.1)) * RAD2DEG;
  const betaDeg = Math.asin(clamp(v_b / vt, -1, 1)) * RAD2DEG;
  const maxPitchRad = 25 * DEG2RAD;
  const maxRollRad = 25 * DEG2RAD;
  const maxYawRad = 20 * DEG2RAD;
  const pitchRad = -controls.pitch * maxPitchRad * penalties.pitchAuthorityMultiplier;
  const rollRad = controls.roll * maxRollRad * penalties.rollAuthorityMultiplier;
  const yawRad = controls.yaw * maxYawRad;
  const aeroCoeffs = computeAeroCoeffs(
    spec.aero,
    alphaDeg,
    betaDeg,
    mach,
    p,
    qr,
    r,
    spec.mass.wingspanM,
    spec.mass.macM,
    vt
  );
  const ctrlDeltas = computeControlDeltas(spec.controlEffectiveness, mach, pitchRad, rollRad, yawRad);
  const CL2 = aeroCoeffs.CL + ctrlDeltas.dCL;
  const CD2 = Math.max(0, aeroCoeffs.CD + storeDragCD);
  const Cm2 = aeroCoeffs.Cm + ctrlDeltas.dCm;
  const CY = aeroCoeffs.CY;
  const Cl = aeroCoeffs.Cl + ctrlDeltas.dCl;
  const Cn = aeroCoeffs.Cn + ctrlDeltas.dCn;
  const S = spec.mass.wingAreaM2;
  const b = spec.mass.wingspanM;
  const c = spec.mass.macM;
  const qBar = atm.dynamicPressurePa;
  const Fx_aero = (-CD2 * Math.cos(alphaDeg * DEG2RAD) + CL2 * Math.sin(alphaDeg * DEG2RAD)) * qBar * S;
  const Fy_aero = CY * qBar * S;
  const Fz_aero = (-CD2 * Math.sin(alphaDeg * DEG2RAD) - CL2 * Math.cos(alphaDeg * DEG2RAD)) * qBar * S;
  const throttle = clamp(controls.throttle, 0, 1);
  const isAB = throttle >= spec.engine.afterburnerThrottleMin;
  const maxThrust = isAB ? spec.engine.maxThrustWetN : spec.engine.maxThrustDryN;
  const idleThrust = spec.engine.idleThrustN;
  const thrustN = (idleThrust + (maxThrust - idleThrust) * throttle) * thrustLapseFactor(altM) * penalties.thrustMultiplier;
  const Fx_total = Fx_aero + thrustN;
  const Fy_total = Fy_aero;
  const Fz_total = Fz_aero;
  const gNED = [0, 0, G0$2];
  const gBody = quatRotateVec(quatConjugate(q), gNED);
  const Fx_grav = massKg * gBody[0];
  const Fy_grav = massKg * gBody[1];
  const Fz_grav = massKg * gBody[2];
  const Fx = Fx_total + Fx_grav;
  const Fy = Fy_total + Fy_grav;
  const Fz = Fz_total + Fz_grav;
  const ax_b = Fx / massKg;
  const ay_b = Fy / massKg;
  const az_b = Fz / massKg;
  const accelBody = [ax_b, ay_b, az_b];
  const accelNED = quatRotateVec(q, accelBody);
  const dvdt = [accelNED[0], accelNED[1], accelNED[2]];
  const L = Cl * qBar * S * b;
  const M = Cm2 * qBar * S * c;
  const N = Cn * qBar * S * b;
  const inertia = computeInertia(spec, 0);
  const { Ixx, Iyy, Izz, Ixz } = inertia;
  const det = Ixx * Izz - Ixz * Ixz;
  const pdot = (Izz * (L + Ixz * p * qr - (Izz - Iyy) * qr * r) + Ixz * (N + (Ixx - Iyy) * p * qr - Ixz * qr * r)) / det;
  const qdot = (M - (Ixx - Izz) * p * r - Ixz * (p * p - r * r)) / Iyy;
  const rdot = (Ixx * (N + (Ixx - Iyy) * p * qr - Ixz * qr * r) + Ixz * (L + Ixz * p * qr - (Izz - Iyy) * qr * r)) / det;
  const [qw, qx, qy, qz] = q;
  const dqw = 0.5 * (-qx * p - qy * qr - qz * r);
  const dqx = 0.5 * (qw * p + qy * r - qz * qr);
  const dqy = 0.5 * (qw * qr - qx * r + qz * p);
  const dqz = 0.5 * (qw * r + qx * qr - qy * p);
  return makeStateVec(
    vel,
    // dpos/dt = vel
    dvdt,
    // dvel/dt = accel
    [dqw, dqx, dqy, dqz],
    // dq/dt
    [pdot, qdot, rdot]
    // domega/dt
  );
}
function stepRK4(sv, spec, controls, massKg, penalties, storeDragCD, dt) {
  const k1 = computeDerivative(sv, spec, controls, massKg, penalties, storeDragCD);
  const sv2 = addSV(sv, scaleSV(k1, dt * 0.5));
  const k2 = computeDerivative(sv2, spec, controls, massKg, penalties, storeDragCD);
  const sv3 = addSV(sv, scaleSV(k2, dt * 0.5));
  const k3 = computeDerivative(sv3, spec, controls, massKg, penalties, storeDragCD);
  const sv4 = addSV(sv, scaleSV(k3, dt));
  const k4 = computeDerivative(sv4, spec, controls, massKg, penalties, storeDragCD);
  const result = addSV(sv, scaleSV(addSV4(k1, k2, k3, k4), dt / 6));
  const qLen = Math.sqrt(result[6] ** 2 + result[7] ** 2 + result[8] ** 2 + result[9] ** 2);
  if (qLen > 1e-6) {
    result[6] /= qLen;
    result[7] /= qLen;
    result[8] /= qLen;
    result[9] /= qLen;
  }
  if (-result[2] < 0) {
    result[2] = 0;
    if (result[5] > 0) result[5] = 0;
  }
  return result;
}
function computeDerivedState(sv, spec) {
  const { pos, vel, q, omega } = extractFromSV(sv);
  const speedMS = Math.sqrt(vel[0] ** 2 + vel[1] ** 2 + vel[2] ** 2);
  const altM = -pos[2];
  const atm = computeAtmosphere(altM, speedMS);
  const mach = speedMS / atm.speedOfSoundMS;
  const velBody = quatRotateVec(quatConjugate(q), vel);
  const u = velBody[0], v_b = velBody[1], w = velBody[2];
  const vt = Math.max(Math.sqrt(u * u + v_b * v_b + w * w), 0.1);
  const alphaDeg = Math.atan2(w, Math.max(u, 0.1)) * RAD2DEG;
  const betaDeg = Math.asin(clamp(v_b / vt, -1, 1)) * RAD2DEG;
  const iasMS = speedMS * Math.sqrt(atm.densityKgM3 / 1.225);
  const iasKts = iasMS * 1.94384;
  const gNED = [0, 0, G0$2];
  quatRotateVec(quatConjugate(q), gNED);
  const qBar = atm.dynamicPressurePa;
  const S = spec.mass.wingAreaM2;
  const CL2 = computeAeroCoeffs(
    spec.aero,
    alphaDeg,
    betaDeg,
    mach,
    omega[0],
    omega[1],
    omega[2],
    spec.mass.wingspanM,
    spec.mass.macM,
    vt
  ).CL;
  const liftN = CL2 * qBar * S;
  const massKg = computeTotalMass(spec, 0, []);
  const gCurrent = liftN / (massKg * G0$2);
  const [qw, qx, qy, qz] = q;
  const yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) * RAD2DEG;
  const pitch = Math.asin(clamp(2 * (qw * qy - qz * qx), -1, 1)) * RAD2DEG;
  const roll = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy)) * RAD2DEG;
  return {
    alphaDeg,
    betaDeg,
    mach,
    iasKts,
    altitudeM: altM,
    gCurrent,
    yaw,
    pitch,
    roll,
    speedMS,
    vviMps: -vel[2],
    // NED: negative z = upward
    headingDeg: (yaw + 360) % 360
  };
}
function addSV(a, b) {
  return a.map((v, i) => v + b[i]);
}
function scaleSV(a, s) {
  return a.map((v) => v * s);
}
function addSV4(k1, k2, k3, k4) {
  return k1.map((_, i) => k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}
function createPlaceholderAircraftMesh(aircraftId, nation) {
  const group = new Group();
  const color = nation === "USA" ? 6719658 : 8934724;
  const mat = new MeshPhongMaterial({ color });
  const fuselage = new Mesh(new BoxGeometry(8, 1, 1.2), mat);
  group.add(fuselage);
  const wingMat = new MeshPhongMaterial({ color: color - 1118481 });
  const wing = new Mesh(new BoxGeometry(1.5, 0.15, 6), wingMat);
  wing.position.set(1.5, -0.2, 0);
  group.add(wing);
  const hstab = new Mesh(new BoxGeometry(0.8, 0.12, 3.2), wingMat);
  hstab.position.set(-3.5, 0, 0);
  group.add(hstab);
  const vstab = new Mesh(new BoxGeometry(0.8, 1.4, 0.15), wingMat);
  vstab.position.set(-3.5, 0.6, 0);
  group.add(vstab);
  const canopy = new Mesh(
    new SphereGeometry(0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new MeshPhongMaterial({ color: 2241348, transparent: true, opacity: 0.6 })
  );
  canopy.position.set(2.8, 0.55, 0);
  group.add(canopy);
  const nozzle = new Object3D();
  nozzle.name = "nozzle";
  nozzle.position.set(-4, 0, 0);
  group.add(nozzle);
  group.rotation.y = Math.PI / 2;
  return group;
}
function applyHit(dmg, zone, severity) {
  dmg.zones[zone] = clamp(dmg.zones[zone] + severity, 0, 1);
  if (dmg.zones.ENGINE > 0.7) {
    dmg.engineFailed = true;
    dmg.onFire = true;
  }
  if (dmg.zones.FUSELAGE > 0.8 || dmg.zones.COCKPIT > 0.9) {
    dmg.engineFailed = true;
  }
}
function computeFlightPenalties(dmg) {
  const wl = dmg.zones.WING_LEFT;
  const wr = dmg.zones.WING_RIGHT;
  const en = dmg.zones.ENGINE;
  const tail = dmg.zones.TAIL;
  const rollMult = clamp(1 - (wl + wr) * 0.6, 0.1, 1);
  const pitchMult = clamp(1 - tail * 0.7, 0.1, 1);
  const thrustMult = dmg.engineFailed ? 0 : clamp(1 - en * 0.8, 0.05, 1);
  const asymDrag = Math.abs(wl - wr) * 0.05;
  return {
    thrustMultiplier: thrustMult,
    rollAuthorityMultiplier: rollMult,
    pitchAuthorityMultiplier: pitchMult,
    asymmetricDragCD: asymDrag,
    fuelLeakMultiplier: en > 0.5 ? 5 : 1
  };
}
let _entityCounter = 0;
class Aircraft {
  entityId;
  spec;
  state;
  damage;
  radar = null;
  mesh;
  scene;
  constructor(spec, stores, scene, entityId) {
    this.entityId = entityId ?? `aircraft_${++_entityCounter}`;
    this.spec = spec;
    this.scene = scene;
    const q = quatFromEulerZYX(0, 0, 0);
    const sv = makeStateVec([0, 0, -5e3], [250, 0, 0], q, [0, 0, 0]);
    this.state = {
      positionNED: [0, 0, -5e3],
      velocityNED: [250, 0, 0],
      attitudeQuat: q,
      angularRateBody: [0, 0, 0],
      alphaDeg: 2,
      betaDeg: 0,
      mach: 0.75,
      iasKts: 485,
      altitudeM: 5e3,
      gCurrent: 1,
      gMax: 1,
      headingDeg: 0,
      pitchDeg: 2,
      rollDeg: 0,
      vviMps: 0,
      throttle: 0.3,
      fuelKg: spec.mass.fuelCapacityKg,
      loadedStores: [...stores],
      totalMassKg: spec.mass.emptyMassKg + spec.mass.fuelCapacityKg,
      onGround: false,
      ejected: false,
      invincible: false,
      sv
    };
    this.damage = defaultDamageState();
    this.mesh = createPlaceholderAircraftMesh(spec.id, spec.nation);
    scene.add(this.mesh);
  }
  integrate(controls, dt) {
    const penalties = computeFlightPenalties(this.damage);
    const storeDrag = computeStoreDrag(this.state.loadedStores);
    const massKg = computeTotalMass(this.spec, this.state.fuelKg, this.state.loadedStores);
    const newSV = stepRK4(this.state.sv, this.spec, controls, massKg, penalties, storeDrag, dt);
    this.state.sv = newSV;
    this.state.positionNED = [newSV[0], newSV[1], newSV[2]];
    this.state.velocityNED = [newSV[3], newSV[4], newSV[5]];
    this.state.attitudeQuat = [newSV[6], newSV[7], newSV[8], newSV[9]];
    this.state.angularRateBody = [newSV[10], newSV[11], newSV[12]];
    const d = computeDerivedState(newSV, this.spec);
    this.state.alphaDeg = d.alphaDeg;
    this.state.betaDeg = d.betaDeg;
    this.state.mach = d.mach;
    this.state.iasKts = d.iasKts;
    this.state.altitudeM = d.altitudeM;
    this.state.gCurrent = d.gCurrent;
    this.state.gMax = Math.max(this.state.gMax, Math.abs(d.gCurrent));
    this.state.headingDeg = d.headingDeg;
    this.state.pitchDeg = d.pitch;
    this.state.rollDeg = d.roll;
    this.state.vviMps = d.vviMps;
    this.state.throttle = controls.throttle;
    this.state.totalMassKg = massKg;
    this.state.onGround = this.state.altitudeM <= 0.5;
    const isAB = controls.throttle >= this.spec.engine.afterburnerThrottleMin;
    const sfc = isAB ? this.spec.engine.sfcWet : this.spec.engine.sfcDry;
    const thrustEst = isAB ? this.spec.engine.maxThrustWetN : this.spec.engine.maxThrustDryN;
    const burn = sfc * thrustEst * dt * penalties.fuelLeakMultiplier;
    this.state.fuelKg = Math.max(0, this.state.fuelKg - burn);
  }
  updateMesh() {
    if (this.state.ejected) {
      this.mesh.visible = false;
      return;
    }
    const pos = nedToThree(this.state.positionNED);
    const quat = nedQuatToThree(this.state.attitudeQuat);
    this.mesh.position.copy(pos);
    this.mesh.quaternion.copy(quat);
  }
  dispose() {
    this.scene.remove(this.mesh);
  }
}
const G0$1 = 9.80665;
function updateGunRound(round, dt) {
  if (!round.active) return;
  const rho = 1.1;
  const A = Math.PI * (round.spec.roundDiameterM / 2) ** 2;
  const speed = v3len(round.velocityNED);
  const dragAccel = 0.5 * rho * round.spec.ballisticCd * A * speed * speed / round.spec.roundMassKg;
  const dragDir = speed > 0 ? [
    -round.velocityNED[0] / speed * dragAccel,
    -round.velocityNED[1] / speed * dragAccel,
    -round.velocityNED[2] / speed * dragAccel
  ] : [0, 0, 0];
  const gravity = [0, 0, G0$1];
  const accel = v3add(dragDir, gravity);
  round.velocityNED = v3add(round.velocityNED, v3scale(accel, dt));
  round.positionNED = v3add(round.positionNED, v3scale(round.velocityNED, dt));
  round.ageSec += dt;
  if (round.ageSec > 5 || round.positionNED[2] > 0) {
    round.active = false;
  }
}
const HIT_RADIUS = 5;
class GunSystem {
  spec;
  rounds = [];
  remainingRounds;
  fireTimer = 0;
  roundMeshes = [];
  scene;
  roundMat = new MeshBasicMaterial({ color: 16776960 });
  roundGeo = new SphereGeometry(0.15, 4, 4);
  constructor(spec, scene) {
    this.spec = spec;
    this.scene = scene;
    this.remainingRounds = spec?.totalRounds ?? 0;
  }
  fire(state, _spec) {
    if (!this.spec || this.remainingRounds <= 0) return;
    const interval = 60 / this.spec.rateOfFireRPM;
    if (this.fireTimer > 0) return;
    this.fireTimer = interval;
    const bodyForward = [1, 0, 0];
    const forwardNED = quatRotateVec(state.attitudeQuat, bodyForward);
    const vel = v3add(state.velocityNED, v3scale(forwardNED, this.spec.muzzleVelocityMS));
    const round = {
      positionNED: [...state.positionNED],
      velocityNED: vel,
      ageSec: 0,
      active: true,
      shooterEntityId: "player",
      spec: this.spec
    };
    this.rounds.push(round);
    const mesh = new Mesh(this.roundGeo, this.roundMat);
    mesh.position.copy(nedToThree(round.positionNED));
    this.scene.add(mesh);
    this.roundMeshes.push(mesh);
    this.remainingRounds--;
  }
  update(dt, enemies) {
    if (this.fireTimer > 0) this.fireTimer -= dt;
    for (let i = this.rounds.length - 1; i >= 0; i--) {
      const round = this.rounds[i];
      updateGunRound(round, dt);
      for (const enemy of enemies) {
        if (v3dist(round.positionNED, enemy.state.positionNED) < HIT_RADIUS) {
          round.active = false;
          applyHit(enemy.damage, "FUSELAGE", 0.2);
        }
      }
      const mesh = this.roundMeshes[i];
      if (round.active) {
        mesh.position.copy(nedToThree(round.positionNED));
      } else {
        this.scene.remove(mesh);
        this.rounds.splice(i, 1);
        this.roundMeshes.splice(i, 1);
      }
    }
  }
  getRoundsRemaining() {
    return this.remainingRounds;
  }
  refill() {
    this.remainingRounds = this.spec?.totalRounds ?? 0;
  }
  dispose() {
    for (const m of this.roundMeshes) this.scene.remove(m);
    this.roundGeo.dispose();
    this.roundMat.dispose();
  }
}
function computePNAcceleration(missilePos, missileVel, targetPos, targetVel, prevLOS, navigationConstant, dt) {
  const los = v3norm(v3sub(targetPos, missilePos));
  const relVel = v3sub(targetVel, missileVel);
  const closingSpeed = -v3dot(relVel, los);
  const dlos = v3scale(v3sub(los, prevLOS), 1 / dt);
  const omega = v3cross(los, dlos);
  const aPNMag = navigationConstant * closingSpeed;
  const accel = [
    aPNMag * omega[0],
    aPNMag * omega[1],
    aPNMag * omega[2]
  ];
  return { accel, newLOS: los };
}
function guideMissile(missile, targetState, dt) {
  const { accel, newLOS } = computePNAcceleration(
    missile.positionNED,
    missile.velocityNED,
    targetState.positionNED,
    targetState.velocityNED,
    missile.prevLOSUnit,
    missile.spec.navigationConstant,
    dt
  );
  missile.prevLOSUnit = newLOS;
  const G02 = 9.80665;
  const maxAccel = missile.spec.maxGOverload * G02;
  const accelMag = v3len(accel);
  if (accelMag > maxAccel) {
    return v3scale(accel, maxAccel / accelMag);
  }
  return accel;
}
function checkProximityFuse(missile, targetState) {
  const dist = v3dist(missile.positionNED, targetState.positionNED);
  if (dist <= missile.spec.proxFuseRadiusM) return true;
  return false;
}
function computeLethality(detonationPos, targetPos, lethalRadiusM) {
  const dist = v3dist(detonationPos, targetPos);
  if (dist <= lethalRadiusM) return 1;
  if (dist > lethalRadiusM * 3) return 0;
  return Math.max(0, 1 - (dist - lethalRadiusM) / (lethalRadiusM * 2));
}
function hitZoneFromMissileApproach(missileVelNED, targetQuat) {
  const v = missileVelNED;
  const spd = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  if (spd < 1) return "FUSELAGE";
  if (v[2] < -spd * 0.5) return "ENGINE";
  if (Math.abs(v[1]) > spd * 0.4) return Math.random() < 0.5 ? "WING_LEFT" : "WING_RIGHT";
  return "FUSELAGE";
}
class ExplosionManager {
  scene;
  explosions = [];
  constructor(scene) {
    this.scene = scene;
  }
  spawn(worldPos) {
    const count = 80;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = worldPos.x;
      positions[i * 3 + 1] = worldPos.y;
      positions[i * 3 + 2] = worldPos.z;
      const speed = 15 + Math.random() * 35;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
      velocities[i * 3 + 1] = speed * Math.cos(phi) + 10;
      velocities[i * 3 + 2] = speed * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    const pts = new Points(geo, new PointsMaterial({
      color: 16737792,
      size: 3,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false
    }));
    this.scene.add(pts);
    this.explosions.push({ particles: pts, geo, velocities, age: 0, lifetime: 2 });
  }
  update(dt) {
    for (let e = this.explosions.length - 1; e >= 0; e--) {
      const exp = this.explosions[e];
      exp.age += dt;
      const t = exp.age / exp.lifetime;
      const pos = exp.geo.attributes["position"].array;
      for (let i = 0; i < pos.length / 3; i++) {
        const vi = i * 3;
        pos[vi] += (exp.velocities[vi] ?? 0) * dt;
        pos[vi + 1] += (exp.velocities[vi + 1] ?? 0) * dt - 9.8 * dt * exp.age;
        pos[vi + 2] += (exp.velocities[vi + 2] ?? 0) * dt;
      }
      exp.geo.attributes["position"].needsUpdate = true;
      exp.particles.material.opacity = Math.max(0, 1 - t);
      exp.particles.material.color.setHSL(0.1 - t * 0.1, 1, 0.5);
      if (exp.age >= exp.lifetime) {
        this.scene.remove(exp.particles);
        exp.geo.dispose();
        this.explosions.splice(e, 1);
      }
    }
  }
  dispose() {
    for (const e of this.explosions) {
      this.scene.remove(e.particles);
      e.geo.dispose();
    }
  }
}
const MISSILE_SPECS = { aim9m: AIM9M, aim120b: AIM120B, r73: R73, r77: R77 };
const G0 = 9.80665;
class MissileSystem {
  missiles = [];
  meshes = [];
  scene;
  explosions;
  missileMat = new MeshPhongMaterial({ color: 14540253 });
  missileGeo = new CylinderGeometry(0.1, 0.1, 2.5, 6);
  constructor(scene) {
    this.scene = scene;
    this.explosions = new ExplosionManager(scene);
  }
  launch(weaponId, shooterState, targetId, shooterEntityId) {
    const spec = MISSILE_SPECS[weaponId];
    if (!spec) return;
    const bodyForward = [1, 0, 0];
    const forwardNED = quatRotateVec(shooterState.attitudeQuat, bodyForward);
    const initVel = v3add(shooterState.velocityNED, v3scale(forwardNED, 50));
    const missile = {
      id: `missile_${Date.now()}_${Math.random()}`,
      spec,
      positionNED: [...shooterState.positionNED],
      velocityNED: initVel,
      attitudeQuat: [...shooterState.attitudeQuat],
      ageSec: 0,
      burnActive: true,
      targetEntityId: targetId,
      guidanceMode: spec.category === "IR_MISSILE" ? "IR_TRACK" : "INERTIAL",
      seekerAzDeg: 0,
      seekerElDeg: 0,
      locked: true,
      prevLOSUnit: v3norm(forwardNED),
      active: true,
      shooterEntityId
    };
    this.missiles.push(missile);
    const mesh = new Mesh(this.missileGeo, this.missileMat);
    this.scene.add(mesh);
    this.meshes.push(mesh);
  }
  update(dt, shooterState, enemies) {
    this.explosions.update(dt);
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.ageSec += dt;
      if (m.burnActive && m.ageSec > m.spec.burnTimeSec) m.burnActive = false;
      const thrustAccel = m.burnActive ? m.spec.maxThrustN / m.spec.massKg : 0;
      const target = enemies.find((e) => e.entityId === m.targetEntityId) ?? (m.targetEntityId === "player" ? null : null);
      let guidanceAccel = [0, 0, 0];
      if (target && m.locked) {
        guidanceAccel = guideMissile(m, target.state, dt);
        if (checkProximityFuse(m, target.state)) {
          const lethality = computeLethality(m.positionNED, target.state.positionNED, m.spec.lethalRadiusM);
          if (lethality > 0.3) {
            const zone = hitZoneFromMissileApproach(m.velocityNED, target.state.attitudeQuat);
            applyHit(target.damage, zone, lethality * 0.6);
          }
          this.explode(i, m);
          continue;
        }
      }
      const speed = v3len(m.velocityNED);
      const rho = 0.9;
      const A = Math.PI * (m.spec.bodyDiameterM / 2) ** 2;
      const dragAccel = 0.5 * rho * m.spec.dragCd * A * speed * speed / m.spec.massKg;
      const dragDir = speed > 0.1 ? v3scale(v3norm(m.velocityNED), -dragAccel) : [0, 0, 0];
      const gravity = [0, 0, G0];
      const forward = v3norm(m.velocityNED);
      const thrustVec = v3scale(forward, thrustAccel);
      const totalAccel = v3add(v3add(v3add(thrustVec, dragDir), gravity), guidanceAccel);
      m.velocityNED = v3add(m.velocityNED, v3scale(totalAccel, dt));
      m.positionNED = v3add(m.positionNED, v3scale(m.velocityNED, dt));
      if (m.ageSec > m.spec.maxRangeM / 400 || m.positionNED[2] > 0) {
        this.explode(i, m);
        continue;
      }
      const mesh = this.meshes[i];
      mesh.position.copy(nedToThree(m.positionNED));
      if (speed > 1) {
        const dir = nedToThree(m.velocityNED).normalize();
        mesh.lookAt(mesh.position.clone().add(dir));
      }
    }
  }
  explode(i, m) {
    this.explosions.spawn(nedToThree(m.positionNED));
    this.scene.remove(this.meshes[i]);
    this.missiles.splice(i, 1);
    this.meshes.splice(i, 1);
  }
  getMissiles() {
    return this.missiles;
  }
  dispose() {
    for (const m of this.meshes) this.scene.remove(m);
    this.missileMat.dispose();
    this.missileGeo.dispose();
    this.explosions.dispose();
  }
}
function computeDetectionRange(spec, targetRcsM2) {
  const Pt = spec.nation === "USA" ? 12e3 : 1e4;
  const G = 2e3;
  const freq = 1e10;
  const c = 3e8;
  const lambda = c / freq;
  const Pmin = 1e-12;
  const L = 6;
  const numerator = Pt * G * G * lambda * lambda * targetRcsM2;
  const denominator = Math.pow(4 * Math.PI, 3) * Pmin * L;
  return Math.pow(numerator / denominator, 0.25);
}
function isInScanBeam(radarState, ownState, targetState) {
  const toTarget = v3sub(targetState.positionNED, ownState.positionNED);
  const toTargetBody = quatRotateVec(quatConjugate(ownState.attitudeQuat), toTarget);
  const range = Math.sqrt(toTargetBody[0] ** 2 + toTargetBody[1] ** 2 + toTargetBody[2] ** 2);
  if (range < 1) return false;
  const azDeg = Math.atan2(toTargetBody[1], toTargetBody[0]) * (180 / Math.PI);
  const elDeg = Math.asin(-toTargetBody[2] / range) * (180 / Math.PI);
  const beamWidthDeg = 3;
  const azInBeam = Math.abs(azDeg - radarState.azimuthDeg) < beamWidthDeg;
  const elInBeam = Math.abs(elDeg - radarState.elevationBarDeg) < 4;
  return azInBeam && elInBeam;
}
class Radar {
  state;
  spec;
  time = 0;
  constructor(spec) {
    this.spec = spec;
    this.state = {
      mode: "RWS",
      azimuthDeg: -60,
      elevationBarDeg: 6,
      barIndex: 0,
      scanBarsElDeg: [6, 2, -2, -6],
      scanRateDegs: 60,
      tracks: [],
      sttTargetId: null,
      rangeModeM: 74080,
      // 40nm default
      lastFullScanSec: 0
    };
  }
  update(dt, ownState, enemies, cycleMode) {
    this.time += dt;
    if (cycleMode) this.cycleMode();
    if (this.state.mode === "OFF") return;
    this.state.azimuthDeg += this.state.scanRateDegs * dt;
    if (this.state.azimuthDeg > 60) {
      this.state.azimuthDeg = -60;
      this.state.barIndex = (this.state.barIndex + 1) % this.state.scanBarsElDeg.length;
      this.state.elevationBarDeg = this.state.scanBarsElDeg[this.state.barIndex] ?? 6;
    }
    if (this.state.mode === "STT" && this.state.sttTargetId) {
      const target = enemies.find((e) => e.entityId === this.state.sttTargetId);
      if (target) {
        this.updateTrack(target, ownState);
      } else {
        this.state.sttTargetId = null;
        this.state.mode = "TWS";
      }
      return;
    }
    for (const enemy of enemies) {
      const dist = v3dist(ownState.positionNED, enemy.state.positionNED);
      if (dist > this.state.rangeModeM * 1.2) continue;
      const rcs = this.getTargetRCS(enemy);
      const maxRange = computeDetectionRange(this.spec, rcs);
      if (dist > maxRange) continue;
      if (isInScanBeam(this.state, ownState, enemy.state)) {
        this.updateTrack(enemy, ownState);
      }
    }
    this.state.tracks = this.state.tracks.filter((t) => {
      t.confidence = Math.max(0, t.confidence - dt * 0.1);
      return t.confidence > 0.05;
    });
    if (this.state.mode === "TWS" && this.state.tracks.length > 0 && !this.state.sttTargetId) ;
  }
  updateTrack(enemy, ownState) {
    const existing = this.state.tracks.find((t) => t.entityId === enemy.entityId);
    if (existing) {
      existing.positionNED = enemy.state.positionNED;
      existing.velocityNED = enemy.state.velocityNED;
      existing.lastUpdateSec = this.time;
      existing.confidence = 1;
    } else if (this.state.tracks.length < 8) {
      this.state.tracks.push({
        entityId: enemy.entityId,
        positionNED: enemy.state.positionNED,
        velocityNED: enemy.state.velocityNED,
        rcsM2: this.getTargetRCS(enemy),
        lastUpdateSec: this.time,
        confidence: 1,
        isSTT: false
      });
      if (this.state.mode === "RWS") this.state.mode = "TWS";
    }
  }
  getTargetRCS(enemy) {
    return enemy.spec.rcsTableM2[0] ?? 5;
  }
  cycleMode() {
    const modes = ["OFF", "RWS", "TWS", "STT"];
    const idx = modes.indexOf(this.state.mode);
    this.state.mode = modes[(idx + 1) % modes.length];
  }
  getSttTargetId() {
    if (this.state.mode !== "STT") return this.state.tracks[0]?.entityId ?? null;
    return this.state.sttTargetId;
  }
  lockSTT(entityId) {
    this.state.mode = "STT";
    this.state.sttTargetId = entityId;
    const t = this.state.tracks.find((t2) => t2.entityId === entityId);
    if (t) t.isSTT = true;
  }
}
class RWR {
  state = { threats: [] };
  update(enemies, ownState) {
    this.state.threats = [];
    for (const enemy of enemies) {
      if (!enemy.radar?.state || enemy.radar.state.mode === "OFF") continue;
      const rs = enemy.radar.state;
      const toEnemy = v3sub(enemy.state.positionNED, ownState.positionNED);
      const bodyVec = quatRotateVec(quatConjugate(ownState.attitudeQuat), toEnemy);
      const azDeg = Math.atan2(bodyVec[1], bodyVec[0]) * RAD2DEG;
      rs.tracks.some((t) => t.entityId === "player");
      const isSTT = rs.mode === "STT" && rs.sttTargetId === "player";
      this.state.threats.push({
        entityId: enemy.entityId,
        azimuthDeg: azDeg,
        type: isSTT ? "TRACK" : "SEARCH",
        priority: isSTT ? 3 : 1
      });
    }
  }
}
class CMDS {
  flareCount = 30;
  chaffCount = 30;
  flares = [];
  flareTimer = 0;
  FLARE_COOLDOWN = 0.5;
  dispenseFlare(posNED) {
    if (this.flareCount <= 0 || this.flareTimer > 0) return;
    this.flareCount--;
    this.flareTimer = this.FLARE_COOLDOWN;
    this.flares.push({
      positionNED: [...posNED],
      heatSignatureKW: 60,
      // bright flare
      ageSec: 0
    });
  }
  dispenseChaff(posNED) {
    if (this.chaffCount <= 0) return;
    this.chaffCount--;
  }
  update(dt) {
    if (this.flareTimer > 0) this.flareTimer -= dt;
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.ageSec += dt;
      f.heatSignatureKW = Math.max(0, 60 * (1 - f.ageSec / 4));
      if (f.ageSec > 4) this.flares.splice(i, 1);
    }
  }
}
class HMS {
  state = {
    cursorAzDeg: 0,
    cursorElDeg: 0,
    locked: false,
    lockedEntityId: null,
    enabled: true
  };
  update(ownState) {
  }
  setHeadDir(azDeg, elDeg) {
    this.state.cursorAzDeg = azDeg;
    this.state.cursorElDeg = elDeg;
  }
  lockOn(entityId) {
    this.state.locked = true;
    this.state.lockedEntityId = entityId;
  }
  breakLock() {
    this.state.locked = false;
    this.state.lockedEntityId = null;
  }
}
const MS_TO_KTS = 1.94384;
const M_TO_FT = 3.28084;
const msToKts = (v) => v * MS_TO_KTS;
const mToFt = (v) => v * M_TO_FT;
const mToNm = (m) => m / 1852;
class GPWS {
  lastAltFt = 0;
  warningCooldown = 0;
  WARN_INTERVAL = 3;
  update(state, dt, audioCallback) {
    if (this.warningCooldown > 0) {
      this.warningCooldown -= dt;
    }
    const altFt = mToFt(-state.positionNED[2]);
    const climbRateFtMin = (altFt - this.lastAltFt) / dt * 60;
    this.lastAltFt = altFt;
    const descending = climbRateFtMin < -200;
    if (this.warningCooldown <= 0) {
      if (altFt < 200 && descending) {
        audioCallback("PULL_UP_URGENT");
        this.warningCooldown = 1.5;
      } else if (altFt < 500 && descending) {
        audioCallback("PULL_UP");
        this.warningCooldown = this.WARN_INTERVAL;
      }
    }
  }
}
class PlayerAircraft extends Aircraft {
  gun;
  missiles;
  radar;
  rwr;
  cmds;
  hms;
  gpws;
  selectedWeaponIndex = 0;
  ejectKeyPrev = false;
  constructor(spec, stores, scene) {
    super(spec, stores, scene, "player");
    this.gun = new GunSystem(spec.gunSpec, scene);
    this.missiles = new MissileSystem(scene);
    const radarSys = new Radar(spec);
    this.radar = radarSys;
    this.rwr = new RWR();
    this.cmds = new CMDS();
    this.hms = new HMS();
    this.gpws = new GPWS();
    if (stores.length === 0) this.applyDefaultLoadout();
  }
  applyDefaultLoadout() {
    const irId = this.spec.nation === "USA" ? "aim9m" : "r73";
    const arhId = this.spec.nation === "USA" ? "aim120b" : "r77";
    const irHps = this.spec.hardpoints.filter((h) => h.compatibleTypes.includes("IR_MISSILE")).slice(0, 2);
    const arhHps = this.spec.hardpoints.filter((h) => h.compatibleTypes.includes("ARH_MISSILE")).slice(0, 4);
    for (const hp of irHps) {
      this.state.loadedStores.push({ hardpointId: hp.id, weaponId: irId, category: "IR_MISSILE", massKg: 100, dragPenalty: 2e-3, remainingRounds: 1 });
    }
    for (const hp of arhHps) {
      this.state.loadedStores.push({ hardpointId: hp.id, weaponId: arhId, category: "ARH_MISSILE", massKg: 155, dragPenalty: 3e-3, remainingRounds: 1 });
    }
  }
  update(dt, controls) {
    if (this.state.ejected) return;
    const ejectKey = document.getElementById("three-canvas") !== null && window._fsimEjectPressed === true;
    if (ejectKey && !this.ejectKeyPrev) this.eject();
    this.ejectKeyPrev = ejectKey;
    this.integrate(controls, dt);
    const enemies = window._fsimEnemies ?? [];
    if (controls.fireGun) this.gun.fire(this.state, this.spec);
    this.gun.update(dt, enemies);
    if (controls.fireMissile) this.fireMissile(enemies);
    this.missiles.update(dt, this.state, enemies);
    if (controls.cycleMissile) this.cycleWeapon();
    if (controls.dispenseFlare) this.cmds.dispenseFlare(this.state.positionNED);
    if (controls.dispenseChaff) this.cmds.dispenseChaff(this.state.positionNED);
    this.cmds.update(dt);
    this.radar.update(dt, this.state, enemies, controls.radarModeNext);
    this.rwr.update(enemies, this.state);
    this.hms.update(this.state);
    this.gpws.update(this.state, dt, (_event) => {
      window["_fsimGPWSEvent"] = _event;
    });
  }
  fireMissile(enemies) {
    const store = this.getSelectedMissileStore();
    if (!store || store.remainingRounds <= 0) return;
    let targetId = this.radar.getSttTargetId() ?? this.hms.state.lockedEntityId;
    if (!targetId && enemies.length > 0) {
      const nearest = enemies.reduce((a, b) => {
        const da = Math.hypot(...a.state.positionNED.map((v, i) => v - this.state.positionNED[i]));
        const db = Math.hypot(...b.state.positionNED.map((v, i) => v - this.state.positionNED[i]));
        return da < db ? a : b;
      });
      targetId = nearest.entityId;
    }
    if (!targetId) return;
    this.missiles.launch(store.weaponId, this.state, targetId, "player");
    store.remainingRounds = 0;
  }
  getSelectedMissileStore() {
    const missileStores = this.state.loadedStores.filter(
      (s) => (s.category === "IR_MISSILE" || s.category === "ARH_MISSILE") && s.remainingRounds > 0
    );
    return missileStores[this.selectedWeaponIndex % Math.max(1, missileStores.length)] ?? null;
  }
  getSelectedWeaponName() {
    const store = this.getSelectedMissileStore();
    if (!store) return this.spec.gunSpec ? "GUN" : "NONE";
    return store.weaponId.toUpperCase();
  }
  cycleWeapon() {
    const count = this.state.loadedStores.filter((s) => s.remainingRounds > 0 && s.category !== "FUEL_TANK").length;
    if (count > 0) this.selectedWeaponIndex = (this.selectedWeaponIndex + 1) % count;
  }
  eject() {
    if (this.state.ejected) return;
    this.state.ejected = true;
    this.damage.ejected = true;
    console.log("EJECT EJECT EJECT");
  }
  reloadWeapons() {
    for (const store of this.state.loadedStores) store.remainingRounds = 1;
    this.gun.refill();
  }
  resetPosition() {
    const q = [1, 0, 0, 0];
    this.state.sv = [0, 0, -5e3, 250, 0, 0, 1, 0, 0, 0, 0, 0, 0];
    this.state.positionNED = [0, 0, -5e3];
    this.state.velocityNED = [250, 0, 0];
    this.state.attitudeQuat = q;
    this.state.angularRateBody = [0, 0, 0];
    this.state.ejected = false;
    this.state.fuelKg = this.spec.mass.fuelCapacityKg;
    this.mesh.visible = true;
  }
  getRWRState() {
    return this.rwr.state;
  }
  getHMSState() {
    return this.hms.state;
  }
}
class AIAircraft extends Aircraft {
  behavior;
  initPositionNED;
  constructor(spec, stores, scene, behavior, spawnPos, spawnVel) {
    super(spec, stores, scene);
    this.behavior = behavior;
    this.initPositionNED = [...spawnPos];
    this.state.positionNED = [...spawnPos];
    this.state.velocityNED = [...spawnVel];
    const q = quatFromEulerZYX(0, 0, 0);
    this.state.sv = makeStateVec(spawnPos, spawnVel, q, [0, 0, 0]);
    this.state.attitudeQuat = [...q];
  }
  update(controls, dt) {
    if (this.state.ejected) return;
    this.integrate(controls, dt);
  }
  // Expose missiles for debug overlay
  get missiles() {
    return null;
  }
}
const FOLLOW_DIST_M = 700;
function followBehind(self, leader, _dt) {
  const leaderPos = leader.state.positionNED;
  const selfPos = self.state.positionNED;
  const bodyBack = [-1, 0, 0];
  const leaderBack = quatRotateVec(leader.state.attitudeQuat, bodyBack);
  const desired = [
    leaderPos[0] + leaderBack[0] * FOLLOW_DIST_M,
    leaderPos[1] + leaderBack[1] * FOLLOW_DIST_M,
    leaderPos[2] + leaderBack[2] * FOLLOW_DIST_M
  ];
  const toDesired = v3sub(desired, selfPos);
  const dist = v3len(toDesired);
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toDesired);
  const azErr = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG;
  const elErr = Math.atan2(-bodyDir[2], bodyDir[0]) * RAD2DEG;
  const speedErr = leader.state.iasKts - self.state.iasKts;
  const throttle = Math.max(0, Math.min(1, self.state.throttle + speedErr * 2e-3 + (dist > FOLLOW_DIST_M ? 0.1 : -0.05)));
  const pitch = Math.max(-1, Math.min(1, -elErr / 20));
  const roll = Math.max(-1, Math.min(1, azErr / 20));
  return { pitch, roll, yaw: 0, throttle, fireMissile: false, fireGun: false, cycleMissile: false, dispenseFlare: false, dispenseChaff: false, radarModeNext: false };
}
const LEAD_DIST_M = 500;
function followInFront(self, leader, _dt) {
  const leaderPos = leader.state.positionNED;
  const selfPos = self.state.positionNED;
  const bodyFwd = [1, 0, 0];
  const leaderFwd = quatRotateVec(leader.state.attitudeQuat, bodyFwd);
  const desired = [
    leaderPos[0] + leaderFwd[0] * LEAD_DIST_M,
    leaderPos[1] + leaderFwd[1] * LEAD_DIST_M,
    leaderPos[2] + leaderFwd[2] * LEAD_DIST_M
  ];
  const toDesired = v3sub(desired, selfPos);
  const dist = v3len(toDesired);
  const bodyDir = quatRotateVec(quatConjugate(self.state.attitudeQuat), toDesired);
  const azErr = Math.atan2(bodyDir[1], bodyDir[0]) * RAD2DEG;
  const elErr = Math.atan2(-bodyDir[2], bodyDir[0]) * RAD2DEG;
  const speedErr = leader.state.iasKts - self.state.iasKts;
  const throttle = Math.max(0, Math.min(1, self.state.throttle + speedErr * 2e-3 + (dist > LEAD_DIST_M ? 0.1 : -0.05)));
  const pitch = Math.max(-1, Math.min(1, -elErr / 20));
  const roll = Math.max(-1, Math.min(1, azErr / 20));
  return { pitch, roll, yaw: 0, throttle, fireMissile: false, fireGun: false, cycleMissile: false, dispenseFlare: false, dispenseChaff: false, radarModeNext: false };
}
function flyStraight(self, _dt) {
  const altErr = self.state.positionNED[2] - self.initPositionNED[2];
  const pitch = Math.max(-0.3, Math.min(0.3, altErr * 0.01 + self.state.pitchDeg * -0.03));
  const roll = Math.max(-0.5, Math.min(0.5, -self.state.rollDeg * 0.04));
  const throttle = 0.6;
  return { pitch, roll, yaw: 0, throttle, fireMissile: false, fireGun: false, cycleMissile: false, dispenseFlare: false, dispenseChaff: false, radarModeNext: false };
}
function turnConstantly(self, _dt) {
  const altErr = self.state.positionNED[2] - self.initPositionNED[2];
  const pitch = Math.max(-0.3, Math.min(0.6, altErr * 0.01 + 0.15));
  const roll = 0.6;
  const throttle = 0.75;
  return { pitch, roll, yaw: 0, throttle, fireMissile: false, fireGun: false, cycleMissile: false, dispenseFlare: false, dispenseChaff: false, radarModeNext: false };
}
function runAIBrain(self, player, dt) {
  switch (self.behavior) {
    case "FOLLOW_BEHIND":
      return followBehind(self, player);
    case "FOLLOW_IN_FRONT":
      return followInFront(self, player);
    case "FLY_STRAIGHT":
      return flyStraight(self);
    case "TURN_CONSTANTLY":
      return turnConstantly(self);
  }
}
class EntityManager {
  enemies = [];
  scene;
  player;
  killCount = 0;
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    window["_fsimEnemies"] = this.enemies;
  }
  spawnEnemy(spec, stores, behavior, spawnPos, spawnVel) {
    const ai = new AIAircraft(spec, stores, this.scene, behavior, spawnPos, spawnVel);
    this.enemies.push(ai);
    return ai;
  }
  despawn(entityId) {
    const idx = this.enemies.findIndex((e) => e.entityId === entityId);
    if (idx < 0) return;
    const ai = this.enemies[idx];
    this.scene.remove(ai.mesh);
    this.enemies.splice(idx, 1);
    this.killCount++;
  }
  update(dt, player) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const ai = this.enemies[i];
      if (ai.state.ejected || ai.damage.zones["ENGINE"] > 0.95) {
        this.despawn(ai.entityId);
        continue;
      }
      const controls = runAIBrain(ai, player);
      ai.update(controls, dt);
    }
  }
  updateMeshes() {
    for (const ai of this.enemies) ai.updateMesh();
  }
  getEnemies() {
    return this.enemies;
  }
  dispose() {
    for (const ai of this.enemies) this.scene.remove(ai.mesh);
    this.enemies.length = 0;
  }
}
const DEFAULT_BINDINGS = {
  pitchUp: "KeyS",
  pitchDown: "KeyW",
  rollLeft: "KeyA",
  rollRight: "KeyD",
  yawLeft: "KeyQ",
  yawRight: "KeyE",
  throttleUp: "ShiftLeft",
  throttleDown: "ControlLeft",
  fireGun: "Space",
  fireMissile: "KeyF",
  cycleMissile: "KeyC",
  flare: "KeyZ",
  chaff: "KeyX",
  radarMode: "KeyR"
};
class InputManager {
  keys = /* @__PURE__ */ new Set();
  throttle = 0.3;
  fireMissilePrev = false;
  cycleMissilePrev = false;
  radarModePrev = false;
  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  onKeyDown = (e) => {
    this.keys.add(e.code);
    if (e.code === DEFAULT_BINDINGS.throttleUp)
      this.throttle = clamp(this.throttle + 0.05, 0, 1);
    if (e.code === DEFAULT_BINDINGS.throttleDown)
      this.throttle = clamp(this.throttle - 0.05, 0, 1);
  };
  onKeyUp = (e) => {
    this.keys.delete(e.code);
  };
  axis(posCode, negCode) {
    const pos = this.keys.has(posCode) ? 1 : 0;
    const neg = this.keys.has(negCode) ? 1 : 0;
    return pos - neg;
  }
  getControls() {
    const gp = navigator.getGamepads()[0];
    let pitch = 0, roll = 0, yaw = 0;
    if (gp) {
      roll = gp.axes[0] ?? 0;
      pitch = -(gp.axes[1] ?? 0);
      yaw = gp.axes[2] ?? 0;
      const rtrigger = gp.buttons[7]?.value ?? 0;
      const ltrigger = gp.buttons[6]?.value ?? 0;
      this.throttle = clamp(this.throttle + (rtrigger - ltrigger) * 0.02, 0, 1);
    } else {
      pitch = this.axis(DEFAULT_BINDINGS.pitchUp, DEFAULT_BINDINGS.pitchDown);
      roll = this.axis(DEFAULT_BINDINGS.rollRight, DEFAULT_BINDINGS.rollLeft);
      yaw = this.axis(DEFAULT_BINDINGS.yawRight, DEFAULT_BINDINGS.yawLeft);
    }
    const fireMissile = this.keys.has(DEFAULT_BINDINGS.fireMissile);
    const cycleMissile = this.keys.has(DEFAULT_BINDINGS.cycleMissile);
    const radarMode = this.keys.has(DEFAULT_BINDINGS.radarMode);
    const fireMissileEdge = fireMissile && !this.fireMissilePrev;
    const cycleMissileEdge = cycleMissile && !this.cycleMissilePrev;
    const radarModeEdge = radarMode && !this.radarModePrev;
    this.fireMissilePrev = fireMissile;
    this.cycleMissilePrev = cycleMissile;
    this.radarModePrev = radarMode;
    return {
      pitch,
      roll,
      yaw,
      throttle: this.throttle,
      fireGun: this.keys.has(DEFAULT_BINDINGS.fireGun),
      fireMissile: fireMissileEdge,
      cycleMissile: cycleMissileEdge,
      dispenseFlare: this.keys.has(DEFAULT_BINDINGS.flare),
      dispenseChaff: this.keys.has(DEFAULT_BINDINGS.chaff),
      radarModeNext: radarModeEdge
    };
  }
  setThrottle(v) {
    this.throttle = clamp(v, 0, 1);
  }
  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
}
function drawAttitudeIndicator(ctx, cx, cy, pitchDeg, rollDeg) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-rollDeg * Math.PI / 180);
  const pxPerDeg = 6;
  for (let p = -40; p <= 40; p += 5) {
    if (p === 0) continue;
    const y = (p - pitchDeg) * pxPerDeg;
    const len = p % 10 === 0 ? 35 : 18;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-len, -y);
    ctx.lineTo(-5, -y);
    ctx.moveTo(5, -y);
    ctx.lineTo(len, -y);
    ctx.stroke();
    if (p % 10 === 0) {
      ctx.globalAlpha = 0.9;
      ctx.fillText(`${Math.abs(p)}`, len + 3, -y + 4);
      ctx.fillText(`${Math.abs(p)}`, -len - 20, -y + 4);
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const horizY = pitchDeg * pxPerDeg;
  ctx.moveTo(-60, horizY);
  ctx.lineTo(-10, horizY);
  ctx.moveTo(10, horizY);
  ctx.lineTo(60, horizY);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.restore();
}
function drawAirspeed(ctx, x, cy, iasMs) {
  const kts = Math.round(msToKts(iasMs));
  const h = 120, tickH = 8;
  ctx.strokeRect(x, cy - h / 2, 44, h);
  for (let v = kts - 100; v <= kts + 100; v += 10) {
    const dy = (kts - v) / 100 * (h / 2);
    if (Math.abs(dy) > h / 2) continue;
    const isMajor = v % 50 === 0;
    ctx.beginPath();
    ctx.moveTo(x + 44, cy + dy);
    ctx.lineTo(x + 44 - (isMajor ? tickH : tickH / 2), cy + dy);
    ctx.stroke();
    if (isMajor) ctx.fillText(`${v}`, x + 2, cy + dy + 4);
  }
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - 2, cy - 10, 48, 20);
  ctx.fillStyle = "#00ff44";
  ctx.font = "bold 14px monospace";
  ctx.fillText(`${kts}`, x + 2, cy + 5);
  ctx.font = "12px monospace";
}
function drawAltimeter(ctx, x, cy, altM) {
  const ft = Math.round(mToFt(altM));
  const h = 120, tickH = 8;
  ctx.strokeRect(x, cy - h / 2, 44, h);
  for (let v = ft - 2e3; v <= ft + 2e3; v += 200) {
    const dy = (ft - v) / 2e3 * (h / 2);
    if (Math.abs(dy) > h / 2) continue;
    const isMajor = v % 1e3 === 0;
    ctx.beginPath();
    ctx.moveTo(x, cy + dy);
    ctx.lineTo(x + (isMajor ? tickH : tickH / 2), cy + dy);
    ctx.stroke();
    if (isMajor) ctx.fillText(`${Math.round(v / 100) * 100}`, x + tickH + 1, cy + dy + 4);
  }
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - 2, cy - 10, 48, 20);
  ctx.fillStyle = "#00ff44";
  ctx.font = "bold 14px monospace";
  ctx.fillText(`${ft}`, x + 1, cy + 5);
  ctx.font = "12px monospace";
}
function drawGMeter(ctx, x, y, gCurrent, gMax) {
  ctx.fillStyle = gCurrent > 7 ? "#ff4444" : gCurrent < -2 ? "#ff8888" : "#00ff44";
  ctx.font = "bold 13px monospace";
  ctx.fillText(`${gCurrent.toFixed(1)}G`, x, y);
  ctx.fillStyle = "#00ff44";
  ctx.font = "11px monospace";
  ctx.fillText(`MAX ${gMax.toFixed(1)}G`, x, y + 14);
}
function drawHeadingTape(ctx, cx, y, hdgDeg) {
  const w = 260, h = 24;
  const x = cx - w / 2;
  ctx.strokeRect(x, y, w, h);
  const pxPerDeg = w / 60;
  for (let d = Math.floor(hdgDeg - 30); d <= hdgDeg + 30; d++) {
    const dx = cx + (d - hdgDeg) * pxPerDeg;
    if (dx < x || dx > x + w) continue;
    const isMajor = d % 10 === 0;
    ctx.beginPath();
    ctx.moveTo(dx, y + h);
    ctx.lineTo(dx, y + h - (isMajor ? 10 : 5));
    ctx.stroke();
    if (isMajor) {
      const label = (d % 360 + 360) % 360;
      ctx.fillText(`${Math.round(label / 10) * 10}`, dx - 8, y + 12);
    }
  }
  ctx.fillStyle = "#00ff44";
  ctx.beginPath();
  ctx.moveTo(cx, y + h);
  ctx.lineTo(cx - 5, y + h - 8);
  ctx.lineTo(cx + 5, y + h - 8);
  ctx.closePath();
  ctx.fill();
  ctx.font = "bold 13px monospace";
  const hdg = (Math.round(hdgDeg) % 360 + 360) % 360;
  ctx.fillText(hdg.toString().padStart(3, "0"), cx - 12, y + 14);
  ctx.font = "12px monospace";
}
function drawRadarScope(ctx, x, y, w, h, radar, ownPos) {
  ctx.strokeRect(x, y, w, h);
  const rangeNm = mToNm(radar.rangeModeM);
  ctx.font = "10px monospace";
  ctx.fillText(`${Math.round(rangeNm)}nm`, x + 2, y + 10);
  ctx.fillText(radar.mode, x + w - 28, y + 10);
  const scanX = x + (radar.azimuthDeg + 60) / 120 * w;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(scanX, y);
  ctx.lineTo(scanX, y + h);
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (const t of radar.tracks) {
    const rangeM = v3dist(t.positionNED, ownPos);
    const dx = t.positionNED[1] - ownPos[1];
    const dy = t.positionNED[0] - ownPos[0];
    const azDeg = Math.atan2(dx, dy) * (180 / Math.PI);
    const tx = x + (azDeg + 60) / 120 * w;
    const ty = y + h - rangeM / radar.rangeModeM * h;
    const isSTT = radar.mode === "STT" && t.entityId === radar.sttTargetId;
    ctx.fillStyle = isSTT ? "#ffffff" : "#00ff44";
    if (isSTT) {
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.rect(tx - 4, ty - 4, 8, 8);
      ctx.stroke();
      ctx.strokeStyle = "#00ff44";
    } else {
      ctx.beginPath();
      ctx.arc(tx, ty, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#00ff44";
    ctx.fillText(`${Math.round(mToNm(rangeM))}`, tx + 3, ty - 2);
  }
}
function drawWeaponsStatus(ctx, x, y, stores, selectedWeapon, gunRounds) {
  ctx.font = "12px monospace";
  let cx = x;
  for (const s of stores) {
    if (!s.remainingRounds) continue;
    const isSel = s.weaponId === selectedWeapon;
    ctx.fillStyle = isSel ? "#ffffff" : "#00ff44";
    const label = `${s.weaponId?.toUpperCase()} ×${s.remainingRounds}`;
    ctx.fillText(label, cx, y);
    cx += ctx.measureText(label).width + 16;
  }
  ctx.fillStyle = "#00ff44";
  ctx.fillText(`GUN ${gunRounds}`, cx, y);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px monospace";
  ctx.fillText(`SEL: ${selectedWeapon?.toUpperCase() ?? "NONE"}`, x, y + 16);
  ctx.font = "12px monospace";
}
function drawThreatDisplay(ctx, cx, cy, rwr) {
  const r = 42;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = "10px monospace";
  ctx.fillText("N", cx - 4, cy - r - 3);
  for (const t of rwr.threats) {
    const azRad = (t.azimuthDeg - 90) * Math.PI / 180;
    const tx = cx + Math.cos(azRad) * r;
    const ty = cy + Math.sin(azRad) * r;
    ctx.fillStyle = t.type === "TRACK" ? "#ff2222" : "#ffaa00";
    ctx.fillText(t.type[0], tx - 4, ty + 4);
  }
  ctx.fillStyle = "#00ff44";
}
class HUD {
  canvas;
  ctx;
  player;
  entityManager;
  constructor(canvas, player, entityManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.player = player;
    this.entityManager = entityManager;
  }
  render() {
    const { canvas: c, ctx, player } = this;
    const state = player.state;
    const radar = player.radar.state;
    const rwr = player.rwr.state;
    const stores = state.loadedStores;
    const selectedWeapon = player.getSelectedWeaponName();
    const gunRounds = player.gun.getRoundsRemaining();
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#00ff44";
    ctx.fillStyle = "#00ff44";
    ctx.lineWidth = 1.5;
    ctx.font = "12px monospace";
    const W = c.width, H = c.height;
    const cx = W / 2, cy = H / 2;
    drawHeadingTape(ctx, cx, 8, state.headingDeg);
    drawAttitudeIndicator(ctx, cx, cy, state.pitchDeg, state.rollDeg);
    drawAirspeed(ctx, 30, cy, state.iasKts * 0.51444);
    drawAltimeter(ctx, W - 78, cy, state.altitudeM);
    drawGMeter(ctx, 32, cy + 80, state.gCurrent, state.gMax);
    ctx.fillText(`M ${state.mach.toFixed(2)}`, W - 72, cy + 80);
    const vvi = Math.round(state.vviMps * 196.85);
    ctx.fillText(`VVI ${vvi >= 0 ? "+" : ""}${vvi}`, 32, cy - 80);
    drawWeaponsStatus(ctx, 16, H - 48, stores, selectedWeapon, gunRounds);
    drawRadarScope(ctx, cx - 60, H - 100, 120, 90, radar, state.positionNED);
    drawThreatDisplay(ctx, W - 70, H - 60, rwr);
    const betaPx = state.betaDeg / 60 * (W / 2);
    const alphaPx = state.alphaDeg / 40 * (H / 2);
    const fpmX = cx + betaPx, fpmY = cy - alphaPx;
    ctx.beginPath();
    ctx.arc(fpmX, fpmY, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fpmX - 14, fpmY);
    ctx.lineTo(fpmX - 6, fpmY);
    ctx.moveTo(fpmX + 6, fpmY);
    ctx.lineTo(fpmX + 14, fpmY);
    ctx.moveTo(fpmX, fpmY - 6);
    ctx.lineTo(fpmX, fpmY - 14);
    ctx.stroke();
  }
  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }
  dispose() {
  }
}
const ENEMY_SPECS = { "F-16C": F16C, "MiG-29": MIG29 };
const BEHAVIORS = ["FOLLOW_BEHIND", "FOLLOW_IN_FRONT", "FLY_STRAIGHT", "TURN_CONSTANTLY"];
class DebugOverlay {
  constructor(player, entityManager, scene) {
    this.player = player;
    this.entityManager = entityManager;
    this.scene = scene;
    this.panel = document.createElement("div");
    this.telemetry = document.createElement("pre");
    this.buildPanel();
    document.body.appendChild(this.panel);
  }
  panel;
  telemetry;
  visible = false;
  buildPanel() {
    const p = this.panel;
    p.id = "debug-overlay";
    Object.assign(p.style, {
      position: "fixed",
      top: "0",
      right: "0",
      background: "rgba(0,0,0,0.8)",
      color: "#0f0",
      fontFamily: "monospace",
      fontSize: "12px",
      padding: "10px",
      width: "260px",
      zIndex: "9999",
      display: "none",
      userSelect: "none",
      maxHeight: "100vh",
      overflowY: "auto"
    });
    const spawnSection = this.makeSection("SPAWN ENEMY");
    const behaviorSel = document.createElement("select");
    BEHAVIORS.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = b;
      behaviorSel.appendChild(opt);
    });
    behaviorSel.style.width = "100%";
    spawnSection.appendChild(behaviorSel);
    const acSel = document.createElement("select");
    Object.keys(ENEMY_SPECS).forEach((k) => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = k;
      acSel.appendChild(opt);
    });
    acSel.style.width = "100%";
    spawnSection.appendChild(acSel);
    const spawnBtn = this.makeButton("Spawn Enemy", () => {
      const behavior = behaviorSel.value;
      const spec = ENEMY_SPECS[acSel.value];
      const ps = this.player.state.positionNED;
      const spawnPos = [ps[0] - 2e3, ps[1], ps[2]];
      const spawnVel = [200, 0, 0];
      this.entityManager.spawnEnemy(spec, [
        { hardpointId: "W1", weaponId: "r73", category: "IR_MISSILE", massKg: 105, dragPenalty: 2e-3, remainingRounds: 1 },
        { hardpointId: "E1", weaponId: "r73", category: "IR_MISSILE", massKg: 105, dragPenalty: 2e-3, remainingRounds: 1 }
      ], behavior, spawnPos, spawnVel);
    });
    spawnSection.appendChild(spawnBtn);
    const missileBtn = this.makeButton("Spawn Missile at Player", () => {
      const enemies = this.entityManager.getEnemies();
      if (enemies.length === 0) {
        console.warn("[Debug] Spawn an enemy first");
        return;
      }
      console.log("[Debug] Missile-at-player: spawn an enemy and let their AI fire");
    });
    spawnSection.appendChild(missileBtn);
    p.appendChild(spawnSection);
    const playerSection = this.makeSection("PLAYER CONTROLS");
    const invincChk = document.createElement("input");
    invincChk.type = "checkbox";
    invincChk.onchange = () => {
      this.player.state.invincible = invincChk.checked;
    };
    const invincLabel = document.createElement("label");
    invincLabel.textContent = " Invincibility";
    invincLabel.prepend(invincChk);
    playerSection.appendChild(invincLabel);
    playerSection.appendChild(document.createElement("br"));
    playerSection.appendChild(this.makeButton("Reload Weapons", () => this.player.reloadWeapons()));
    playerSection.appendChild(this.makeButton("Reset Position", () => this.player.resetPosition()));
    p.appendChild(playerSection);
    const telSection = this.makeSection("TELEMETRY");
    this.telemetry.style.margin = "0";
    telSection.appendChild(this.telemetry);
    p.appendChild(telSection);
    const visSection = this.makeSection("VISUALS");
    const visToggles = [
      ["showVelocity", "Velocity Vector"],
      ["showSeekerCone", "Missile Seeker Cone"],
      ["showRadarCone", "Radar Cone"]
    ];
    for (const [key, label] of visToggles) {
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.onchange = () => {
        window[key] = chk.checked;
      };
      const lbl = document.createElement("label");
      lbl.textContent = " " + label;
      lbl.prepend(chk);
      visSection.appendChild(lbl);
      visSection.appendChild(document.createElement("br"));
    }
    p.appendChild(visSection);
  }
  makeSection(title) {
    const sec = document.createElement("div");
    sec.style.marginBottom = "8px";
    const h = document.createElement("div");
    h.textContent = `── ${title} ──`;
    h.style.color = "#aaffaa";
    h.style.marginBottom = "4px";
    sec.appendChild(h);
    return sec;
  }
  makeButton(label, onClick) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = "display:block;width:100%;margin:2px 0;background:#1a3a1a;color:#0f0;border:1px solid #0f0;cursor:pointer;font:11px monospace;padding:3px";
    btn.onclick = onClick;
    return btn;
  }
  toggle() {
    this.visible = !this.visible;
    this.panel.style.display = this.visible ? "block" : "none";
  }
  update(state) {
    if (!this.visible) return;
    const kts = Math.round(state.iasKts);
    const ft = Math.round(mToFt(state.altitudeM));
    this.telemetry.textContent = `IAS:   ${kts} kt
AoA:   ${state.alphaDeg.toFixed(1)}°
G:     ${state.gCurrent.toFixed(1)} (max ${state.gMax.toFixed(1)})
Mach:  ${state.mach.toFixed(2)}
Alt:   ${ft} ft
Hdg:   ${Math.round(state.headingDeg).toString().padStart(3, "0")}°
Pitch: ${state.pitchDeg.toFixed(1)}°
Roll:  ${state.rollDeg.toFixed(1)}°`;
  }
  dispose() {
    document.body.removeChild(this.panel);
  }
}
class AudioManager {
  ctx;
  engineOsc;
  engineGain;
  radarToneOsc = null;
  radarToneGain = null;
  radarToneInterval = null;
  missileGrowlOsc = null;
  missileGrowlGain = null;
  activeRWRMode = null;
  constructor() {
    this.ctx = new AudioContext();
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 80;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.04;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }
  updateEngine(throttle, _mach) {
    const freq = 80 + throttle * 140;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.3);
    const vol = 0.02 + throttle * 0.06;
    this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2);
  }
  setRWRMode(mode) {
    if (mode === this.activeRWRMode) return;
    this.activeRWRMode = mode;
    this.stopRadarTone();
    if (!mode) return;
    const intervalMs = mode === "SEARCH" ? 1e3 : mode === "TRACK" ? 333 : mode === "LOCK" ? 0 : 100;
    if (mode === "LOCK") {
      this.playTone(880, 0.15, 0);
    } else {
      this.radarToneInterval = setInterval(() => this.playTone(660, 0.12, 0.08), intervalMs);
    }
  }
  setIRSeekerState(acquired, locked) {
    if (locked) {
      if (this.missileGrowlOsc) return;
      this.missileGrowlOsc = this.ctx.createOscillator();
      this.missileGrowlOsc.type = "sawtooth";
      this.missileGrowlOsc.frequency.value = 400;
      this.missileGrowlGain = this.ctx.createGain();
      this.missileGrowlGain.gain.value = 0.08;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 30;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 60;
      lfo.connect(lfoGain);
      lfoGain.connect(this.missileGrowlOsc.frequency);
      lfo.start();
      this.missileGrowlOsc.connect(this.missileGrowlGain);
      this.missileGrowlGain.connect(this.ctx.destination);
      this.missileGrowlOsc.start();
    } else if (acquired) {
      this.stopMissileGrowl();
      this.playSweep(300, 600, 0.3, 0.1);
    } else {
      this.stopMissileGrowl();
    }
  }
  play(event) {
    switch (event) {
      case "MISSILE_LAUNCH_IR":
        this.speak("Fox Two");
        break;
      case "MISSILE_LAUNCH_ARH":
        this.speak("Fox Three");
        break;
      case "PULL_UP":
        this.speak("Pull up, terrain");
        break;
      case "PULL_UP_URGENT":
        this.speak("Pull up, pull up");
        break;
      case "ENGINE_FLAMEOUT":
        this.speak("Engine flameout");
        this.engineGain.gain.setTargetAtTime(5e-3, this.ctx.currentTime, 0.5);
        break;
      case "GUN_FIRE_20MM":
        this.playNoise(0.04, 0.05);
        break;
      case "GUN_FIRE_30MM":
        this.playNoise(0.08, 0.07);
        break;
    }
  }
  update(player) {
    this.resume();
    this.updateEngine(player.state.throttle, player.state.mach);
    const threats = player.rwr.state.threats;
    const hasSTT = threats.some((t) => t.type === "TRACK" && t.priority >= 3);
    const hasTrack = threats.some((t) => t.type === "TRACK");
    const hasScan = threats.length > 0;
    if (hasSTT) this.setRWRMode("LOCK");
    else if (hasTrack) this.setRWRMode("TRACK");
    else if (hasScan) this.setRWRMode("SEARCH");
    else this.setRWRMode(null);
  }
  dispose() {
    this.stopRadarTone();
    this.stopMissileGrowl();
    try {
      this.engineOsc.stop();
    } catch {
    }
    try {
      this.ctx.close();
    } catch {
    }
  }
  resume() {
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  playTone(freq, gain, duration) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start();
    if (duration > 0) {
      osc.stop(this.ctx.currentTime + duration);
    } else {
      if (this.radarToneOsc) {
        try {
          this.radarToneOsc.stop();
        } catch {
        }
      }
      this.radarToneOsc = osc;
      this.radarToneGain = g;
    }
  }
  playSweep(startFreq, endFreq, duration, gain) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    g.gain.value = gain;
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  playNoise(gain, duration) {
    const bufSize = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * gain;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start();
  }
  speak(text) {
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.2;
    utt.pitch = 0.9;
    speechSynthesis.speak(utt);
  }
  stopRadarTone() {
    if (this.radarToneInterval !== null) {
      clearInterval(this.radarToneInterval);
      this.radarToneInterval = null;
    }
    if (this.radarToneOsc) {
      try {
        this.radarToneOsc.stop();
      } catch {
      }
      this.radarToneOsc = null;
    }
  }
  stopMissileGrowl() {
    if (this.missileGrowlOsc) {
      try {
        this.missileGrowlOsc.stop();
      } catch {
      }
      this.missileGrowlOsc = null;
      this.missileGrowlGain = null;
    }
  }
}
const CopyShader = {
  name: "CopyShader",
  uniforms: {
    "tDiffuse": { value: null },
    "opacity": { value: 1 }
  },
  vertexShader: (
    /* glsl */
    `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`
  )
};
class Pass {
  constructor() {
    this.isPass = true;
    this.enabled = true;
    this.needsSwap = true;
    this.clear = false;
    this.renderToScreen = false;
  }
  setSize() {
  }
  render() {
    console.error("THREE.Pass: .render() must be implemented in derived pass.");
  }
  dispose() {
  }
}
const _camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
class FullscreenTriangleGeometry extends BufferGeometry {
  constructor() {
    super();
    this.setAttribute("position", new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    this.setAttribute("uv", new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  }
}
const _geometry = new FullscreenTriangleGeometry();
class FullScreenQuad {
  constructor(material) {
    this._mesh = new Mesh(_geometry, material);
  }
  dispose() {
    this._mesh.geometry.dispose();
  }
  render(renderer) {
    renderer.render(this._mesh, _camera);
  }
  get material() {
    return this._mesh.material;
  }
  set material(value) {
    this._mesh.material = value;
  }
}
class ShaderPass extends Pass {
  constructor(shader, textureID) {
    super();
    this.textureID = textureID !== void 0 ? textureID : "tDiffuse";
    if (shader instanceof ShaderMaterial) {
      this.uniforms = shader.uniforms;
      this.material = shader;
    } else if (shader) {
      this.uniforms = UniformsUtils.clone(shader.uniforms);
      this.material = new ShaderMaterial({
        name: shader.name !== void 0 ? shader.name : "unspecified",
        defines: Object.assign({}, shader.defines),
        uniforms: this.uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader
      });
    }
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    if (this.uniforms[this.textureID]) {
      this.uniforms[this.textureID].value = readBuffer.texture;
    }
    this.fsQuad.material = this.material;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      this.fsQuad.render(renderer);
    }
  }
  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
class MaskPass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.clear = true;
    this.needsSwap = false;
    this.inverse = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    const context = renderer.getContext();
    const state = renderer.state;
    state.buffers.color.setMask(false);
    state.buffers.depth.setMask(false);
    state.buffers.color.setLocked(true);
    state.buffers.depth.setLocked(true);
    let writeValue, clearValue;
    if (this.inverse) {
      writeValue = 0;
      clearValue = 1;
    } else {
      writeValue = 1;
      clearValue = 0;
    }
    state.buffers.stencil.setTest(true);
    state.buffers.stencil.setOp(context.REPLACE, context.REPLACE, context.REPLACE);
    state.buffers.stencil.setFunc(context.ALWAYS, writeValue, 4294967295);
    state.buffers.stencil.setClear(clearValue);
    state.buffers.stencil.setLocked(true);
    renderer.setRenderTarget(readBuffer);
    if (this.clear) renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(writeBuffer);
    if (this.clear) renderer.clear();
    renderer.render(this.scene, this.camera);
    state.buffers.color.setLocked(false);
    state.buffers.depth.setLocked(false);
    state.buffers.color.setMask(true);
    state.buffers.depth.setMask(true);
    state.buffers.stencil.setLocked(false);
    state.buffers.stencil.setFunc(context.EQUAL, 1, 4294967295);
    state.buffers.stencil.setOp(context.KEEP, context.KEEP, context.KEEP);
    state.buffers.stencil.setLocked(true);
  }
}
class ClearMaskPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
  }
  render(renderer) {
    renderer.state.buffers.stencil.setLocked(false);
    renderer.state.buffers.stencil.setTest(false);
  }
}
class EffectComposer {
  constructor(renderer, renderTarget) {
    this.renderer = renderer;
    this._pixelRatio = renderer.getPixelRatio();
    if (renderTarget === void 0) {
      const size = renderer.getSize(new Vector2());
      this._width = size.width;
      this._height = size.height;
      renderTarget = new WebGLRenderTarget(this._width * this._pixelRatio, this._height * this._pixelRatio, { type: HalfFloatType });
      renderTarget.texture.name = "EffectComposer.rt1";
    } else {
      this._width = renderTarget.width;
      this._height = renderTarget.height;
    }
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.renderTarget2.texture.name = "EffectComposer.rt2";
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
    this.renderToScreen = true;
    this.passes = [];
    this.copyPass = new ShaderPass(CopyShader);
    this.copyPass.material.blending = NoBlending;
    this.clock = new Clock();
  }
  swapBuffers() {
    const tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  }
  addPass(pass) {
    this.passes.push(pass);
    pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  insertPass(pass, index) {
    this.passes.splice(index, 0, pass);
    pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  removePass(pass) {
    const index = this.passes.indexOf(pass);
    if (index !== -1) {
      this.passes.splice(index, 1);
    }
  }
  isLastEnabledPass(passIndex) {
    for (let i = passIndex + 1; i < this.passes.length; i++) {
      if (this.passes[i].enabled) {
        return false;
      }
    }
    return true;
  }
  render(deltaTime) {
    if (deltaTime === void 0) {
      deltaTime = this.clock.getDelta();
    }
    const currentRenderTarget = this.renderer.getRenderTarget();
    let maskActive = false;
    for (let i = 0, il = this.passes.length; i < il; i++) {
      const pass = this.passes[i];
      if (pass.enabled === false) continue;
      pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass(i);
      pass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive);
      if (pass.needsSwap) {
        if (maskActive) {
          const context = this.renderer.getContext();
          const stencil = this.renderer.state.buffers.stencil;
          stencil.setFunc(context.NOTEQUAL, 1, 4294967295);
          this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime);
          stencil.setFunc(context.EQUAL, 1, 4294967295);
        }
        this.swapBuffers();
      }
      if (MaskPass !== void 0) {
        if (pass instanceof MaskPass) {
          maskActive = true;
        } else if (pass instanceof ClearMaskPass) {
          maskActive = false;
        }
      }
    }
    this.renderer.setRenderTarget(currentRenderTarget);
  }
  reset(renderTarget) {
    if (renderTarget === void 0) {
      const size = this.renderer.getSize(new Vector2());
      this._pixelRatio = this.renderer.getPixelRatio();
      this._width = size.width;
      this._height = size.height;
      renderTarget = this.renderTarget1.clone();
      renderTarget.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
    }
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
  }
  setSize(width, height) {
    this._width = width;
    this._height = height;
    const effectiveWidth = this._width * this._pixelRatio;
    const effectiveHeight = this._height * this._pixelRatio;
    this.renderTarget1.setSize(effectiveWidth, effectiveHeight);
    this.renderTarget2.setSize(effectiveWidth, effectiveHeight);
    for (let i = 0; i < this.passes.length; i++) {
      this.passes[i].setSize(effectiveWidth, effectiveHeight);
    }
  }
  setPixelRatio(pixelRatio) {
    this._pixelRatio = pixelRatio;
    this.setSize(this._width, this._height);
  }
  dispose() {
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.copyPass.dispose();
  }
}
class RenderPass extends Pass {
  constructor(scene, camera, overrideMaterial = null, clearColor = null, clearAlpha = null) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.overrideMaterial = overrideMaterial;
    this.clearColor = clearColor;
    this.clearAlpha = clearAlpha;
    this.clear = true;
    this.clearDepth = false;
    this.needsSwap = false;
    this._oldClearColor = new Color();
  }
  render(renderer, writeBuffer, readBuffer) {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    let oldClearAlpha, oldOverrideMaterial;
    if (this.overrideMaterial !== null) {
      oldOverrideMaterial = this.scene.overrideMaterial;
      this.scene.overrideMaterial = this.overrideMaterial;
    }
    if (this.clearColor !== null) {
      renderer.getClearColor(this._oldClearColor);
      renderer.setClearColor(this.clearColor, renderer.getClearAlpha());
    }
    if (this.clearAlpha !== null) {
      oldClearAlpha = renderer.getClearAlpha();
      renderer.setClearAlpha(this.clearAlpha);
    }
    if (this.clearDepth == true) {
      renderer.clearDepth();
    }
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear === true) {
      renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    }
    renderer.render(this.scene, this.camera);
    if (this.clearColor !== null) {
      renderer.setClearColor(this._oldClearColor);
    }
    if (this.clearAlpha !== null) {
      renderer.setClearAlpha(oldClearAlpha);
    }
    if (this.overrideMaterial !== null) {
      this.scene.overrideMaterial = oldOverrideMaterial;
    }
    renderer.autoClear = oldAutoClear;
  }
}
const GEffectShader = {
  uniforms: {
    tDiffuse: { value: null },
    uGLoad: { value: 1 },
    uNegG: { value: 0 }
  },
  vertexShader: (
    /* glsl */
    `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  ),
  fragmentShader: (
    /* glsl */
    `
    uniform sampler2D tDiffuse;
    uniform float uGLoad;
    uniform float uNegG;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // G tunnel vignette
      float vigRadius = clamp(1.0 - (uGLoad - 1.0) / 8.0, 0.1, 1.0);
      vec2 center = vUv - 0.5;
      float dist = length(center) / 0.707;  // normalise to corner = 1
      float vignette = smoothstep(vigRadius, vigRadius * 0.5, dist);
      color.rgb *= vignette;

      // Greyscale desaturation above 5G
      float desat = clamp((uGLoad - 5.0) / 4.0, 0.0, 1.0);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(color.rgb, vec3(lum), desat);

      // Negative-G redout
      if (uNegG > 0.0) {
        float redRadius = clamp(1.0 - uNegG * 0.4, 0.3, 1.0);
        float redVig = 1.0 - smoothstep(redRadius, redRadius * 0.5, dist);
        color.rgb = mix(color.rgb, vec3(color.r * 1.2, color.g * 0.2, color.b * 0.2), redVig * uNegG);
      }

      gl_FragColor = color;
    }
  `
  )
};
class GEffectPass extends ShaderPass {
  constructor() {
    super(GEffectShader);
  }
  setGLoad(g) {
    this.uniforms["uGLoad"].value = g;
    const negG = g < -2 ? Math.min((-g - 2) / 3, 1) : 0;
    this.uniforms["uNegG"].value = negG;
  }
}
class PostFXManager {
  composer;
  gPass;
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gPass = new GEffectPass();
    this.composer.addPass(this.gPass);
  }
  setGLoad(g) {
    this.gPass.setGLoad(g);
  }
  render() {
    this.composer.render();
  }
  setSize(w, h) {
    this.composer.setSize(w, h);
  }
}
const FIXED_DT = 1 / 60;
class FlightSession {
  sceneManager;
  cameraManager;
  inputManager;
  player;
  entityManager;
  hud;
  debugOverlay;
  audioManager;
  postFX;
  rafId = 0;
  lastTime = 0;
  accumulator = 0;
  sessionStartTime = 0;
  disposed = false;
  onComplete;
  constructor(spec, stores, onComplete) {
    this.onComplete = onComplete;
    const threeCanvas = document.getElementById("three-canvas");
    const hudCanvas = document.getElementById("hud-canvas");
    this.sceneManager = new SceneManager(threeCanvas);
    this.cameraManager = new CameraManager(this.sceneManager.camera);
    this.inputManager = new InputManager();
    this.audioManager = new AudioManager();
    this.player = new PlayerAircraft(spec, stores, this.sceneManager.scene);
    this.entityManager = new EntityManager(this.sceneManager.scene, this.player);
    this.postFX = new PostFXManager(this.sceneManager.renderer, this.sceneManager.scene, this.sceneManager.camera);
    this.hud = new HUD(hudCanvas, this.player, this.entityManager);
    this.debugOverlay = new DebugOverlay(this.player, this.entityManager, this.sceneManager.scene);
    this.player.state.positionNED = [0, 0, -5e3];
    this.player.state.velocityNED = [250, 0, 0];
  }
  start() {
    this.sessionStartTime = performance.now();
    this.lastTime = this.sessionStartTime;
    this.loop(this.sessionStartTime);
  }
  loop = (timestamp) => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min((timestamp - this.lastTime) / 1e3, 0.1);
    this.lastTime = timestamp;
    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this.tick(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    this.render();
  };
  tick(dt) {
    const controls = this.inputManager.getControls();
    this.player.update(dt, controls);
    this.entityManager.update(dt, this.player);
    this.audioManager.update(this.player);
    if (this.player.state.ejected) {
      const elapsed = (performance.now() - this.sessionStartTime) / 1e3;
      setTimeout(() => {
        this.onComplete({
          kills: this.entityManager.killCount,
          deaths: 1,
          flightTimeSec: elapsed,
          aircraftName: this.player.spec.displayName
        });
      }, 4e3);
    }
  }
  render() {
    const playerState = this.player.state;
    this.cameraManager.update(this.player);
    this.player.updateMesh();
    this.entityManager.updateMeshes();
    this.postFX.setGLoad(playerState.gCurrent);
    this.postFX.render();
    this.hud.render();
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.inputManager.dispose();
    this.hud.dispose();
    this.debugOverlay.dispose();
    this.sceneManager.dispose();
    this.audioManager.dispose();
  }
}
class DebriefScreen {
  el;
  constructor(_container, stats, onRestart) {
    this.el = document.createElement("div");
    Object.assign(this.el.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.9)",
      color: "#00ff88",
      fontFamily: "monospace",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "9000",
      gap: "16px"
    });
    const title = document.createElement("h1");
    title.textContent = stats.deaths > 0 ? "MISSION ABORTED — EJECTED" : "MISSION COMPLETE";
    title.style.cssText = "color:#00ff88;letter-spacing:4px;font-size:20px;margin:0";
    this.el.appendChild(title);
    const statsEl = document.createElement("pre");
    const minutes = Math.floor(stats.flightTimeSec / 60);
    const secs = Math.floor(stats.flightTimeSec % 60);
    statsEl.textContent = [
      `Flight time:   ${minutes}m ${secs.toString().padStart(2, "0")}s`,
      `Kills:         ${stats.kills}`,
      `Aircraft:      ${stats.aircraftName}`
    ].join("\n");
    statsEl.style.cssText = "border:1px solid #226644;padding:16px;line-height:1.8";
    this.el.appendChild(statsEl);
    const btn = document.createElement("button");
    btn.textContent = "RETURN TO LOADOUT";
    btn.style.cssText = "padding:12px 40px;font:bold 14px monospace;background:#0a2a0a;color:#00ff88;border:2px solid #00ff88;cursor:pointer;letter-spacing:2px";
    btn.onclick = () => {
      this.dispose();
      onRestart();
    };
    this.el.appendChild(btn);
    document.body.appendChild(this.el);
  }
  dispose() {
    document.body.removeChild(this.el);
  }
}
class App {
  state = "LOADOUT";
  loadoutScreen = null;
  flightSession = null;
  debriefScreen = null;
  uiOverlay;
  constructor() {
    this.uiOverlay = document.getElementById("ui-overlay");
  }
  start() {
    this.enterLoadout();
  }
  enterLoadout() {
    this.state = "LOADOUT";
    this.flightSession?.dispose();
    this.flightSession = null;
    this.debriefScreen?.dispose();
    this.debriefScreen = null;
    this.loadoutScreen = new LoadoutScreen(this.uiOverlay, (spec, stores) => {
      this.enterFlight(spec, stores);
    });
  }
  enterFlight(spec, stores) {
    this.state = "FLIGHT";
    this.loadoutScreen?.dispose();
    this.loadoutScreen = null;
    this.flightSession = new FlightSession(spec, stores, (result) => {
      this.enterDebrief(result);
    });
    this.flightSession.start();
  }
  enterDebrief(result) {
    this.state = "DEBRIEF";
    this.flightSession?.dispose();
    this.flightSession = null;
    this.debriefScreen = new DebriefScreen(this.uiOverlay, result, () => {
      this.enterLoadout();
    });
  }
}
const app = new App();
app.start();
