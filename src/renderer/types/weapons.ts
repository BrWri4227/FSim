import type { Vec3, Quat } from './common'
import type { WeaponCategory } from './aircraft'

export interface LoadedStore {
  hardpointId: string
  weaponId: string
  category: WeaponCategory
  massKg: number
  dragPenalty: number    // additive CD increment
  remainingRounds: number  // 1 for missiles, N for guns, 0 for tanks
}

export interface IRSeekerSpec {
  gimbalLimitDeg: number
  trackingRateRadS: number
  minHeatSignatureKW: number
  flareRejectionCapability: number  // 0..1
  fovDeg: number
  hmsCapable: boolean
}

export interface ActiveRadarSeekerSpec {
  peakPowerW: number
  antennaGainDB: number
  frequencyGHz: number
  terminalActivationRangeM: number
  /** Seeker field-of-view half-angle (deg). Defaults to 45. */
  fovDeg?: number
  /** Minimum linear SNR for a valid lock. Defaults to 8. */
  snrThreshold?: number
}

export interface MissileSpec {
  id: string
  displayName: string
  category: 'IR_MISSILE' | 'ARH_MISSILE' | 'AGM_MISSILE'
  nation: 'USA' | 'RUS'
  massKg: number
  dragCd: number
  bodyDiameterM: number
  maxThrustN: number
  burnTimeSec: number
  maxGOverload: number
  maxSpeedMach: number
  proxFuseRadiusM: number
  lethalRadiusM: number
  maxRangeM: number
  batteryLifeSec: number
  navigationConstant: number
  irSeeker?: IRSeekerSpec
  arSeeker?: ActiveRadarSeekerSpec
  dataLinkUpdateHz: number
  /**
   * Radar ECCM quality: 0 = naive seeker easily deceived by chaff,
   * 1 = fully resistant. Multiplied against chaff seduction probability.
   * Defaults to 0 (fully susceptible) when omitted.
   */
  eccmResistance?: number
}

export type MissileGuidanceMode = 'INERTIAL' | 'DATALINK' | 'ACTIVE' | 'IR_TRACK' | 'COAST'

export interface MissileState {
  id: string
  spec: MissileSpec
  positionNED: Vec3
  velocityNED: Vec3
  attitudeQuat: Quat
  ageSec: number
  burnActive: boolean
  targetEntityId: string
  guidanceMode: MissileGuidanceMode
  seekerAzDeg: number
  seekerElDeg: number
  locked: boolean
  prevLOSUnit: Vec3
  prevTargetVel: Vec3        // for APN target-acceleration feedforward
  lastKnownTargetPos: Vec3   // coast guidance when target lost
  lastKnownTargetVel: Vec3
  active: boolean
  shooterEntityId: string
  /**
   * A decoy the seeker has committed to, and how long it stays committed.
   *
   * Seduction used to be re-rolled every tick and only redirected guidance for
   * that single frame, so a "successful" flare or chaff break steered the
   * missile for 1/60 s and it snapped straight back onto the real target. The
   * net effect on the trajectory was indistinguishable from noise. Breaking lock
   * has to *stick* for the decoy to be worth carrying.
   */
  decoyTargetPos?: Vec3
  decoyTargetVel?: Vec3
  decoyRemainSec?: number
}

export interface GunRoundState {
  positionNED: Vec3
  velocityNED: Vec3
  ageSec: number
  active: boolean
  shooterEntityId: string
  spec: import('./aircraft').GunSpec
}
