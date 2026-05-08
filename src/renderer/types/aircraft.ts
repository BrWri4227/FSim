import type { Vec3, StateVec } from './common'
import type { LoadedStore } from './weapons'

export interface AeroTable {
  alphaBreakpointsDeg: number[]
  machBreakpoints: number[]
  // 2D tables indexed [alpha_idx][mach_idx]
  CL: number[][]
  CD: number[][]
  Cm: number[][]
  // Lateral-directional: handled analytically with derivatives
  CYbeta: number  // side force per rad sideslip
  Clbeta: number  // roll moment per rad sideslip (dihedral)
  Cnbeta: number  // yaw moment per rad sideslip (weathercock)
  Clp: number     // roll damping (per rad/s)
  Cmq: number     // pitch damping (per rad/s)
  Cnr: number     // yaw damping (per rad/s)
}

export interface ControlEffectivenessTable {
  machBreakpoints: number[]
  CLde: number[]   // dCL/d(elevator_rad)
  CMde: number[]   // dCm/d(elevator_rad)
  CLda: number[]   // dCl/d(aileron_rad)
  CNdr: number[]   // dCn/d(rudder_rad)
}

export interface EngineSpec {
  maxThrustDryN: number
  maxThrustWetN: number   // with afterburner
  idleThrustN: number
  spoolTimeSec: number    // time to spool up
  sfcDry: number          // specific fuel consumption kg/(N·s)
  sfcWet: number
  afterburnerThrottleMin: number  // throttle position where AB kicks in (0-1)
}

export interface MassSpec {
  emptyMassKg: number
  fuelCapacityKg: number
  wingAreaM2: number
  wingspanM: number
  macM: number            // mean aerodynamic chord
  IxxKgM2: number         // roll inertia
  IyyKgM2: number         // pitch inertia
  IzzKgM2: number         // yaw inertia
  IxzKgM2: number         // cross-product inertia
}

export type WeaponCategory = 'IR_MISSILE' | 'ARH_MISSILE' | 'GUN_POD' | 'FUEL_TANK' | 'EMPTY'

export interface HardpointDef {
  id: string
  posBodyM: Vec3                        // position relative to CG in body frame
  compatibleTypes: WeaponCategory[]
  maxStoreKg: number
}

export interface GunSpec {
  id: string
  muzzleVelocityMS: number
  roundMassKg: number
  roundDiameterM: number
  ballisticCd: number
  rateOfFireRPM: number
  totalRounds: number
  maxRangeM: number
}

export interface AircraftSpec {
  id: string
  displayName: string
  nation: 'USA' | 'RUS'
  aero: AeroTable
  controlEffectiveness: ControlEffectivenessTable
  engine: EngineSpec
  mass: MassSpec
  hardpoints: HardpointDef[]
  maxAoADeg: number
  maxGPositive: number
  maxGNegative: number
  gunSpec: GunSpec | null
  heatSignatureBaseKW: number
  rcsTableM2: number[]   // 8-point: 0°/45°/90°/135°/180°/225°/270°/315°
  pilotEyePointM: Vec3
  cockpitFovDeg: number
}

export interface ControlInputs {
  pitch: number    // -1 (push) to +1 (pull)
  roll: number     // -1 (left) to +1 (right)
  yaw: number      // -1 (left) to +1 (right)
  throttle: number // 0 to 1
  fireGun: boolean
  fireMissile: boolean
  cycleMissile: boolean
  dispenseFlare: boolean
  dispenseChaff: boolean
  toggleGear: boolean
  cycleFlaps: boolean
  brakeHeld: boolean
  speedBrakeToggle: boolean
  radarModeNext: boolean
  radarSelectNext: boolean
  radarLockTarget: boolean
  radarUnlock: boolean
  ejectRequested: boolean
}

export interface AircraftState {
  // Physics (matches StateVec layout)
  positionNED: Vec3       // North-East-Down meters
  velocityNED: Vec3       // m/s
  attitudeQuat: [number, number, number, number]  // w,x,y,z
  angularRateBody: Vec3   // p,q,r rad/s

  // Derived each tick
  alphaDeg: number
  betaDeg: number
  mach: number
  iasKts: number
  altitudeM: number
  gCurrent: number
  gMax: number
  headingDeg: number
  pitchDeg: number
  rollDeg: number
  vviMps: number         // vertical velocity m/s (+up)

  // Systems
  throttle: number
  fuelKg: number
  loadedStores: LoadedStore[]
  totalMassKg: number
  onGround: boolean
  gearDown: boolean
  flaps: 0 | 1 | 2   // 0=up, 1=takeoff (~20°), 2=landing (~40°)
  speedBrake: boolean
  brakeHeld: boolean
  ejected: boolean
  invincible: boolean

  // Raw state vector for RK4
  sv: StateVec
}
