import { describe, expect, it } from 'vitest'
import type { NetPlayerState } from './MultiplayerTypes'
import { quantizePlayerState, missileSetKey } from './serialization'

function baseState(overrides: Partial<NetPlayerState> = {}): NetPlayerState {
  return {
    positionNED: [1234.56789012, -9876.54321, 4200.111119],
    velocityNED: [210.98765, -3.33333, 0.55551],
    attitudeQuat: [0.7071067811, 0.0000123, -0.7071067811, 0.123456789],
    throttle: 0.812345,
    ejected: false,
    structuralFailure: false,
    radar: { mode: 'RWS', sttTargetId: null },
    missiles: [],
    countermeasures: { flares: [], chaffClouds: [] },
    ...overrides,
  }
}

describe('quantizePlayerState', () => {
  it('rounds pose fields to the wire precision budget', () => {
    const q = quantizePlayerState(baseState())
    expect(q.positionNED).toEqual([1234.57, -9876.54, 4200.11])
    expect(q.velocityNED).toEqual([210.99, -3.33, 0.56])
    expect(q.attitudeQuat).toEqual([0.70711, 0.00001, -0.70711, 0.12346])
    expect(q.throttle).toBe(0.812)
  })

  it('is idempotent', () => {
    const once = quantizePlayerState(baseState())
    const twice = quantizePlayerState(once)
    expect(twice).toEqual(once)
  })

  it('does not mutate the input', () => {
    const input = baseState()
    quantizePlayerState(input)
    expect(input.positionNED[0]).toBe(1234.56789012)
  })

  it('passes a null countermeasure payload through untouched', () => {
    const q = quantizePlayerState(baseState({ countermeasures: null }))
    expect(q.countermeasures).toBeNull()
  })

  it('quantizes missiles and countermeasures', () => {
    const q = quantizePlayerState(baseState({
      missiles: [{
        id: 'm1',
        positionNED: [10.123456, 20.654321, -30.9999],
        velocityNED: [900.44444, 0, 0],
        targetEntityId: 'peer_2',
        active: true,
      }],
      countermeasures: {
        flares: [{ positionNED: [1.23456, 2.34567, 3.4567], velocityNED: [0.111, 0.222, 0.333], heatSignatureKW: 59.98765, ageSec: 0.512345 }],
        chaffClouds: [],
      },
    }))
    expect(q.missiles[0]!.positionNED).toEqual([10.12, 20.65, -31])
    expect(q.missiles[0]!.velocityNED).toEqual([900.44, 0, 0])
    expect(q.countermeasures!.flares[0]!.positionNED).toEqual([1.2, 2.3, 3.5])
    expect(q.countermeasures!.flares[0]!.heatSignatureKW).toBe(59.99)
  })

  it('collapses non-finite values to zero', () => {
    const q = quantizePlayerState(baseState({ velocityNED: [Infinity, NaN, -Infinity] }))
    expect(q.velocityNED).toEqual([0, 0, 0])
  })
})

describe('missileSetKey', () => {
  const mk = (id: string): NetPlayerState['missiles'][number] => ({
    id, positionNED: [0, 0, 0], velocityNED: [0, 0, 0], targetEntityId: 't', active: true,
  })

  it('is empty for no missiles', () => {
    expect(missileSetKey([])).toBe('')
  })

  it('changes when a missile is added or removed', () => {
    const a = missileSetKey([mk('x')])
    const b = missileSetKey([mk('x'), mk('y')])
    const c = missileSetKey([mk('y')])
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('is stable for the same set', () => {
    expect(missileSetKey([mk('x'), mk('y')])).toBe(missileSetKey([mk('x'), mk('y')]))
  })
})
