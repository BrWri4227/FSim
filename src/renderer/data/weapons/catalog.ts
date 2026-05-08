import type { MissileSpec } from '../../types/weapons'
import { AIM9X } from './aim9x'
import { AIM120B } from './aim120b'
import { R73 } from './r73'
import { R77 } from './r77'

export const MISSILE_SPECS: Record<string, MissileSpec> = {
  aim9x: AIM9X,
  aim120b: AIM120B,
  r73: R73,
  r77: R77,
  // Backward compatibility for stale stores that still reference AIM-9M.
  aim9m: AIM9X,
}

export function getMissileSpec(weaponId: string): MissileSpec | undefined {
  return MISSILE_SPECS[weaponId]
}

export function getStoreDragPenalty(missile: MissileSpec): number {
  return Math.max(0.0018, Math.min(0.0035, missile.dragCd * 0.01))
}
