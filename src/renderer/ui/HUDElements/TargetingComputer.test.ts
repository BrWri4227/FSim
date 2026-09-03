import { describe, it, expect } from 'vitest'
import { MISSILE_SPECS } from '../../data/weapons/catalog'
import {
  computeLARInfo,
  computeMissileLeadSolution,
  solveInterceptTime,
  selectedAAMissileSpec,
} from './TargetingComputer'
import type { OwnState, TargetState } from './TargetingComputer'
import type { LoadedStore } from '../../types/weapons'

const AIM120 = MISSILE_SPECS.aim120b!

const own = (over: Partial<OwnState> = {}): OwnState => ({
  positionNED: [0, 0, -8000],
  velocityNED: [300, 0, 0],
  attitudeQuat: [1, 0, 0, 0],
  ...over,
})

const tgt = (over: Partial<TargetState> = {}): TargetState => ({
  positionNED: [20000, 0, -8000],
  velocityNED: [-250, 0, 0],
  ...over,
})

describe('computeLARInfo', () => {
  it('orders Rmin < Rne < Rmax', () => {
    const lar = computeLARInfo(AIM120, own(), tgt())!
    expect(lar).not.toBeNull()
    expect(lar.rMinM).toBeLessThan(lar.rNeM)
    expect(lar.rNeM).toBeLessThan(lar.rMaxM)
  })

  it('flags a co-alt closing target at 20 km as in-range', () => {
    const lar = computeLARInfo(AIM120, own(), tgt({ positionNED: [20000, 0, -8000] }))!
    expect(lar.inRange).toBe(true)
  })

  it('flags a very close target as inside Rmin (not in range)', () => {
    const lar = computeLARInfo(AIM120, own(), tgt({ positionNED: [800, 0, -8000] }))!
    expect(lar.rangeM).toBeLessThan(lar.rMinM)
    expect(lar.inRange).toBe(false)
  })

  it('NEZ is a subset of the in-range band', () => {
    const lar = computeLARInfo(AIM120, own(), tgt())!
    if (lar.inNoEscapeZone) expect(lar.inRange).toBe(true)
  })
})

describe('solveInterceptTime', () => {
  it('is positive for a closing geometry', () => {
    const t = solveInterceptTime([2000, 0, 0], [-400, 0, 0], 900)
    expect(t).not.toBeNull()
    expect(t!).toBeGreaterThan(0)
  })
})

describe('computeMissileLeadSolution', () => {
  it('is ~0° off-boresight for a target dead ahead and co-altitude', () => {
    const sol = computeMissileLeadSolution(AIM120, own(), tgt({ velocityNED: [0, 0, 0] }))!
    expect(sol).not.toBeNull()
    expect(sol.interceptTimeSec).toBeGreaterThan(0)
    expect(sol.offBoresightDeg).toBeLessThan(2)
  })

  it('needs meaningful lead for a fast crossing target', () => {
    const sol = computeMissileLeadSolution(AIM120, own(), tgt({ velocityNED: [0, 300, 0] }))!
    expect(sol.offBoresightDeg).toBeGreaterThan(5)
  })
})

describe('selectedAAMissileSpec', () => {
  const mk = (weaponId: string, category: LoadedStore['category'], remainingRounds: number): LoadedStore => ({
    hardpointId: `hp-${weaponId}`, weaponId, category, massKg: 150, dragPenalty: 0.001, remainingRounds,
  })
  const stores: LoadedStore[] = [
    mk('aim120b', 'ARH_MISSILE', 2),
    mk('aim9x', 'IR_MISSILE', 0),
  ]

  it('returns the spec for a selected loaded missile', () => {
    expect(selectedAAMissileSpec(stores, 'AIM120B')?.id).toBe(AIM120.id)
  })
  it('returns null when the selection is a gun', () => {
    expect(selectedAAMissileSpec(stores, 'GUN')).toBeNull()
  })
  it('returns null when the selected missile is out of rounds', () => {
    expect(selectedAAMissileSpec(stores, 'aim9x')).toBeNull()
  })
})
