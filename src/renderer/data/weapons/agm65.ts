import type { MissileSpec } from '../../types/weapons'

export const AGM65: MissileSpec = {
  id: 'agm65',
  displayName: 'AGM-65 Maverick',
  category: 'AGM_MISSILE',
  nation: 'USA',
  massKg: 210,
  dragCd: 0.45,
  bodyDiameterM: 0.305,
  maxThrustN: 11500,
  burnTimeSec: 5.5,
  maxGOverload: 12,
  maxSpeedMach: 1.0,
  proxFuseRadiusM: 4,    // contact-fused but allow small miss-distance for splash
  lethalRadiusM: 18,
  maxRangeM: 22000,
  batteryLifeSec: 90,
  navigationConstant: 4,
  // Re-uses IR seeker plumbing (Maverick D/E/G have IIR seekers; we treat the lock
  // as already-acquired before launch and feed the seeker the GroundTarget position).
  irSeeker: {
    gimbalLimitDeg: 30,
    trackingRateRadS: 8,
    minHeatSignatureKW: 0.5,
    flareRejectionCapability: 0.95,
    fovDeg: 1.5,
    hmsCapable: false,
  },
  dataLinkUpdateHz: 0,
}
