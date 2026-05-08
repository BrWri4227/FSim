import type { MissileSpec } from '../../types/weapons'

export const AIM120B: MissileSpec = {
  id: 'aim120b',
  displayName: 'AIM-120B AMRAAM',
  category: 'ARH_MISSILE',
  nation: 'USA',
  massKg: 152,
  dragCd: 0.35,
  bodyDiameterM: 0.178,
  maxThrustN: 22000,
  burnTimeSec: 6.5,
  maxGOverload: 30,
  maxSpeedMach: 4.0,
  proxFuseRadiusM: 12,
  lethalRadiusM: 10,
  maxRangeM: 55000,
  navigationConstant: 3.5,
  arSeeker: {
    peakPowerW: 150,
    antennaGainDB: 28,
    frequencyGHz: 10.0,
    terminalActivationRangeM: 12000
  },
  dataLinkUpdateHz: 2
}
