import type { MissileSpec } from '../../types/weapons'

export const AIM9M: MissileSpec = {
  id: 'aim9m',
  displayName: 'AIM-9M Sidewinder',
  category: 'IR_MISSILE',
  nation: 'USA',
  massKg: 85,
  dragCd: 0.4,
  bodyDiameterM: 0.127,
  maxThrustN: 14000,
  burnTimeSec: 3.2,
  maxGOverload: 35,
  maxSpeedMach: 2.5,
  proxFuseRadiusM: 10,
  lethalRadiusM: 8,
  maxRangeM: 18000,
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
}
