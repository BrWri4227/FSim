import type { MissileSpec } from '../../types/weapons'

export const R73: MissileSpec = {
  id: 'r73',
  displayName: 'R-73 Archer',
  category: 'IR_MISSILE',
  nation: 'RUS',
  massKg: 105,
  dragCd: 0.42,
  bodyDiameterM: 0.17,
  maxThrustN: 16000,
  burnTimeSec: 3.0,
  maxGOverload: 40,
  maxSpeedMach: 2.5,
  proxFuseRadiusM: 9,
  lethalRadiusM: 7,
  maxRangeM: 20000,
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
}
