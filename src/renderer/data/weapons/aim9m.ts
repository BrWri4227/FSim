import type { MissileSpec } from '../../types/weapons'

export const AIM9M: MissileSpec = {
  id: 'aim9m',
  displayName: 'AIM-9M Sidewinder',
  category: 'IR_MISSILE',
  nation: 'USA',
  massKg: 85,
  dragCd: 0.32,
  bodyDiameterM: 0.127,
  maxThrustN: 26000,
  burnTimeSec: 3.4,    // ~2.5 s boost + coast
  maxGOverload: 40,
  maxSpeedMach: 2.5,
  proxFuseRadiusM: 10,
  lethalRadiusM: 9,
  maxRangeM: 18000,
  navigationConstant: 4,   // pure PN, N=4 is standard for AIM-9M
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
