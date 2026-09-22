/**
 * Loadout presets — turning a configuration screen into a decision.
 *
 * Nine per-pylon dropdowns is not a choice: each station holds one missile and
 * nothing stopped you filling every one, so the answer was always "everything".
 * These three presets give the pilot a real trade instead, and because store
 * mass and drag are already modelled per-store the cost is real too — a BVR
 * load genuinely bleeds turn performance against a Dogfight load.
 *
 * The per-pylon dropdowns still exist underneath for anyone who wants them.
 */
import type { AircraftSpec, WeaponCategory } from '../../types/aircraft'
import { MISSILE_SPECS, getStoreDragPenalty } from '../weapons/catalog'

export type LoadoutPreset = 'DOGFIGHT' | 'BALANCED' | 'BVR'

export const LOADOUT_PRESETS: ReadonlyArray<{ id: LoadoutPreset; label: string; hint: string }> = [
  { id: 'DOGFIGHT', label: 'DOGFIGHT', hint: 'Short-range IR, stations left empty. Lightest — best acceleration and turn.' },
  { id: 'BALANCED', label: 'BALANCED', hint: 'Full rack, mixed IR and radar. No strong preference.' },
  { id: 'BVR',      label: 'BVR',      hint: 'Full rack, radar-heavy. Reaches furthest, costs you in the merge.' },
]

/** Fraction of the flexible stations that go to radar missiles. Rest go to IR. */
const RADAR_SHARE: Record<LoadoutPreset, number> = {
  DOGFIGHT: 0,
  BALANCED: 0.5,
  BVR: 1,
}

/**
 * How many radar missiles each preset will carry at most.
 *
 * This is what makes the presets a real decision rather than three arrangements
 * of the same weight. Every airframe on the roster has only two stations that
 * accept *either* missile — the rest are type-fixed — so swapping which weapon
 * goes where moves barely a tenth of the load. Leaving stations **empty**
 * instead is the lever that actually exists: a radar missile is 152 kg against
 * an IR missile's 85, and a Dogfight load flies several hundred kilos lighter
 * for it.
 *
 * The cap of two also gives the Dogfight preset the thing its name promises —
 * you cannot bring a full BVR rack to a mode built around the merge.
 */
const MAX_RADAR_MISSILES: Record<LoadoutPreset, number> = {
  DOGFIGHT: 2,
  BALANCED: Infinity,
  BVR: Infinity,
}

interface NationWeapons {
  ir: string
  radar: string
}

function weaponsFor(spec: AircraftSpec): NationWeapons {
  return spec.nation === 'RUS'
    ? { ir: 'r73', radar: 'r77' }
    : { ir: 'aim9x', radar: 'aim120b' }
}

function accepts(types: WeaponCategory[], category: WeaponCategory): boolean {
  return types.includes(category)
}

/**
 * Build a hardpointId → weaponId map for one preset.
 *
 * IR-capable stations are always filled — they are the cheap ones and every
 * preset wants them. Radar stations are filled up to the preset's cap, so a
 * Dogfight load simply leaves the surplus bays empty rather than hauling
 * missiles it does not intend to use.
 */
export function buildPreset(spec: AircraftSpec, preset: LoadoutPreset): Record<string, string> {
  const { ir, radar } = weaponsFor(spec)
  const out: Record<string, string> = {}
  const flexible: string[] = []
  const radarOnly: string[] = []

  for (const hp of spec.hardpoints) {
    const canIR = accepts(hp.compatibleTypes, 'IR_MISSILE')
    const canRadar = accepts(hp.compatibleTypes, 'ARH_MISSILE')
    if (canIR && canRadar) {
      flexible.push(hp.id)
    } else if (canIR) {
      out[hp.id] = ir
    } else if (canRadar) {
      radarOnly.push(hp.id)
    } else {
      // Bomb / AGM / fuel-only stations stay empty: air-to-air presets have no
      // business filling them, and a store the pilot did not ask for is drag.
      out[hp.id] = 'none'
    }
  }

  // Flexible stations first, since those are the ones the preset is really
  // choosing between; radar-only bays then take whatever cap is left.
  const budget = MAX_RADAR_MISSILES[preset]
  let radarUsed = 0
  const flexRadarWanted = Math.round(flexible.length * RADAR_SHARE[preset])
  flexible.forEach((hpId, i) => {
    if (i < flexRadarWanted && radarUsed < budget) {
      out[hpId] = radar
      radarUsed++
    } else {
      out[hpId] = ir
    }
  })
  for (const hpId of radarOnly) {
    if (radarUsed < budget) {
      out[hpId] = radar
      radarUsed++
    } else {
      out[hpId] = 'none'
    }
  }

  return out
}

export interface StoresSummary {
  count: number
  massKg: number
  dragPenalty: number
}

/** What the selection costs you, for display next to the presets. */
export function summariseStores(selection: Record<string, string>): StoresSummary {
  let count = 0
  let massKg = 0
  let dragPenalty = 0
  for (const weaponId of Object.values(selection)) {
    const missile = MISSILE_SPECS[weaponId]
    if (!missile) continue
    count++
    massKg += missile.massKg
    dragPenalty += getStoreDragPenalty(missile)
  }
  return { count, massKg, dragPenalty }
}
