import type { MissileSpec } from '../../types/weapons'

export const R77: MissileSpec = {
  id: 'r77',
  displayName: 'R-77 Adder',
  category: 'ARH_MISSILE',
  nation: 'RUS',
  massKg: 175,
  dragCd: 0.30,
  bodyDiameterM: 0.2,
  maxThrustN: 46000,
  burnTimeSec: 8.0,
  maxGOverload: 40,
  maxSpeedMach: 4.0,
  proxFuseRadiusM: 12,
  lethalRadiusM: 10,
  maxRangeM: 80000,
  navigationConstant: 5,
  arSeeker: {
    peakPowerW: 180,
    antennaGainDB: 30,
    frequencyGHz: 9.0,
    terminalActivationRangeM: 15000
  },
  dataLinkUpdateHz: 2
}
