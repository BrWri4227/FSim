import type { MissileSpec } from '../../types/weapons'

export const R73: MissileSpec = {
  id: 'r73',
  displayName: 'R-73 Archer',
  category: 'IR_MISSILE',
  nation: 'RUS',
  massKg: 105,
  dragCd: 0.33,
  bodyDiameterM: 0.17,
  maxThrustN: 29500,
  burnTimeSec: 4.6,
  maxGOverload: 52,
  maxSpeedMach: 2.6,
  proxFuseRadiusM: 9,
  lethalRadiusM: 8,
  maxRangeM: 22000,
  batteryLifeSec: 40,
  navigationConstant: 4,   // APN N=4; R-73 is highly agile
  irSeeker: {
    gimbalLimitDeg: 70,    // high off-boresight, but below AIM-9X
    trackingRateRadS: 22,
    minHeatSignatureKW: 1.5,
    flareRejectionCapability: 0.74,
    fovDeg: 3,
    hmsCapable: true
  },
  dataLinkUpdateHz: 0
}
