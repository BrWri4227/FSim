import type { MissileSpec } from '../../types/weapons'

export const R77: MissileSpec = {
  id: 'r77',
  displayName: 'R-77 Adder',
  category: 'ARH_MISSILE',
  nation: 'RUS',
  massKg: 175,
  dragCd: 0.31,
  bodyDiameterM: 0.2,
  maxThrustN: 44000,
  burnTimeSec: 8.4,
  maxGOverload: 35,
  maxSpeedMach: 4.0,
  proxFuseRadiusM: 12,
  lethalRadiusM: 10,
  maxRangeM: 65000,
  batteryLifeSec: 90,
  navigationConstant: 5,
  arSeeker: {
    peakPowerW: 180,
    antennaGainDB: 30,
    frequencyGHz: 9.0,
    terminalActivationRangeM: 14000
  },
  dataLinkUpdateHz: 2
}
