import type { MissileSpec } from '../../types/weapons'

export const AIM9X: MissileSpec = {
  id: 'aim9x',
  displayName: 'AIM-9X Sidewinder',
  category: 'IR_MISSILE',
  nation: 'USA',
  massKg: 85.3,
  dragCd: 0.30,
  bodyDiameterM: 0.127,
  maxThrustN: 27500,
  burnTimeSec: 5.0,
  maxGOverload: 60,
  maxSpeedMach: 2.7,
  proxFuseRadiusM: 11,
  lethalRadiusM: 10,
  maxRangeM: 26000,
  batteryLifeSec: 45,
  navigationConstant: 5,
  irSeeker: {
    gimbalLimitDeg: 90,
    trackingRateRadS: 24,
    minHeatSignatureKW: 1.2,
    flareRejectionCapability: 0.82,
    fovDeg: 2.5,
    hmsCapable: true,
  },
  dataLinkUpdateHz: 0,
}
