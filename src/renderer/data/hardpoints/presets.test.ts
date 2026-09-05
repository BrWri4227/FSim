import { describe, expect, it } from 'vitest'
import { buildPreset, summariseStores, LOADOUT_PRESETS, type LoadoutPreset } from './presets'
import { AIRCRAFT_ROSTER, getAircraftById } from '../aircraft/catalog'
import { MISSILE_SPECS } from '../weapons/catalog'

const PRESET_IDS = LOADOUT_PRESETS.map(p => p.id)

/** Weapons each nation is allowed to carry in these presets. */
const NATION_WEAPONS: Record<'USA' | 'RUS', string[]> = {
  USA: ['aim9x', 'aim120b'],
  RUS: ['r73', 'r77'],
}

describe('buildPreset', () => {
  it('fills every station on every airframe for every preset', () => {
    for (const spec of AIRCRAFT_ROSTER) {
      for (const preset of PRESET_IDS) {
        const selection = buildPreset(spec, preset)
        for (const hp of spec.hardpoints) {
          expect(selection[hp.id], `${spec.id}/${preset}/${hp.id}`).toBeDefined()
        }
      }
    }
  })

  it('never puts a weapon on a station that cannot carry it', () => {
    for (const spec of AIRCRAFT_ROSTER) {
      for (const preset of PRESET_IDS) {
        for (const [hpId, weaponId] of Object.entries(buildPreset(spec, preset))) {
          if (weaponId === 'none') continue
          const hp = spec.hardpoints.find(h => h.id === hpId)!
          const weapon = MISSILE_SPECS[weaponId]!
          expect(
            hp.compatibleTypes.includes(weapon.category),
            `${spec.id}/${preset}: ${weaponId} on ${hpId}`,
          ).toBe(true)
        }
      }
    }
  })

  it('only loads weapons of the aircraft nation', () => {
    for (const spec of AIRCRAFT_ROSTER) {
      const allowed = NATION_WEAPONS[spec.nation]
      for (const preset of PRESET_IDS) {
        for (const weaponId of Object.values(buildPreset(spec, preset))) {
          if (weaponId === 'none') continue
          expect(allowed, `${spec.id}/${preset}`).toContain(weaponId)
        }
      }
    }
  })

  it('leaves bomb and fuel-only stations empty', () => {
    for (const spec of AIRCRAFT_ROSTER) {
      const selection = buildPreset(spec, 'BALANCED')
      for (const hp of spec.hardpoints) {
        const airToAir =
          hp.compatibleTypes.includes('IR_MISSILE') || hp.compatibleTypes.includes('ARH_MISSILE')
        if (!airToAir) expect(selection[hp.id], `${spec.id}/${hp.id}`).toBe('none')
      }
    }
  })

  /**
   * The whole point of the presets is that they trade against each other, and
   * that trade is carried by **mass**, not drag: `getStoreDragPenalty` clamps
   * into a 0.0018–0.0035 band and the AMRAAM's dragCd (0.29) sits marginally
   * *below* the Sidewinder's (0.30), so the two missiles are near-identical
   * draggers. A radar missile weighs 152 kg against an IR missile's 85, and
   * leaving surplus bays empty is what turns that into a real difference in
   * acceleration and sustained turn.
   */
  it('makes the BVR load substantially heavier than the dogfight load', () => {
    for (const spec of AIRCRAFT_ROSTER) {
      const dogfight = summariseStores(buildPreset(spec, 'DOGFIGHT'))
      const bvr = summariseStores(buildPreset(spec, 'BVR'))
      expect(bvr.massKg, `${spec.id} mass`).toBeGreaterThan(dogfight.massKg * 1.2)
      expect(dogfight.count, `${spec.id} count`).toBeLessThanOrEqual(bvr.count)
    }
  })

  it('caps the dogfight load at two radar missiles', () => {
    for (const spec of AIRCRAFT_ROSTER) {
      const radarId = spec.nation === 'RUS' ? 'r77' : 'aim120b'
      const carried = Object.values(buildPreset(spec, 'DOGFIGHT')).filter(w => w === radarId).length
      expect(carried, spec.id).toBeLessThanOrEqual(2)
    }
  })

  it('fills every air-to-air station on the full-rack presets', () => {
    for (const spec of AIRCRAFT_ROSTER) {
      for (const preset of ['BALANCED', 'BVR'] as const) {
        const selection = buildPreset(spec, preset)
        for (const hp of spec.hardpoints) {
          const airToAir =
            hp.compatibleTypes.includes('IR_MISSILE') || hp.compatibleTypes.includes('ARH_MISSILE')
          if (airToAir) expect(selection[hp.id], `${spec.id}/${preset}/${hp.id}`).not.toBe('none')
        }
      }
    }
  })

  it('grades radar-missile share across the three presets', () => {
    const spec = getAircraftById('f16c')!
    const radarCount = (preset: LoadoutPreset): number =>
      Object.values(buildPreset(spec, preset)).filter(w => w === 'aim120b').length
    expect(radarCount('DOGFIGHT')).toBeLessThan(radarCount('BALANCED'))
    expect(radarCount('BALANCED')).toBeLessThan(radarCount('BVR'))
  })
})

describe('summariseStores', () => {
  it('ignores empty stations', () => {
    const summary = summariseStores({ A: 'none', B: 'aim9x', C: 'none' })
    expect(summary.count).toBe(1)
    expect(summary.massKg).toBeCloseTo(MISSILE_SPECS['aim9x']!.massKg)
  })
})
