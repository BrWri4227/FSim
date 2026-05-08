import type { MissileSpec } from '../../types/weapons'

export const AIM120B: MissileSpec = {
  id: 'aim120b',
  displayName: 'AIM-120B AMRAAM',
  category: 'ARH_MISSILE',
  nation: 'USA',
  massKg: 152,
  dragCd: 0.29,
  bodyDiameterM: 0.178,
  maxThrustN: 39000,
  burnTimeSec: 6.8,
  maxGOverload: 32,
  maxSpeedMach: 3.8,
  proxFuseRadiusM: 12,
  lethalRadiusM: 10,
  maxRangeM: 50000,
  batteryLifeSec: 80,
  navigationConstant: 5,   // APN N=5 matches published intercept performance
  arSeeker: {
    peakPowerW: 150,
    antennaGainDB: 28,
    frequencyGHz: 10.0,
    terminalActivationRangeM: 10000
  },
  dataLinkUpdateHz: 2
}
