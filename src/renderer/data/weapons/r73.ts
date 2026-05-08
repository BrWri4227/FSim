import type { MissileSpec } from '../../types/weapons'

export const R73: MissileSpec = {
  id: 'r73',
  displayName: 'R-73 Archer',
  category: 'IR_MISSILE',
  nation: 'RUS',
  massKg: 105,
  dragCd: 0.34,
  bodyDiameterM: 0.17,
  maxThrustN: 30000,
  burnTimeSec: 4.0,
  maxGOverload: 45,
  maxSpeedMach: 2.5,
  proxFuseRadiusM: 9,
  lethalRadiusM: 8,
  maxRangeM: 20000,
  navigationConstant: 4,   // APN N=4; R-73 is highly agile
  irSeeker: {
    gimbalLimitDeg: 60,    // ±60° off-boresight (HOBS capable)
    trackingRateRadS: 20,
    minHeatSignatureKW: 1.5,
    flareRejectionCapability: 0.85,
    fovDeg: 3,
    hmsCapable: true
  },
  dataLinkUpdateHz: 0
}
