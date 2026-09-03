import { describe, expect, it } from 'vitest'
import { applyHit, computeFlightPenalties } from './DamageModel'
import { defaultDamageState } from '../types/damage'

describe('DamageModel.applyHit', () => {
  it('accumulates zone damage and clamps to 1', () => {
    const dmg = defaultDamageState()
    expect(applyHit(dmg, 'FUSELAGE', 0.3)).toBe(false)
    expect(dmg.zones.FUSELAGE).toBeCloseTo(0.3)
    applyHit(dmg, 'FUSELAGE', 0.9)
    expect(dmg.zones.FUSELAGE).toBe(1)
  })

  it('ignores hits when invincible', () => {
    const dmg = defaultDamageState()
    expect(applyHit(dmg, 'ENGINE', 1, true)).toBe(false)
    expect(dmg.zones.ENGINE).toBe(0)
    expect(dmg.engineFailed).toBe(false)
  })

  it('sets onFire when engine damage exceeds 0.65', () => {
    const dmg = defaultDamageState()
    applyHit(dmg, 'ENGINE', 0.66)
    expect(dmg.onFire).toBe(true)
    expect(dmg.engineFailed).toBe(false)
  })

  it('sets engineFailed when engine damage exceeds 0.85', () => {
    const dmg = defaultDamageState()
    applyHit(dmg, 'ENGINE', 0.86)
    expect(dmg.engineFailed).toBe(true)
  })

  it('marks destroyed when engine zone reaches 1.0', () => {
    const dmg = defaultDamageState()
    expect(applyHit(dmg, 'ENGINE', 1.0)).toBe(true)
    expect(dmg.structuralFailure).toBe(true)
  })

  it('marks destroyed on combined engine and fuselage damage', () => {
    const dmg = defaultDamageState()
    applyHit(dmg, 'ENGINE', 0.91)
    expect(applyHit(dmg, 'FUSELAGE', 0.61)).toBe(true)
    expect(dmg.structuralFailure).toBe(true)
  })

  it('marks destroyed when both wings are lost', () => {
    const dmg = defaultDamageState()
    applyHit(dmg, 'WING_LEFT', 1.0)
    expect(applyHit(dmg, 'WING_RIGHT', 1.0)).toBe(true)
  })

  it('a dead-centre missile hit (lethality 1.0) destroys in one shot', () => {
    // MissileSystem severity formula: lethality^2 * 1.15, clamped to 1.0 by applyHit.
    const dmg = defaultDamageState()
    const lethality = 1.0
    const severity = lethality * lethality * 1.15
    expect(applyHit(dmg, 'FUSELAGE', severity)).toBe(true)
    expect(dmg.zones.FUSELAGE).toBe(1)
  })
})

describe('DamageModel.computeFlightPenalties', () => {
  it('zeroes thrust when engineFailed is set', () => {
    const dmg = defaultDamageState()
    applyHit(dmg, 'ENGINE', 0.86)
    const p = computeFlightPenalties(dmg)
    expect(p.thrustMultiplier).toBe(0)
  })

  it('reduces thrust proportionally to engine damage before failure', () => {
    const dmg = defaultDamageState()
    applyHit(dmg, 'ENGINE', 0.5)
    const p = computeFlightPenalties(dmg)
    expect(p.thrustMultiplier).toBeCloseTo(0.575, 2)
    expect(p.thrustMultiplier).toBeGreaterThan(0)
  })

  it('adds asymmetric drag from unequal wing damage', () => {
    const dmg = defaultDamageState()
    applyHit(dmg, 'WING_LEFT', 0.8)
    applyHit(dmg, 'WING_RIGHT', 0.2)
    const p = computeFlightPenalties(dmg)
    expect(p.asymmetricDragCD).toBeCloseTo(0.036, 3)
  })

  it('has zero asymmetric drag when wings are equally damaged', () => {
    const dmg = defaultDamageState()
    applyHit(dmg, 'WING_LEFT', 0.5)
    applyHit(dmg, 'WING_RIGHT', 0.5)
    expect(computeFlightPenalties(dmg).asymmetricDragCD).toBe(0)
  })

  it('increases fuel leak when engine is damaged', () => {
    const dmg = defaultDamageState()
    applyHit(dmg, 'ENGINE', 0.4)
    expect(computeFlightPenalties(dmg).fuelLeakMultiplier).toBeGreaterThan(1)
  })
})
