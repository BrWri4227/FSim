import { describe, expect, it } from 'vitest'
import { deriveAircraftIdentity, BAR_LABELS, type AircraftBars } from './identity'
import { AIRCRAFT_ROSTER, getAircraftById } from './catalog'

const barKeys = BAR_LABELS.map(([key]) => key)

function barsFor(id: string): AircraftBars {
  const spec = getAircraftById(id)
  if (!spec) throw new Error(`missing aircraft ${id}`)
  return deriveAircraftIdentity(spec).bars
}

describe('deriveAircraftIdentity', () => {
  it('gives every airframe on the roster a role, a blurb and all five bars', () => {
    for (const spec of AIRCRAFT_ROSTER) {
      const identity = deriveAircraftIdentity(spec)
      expect(identity.role, spec.id).toBeTruthy()
      expect(identity.blurb.length, spec.id).toBeGreaterThan(10)
      for (const key of barKeys) {
        expect(identity.bars[key], `${spec.id}.${key}`).toBeTypeOf('number')
      }
    }
  })

  it('normalises every bar into 0..1 with a visible floor', () => {
    for (const spec of AIRCRAFT_ROSTER) {
      for (const key of barKeys) {
        const v = deriveAircraftIdentity(spec).bars[key]
        // Floored at 0.08 so the weakest airframe still shows a stub rather
        // than an empty bar, which reads as missing data.
        expect(v, `${spec.id}.${key}`).toBeGreaterThanOrEqual(0.08)
        expect(v, `${spec.id}.${key}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('spans the full range on each bar, so the comparison is meaningful', () => {
    for (const key of barKeys) {
      const values = AIRCRAFT_ROSTER.map(s => deriveAircraftIdentity(s).bars[key])
      expect(Math.min(...values), key).toBeCloseTo(0.08)
      expect(Math.max(...values), key).toBeCloseTo(1)
    }
  })

  // The point of the card is that the bars match how the aircraft actually
  // flies. These are the orderings a player would notice first.
  it('ranks the stealth airframes above the fourth-generation ones', () => {
    expect(barsFor('f22').stealth).toBeGreaterThan(barsFor('mig29').stealth)
    expect(barsFor('f35a').stealth).toBeGreaterThan(barsFor('f15c').stealth)
    expect(barsFor('su57').stealth).toBeGreaterThan(barsFor('su27').stealth)
  })

  it('ranks the light knife-fighters above the heavy interceptors on turn', () => {
    expect(barsFor('mig29').turn).toBeGreaterThan(barsFor('f15c').turn)
    expect(barsFor('f16c').turn).toBeGreaterThan(barsFor('fa18e').turn)
  })

  it('ranks the Raptor above the Fulcrum on acceleration and reach', () => {
    expect(barsFor('f22').acceleration).toBeGreaterThan(barsFor('mig29').acceleration)
    expect(barsFor('f22').reach).toBeGreaterThan(barsFor('mig29').reach)
  })

  it('reflects the countermeasure load in survivability', () => {
    // F-22 carries 96/96, MiG-29 60/60.
    expect(barsFor('f22').survivability).toBeGreaterThan(barsFor('mig29').survivability)
  })
})
