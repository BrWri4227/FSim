import type { GroundTargetSpec } from '../../types/groundTarget'

export const SA10: GroundTargetSpec = {
  id: 'sa10',
  displayName: 'SA-10 Grumble',
  category: 'SAM_SITE',
  hpMax: 100,
  rcsM2: 25,
  irSignatureKW: 12,
  speedMS: 0,
  meshSize: { lengthM: 9, widthM: 3, heightM: 4 },
  meshColor: 0x4a5a3a,
  samDetectionRangeM: 60000,
  samMissileId: 'r77',          // re-uses ARH missile catalog for now
  samEngagementRangeM: 50000,
  samReloadSec: 8,
}

export const T90: GroundTargetSpec = {
  id: 't90',
  displayName: 'T-90 MBT',
  category: 'ARMOR',
  hpMax: 60,
  rcsM2: 8,
  irSignatureKW: 5,
  speedMS: 0,
  meshSize: { lengthM: 7, widthM: 3, heightM: 2.5 },
  meshColor: 0x3a4030,
}

export const FRIGATE: GroundTargetSpec = {
  id: 'frigate',
  displayName: 'Frigate',
  category: 'SHIP',
  hpMax: 250,
  rcsM2: 220,
  irSignatureKW: 30,
  speedMS: 12,
  meshSize: { lengthM: 130, widthM: 16, heightM: 22 },
  meshColor: 0x2a3540,
}

export const HARDENED_SHELTER: GroundTargetSpec = {
  id: 'shelter',
  displayName: 'Hardened Shelter',
  category: 'STRUCTURE',
  hpMax: 200,
  rcsM2: 30,
  irSignatureKW: 1,
  speedMS: 0,
  meshSize: { lengthM: 22, widthM: 14, heightM: 8 },
  meshColor: 0x686868,
}

export const GROUND_TARGET_SPECS: Record<string, GroundTargetSpec> = {
  [SA10.id]: SA10,
  [T90.id]: T90,
  [FRIGATE.id]: FRIGATE,
  [HARDENED_SHELTER.id]: HARDENED_SHELTER,
}
