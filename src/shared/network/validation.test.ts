import { describe, expect, it } from 'vitest'
import type { HitEvent, NetPlayerState } from './MultiplayerTypes'
import {
  GUN_HIT_MAX_RANGE_M,
  HIT_RANGE_SLACK_M,
  MAX_INBOUND_DAMAGE_SEVERITY,
  MAX_NET_FLARES,
  MAX_NET_MISSILES,
  MISSILE_HIT_MAX_RANGE_M,
  isPlausibleHit,
  isValidHitEvent,
  isValidPlayerState,
  isValidProfile,
  isValidRadarState,
  nedDistanceM,
} from './validation'

function makeState(pos: [number, number, number], overrides: Partial<NetPlayerState> = {}): NetPlayerState {
  return {
    positionNED: pos,
    velocityNED: [0, 0, 0],
    attitudeQuat: [1, 0, 0, 0],
    throttle: 0.5,
    ejected: false,
    structuralFailure: false,
    radar: { mode: 'OFF', sttTargetId: null },
    missiles: [],
    countermeasures: { flares: [], chaffClouds: [] },
    ...overrides,
  }
}

describe('network validation', () => {
  describe('isValidProfile', () => {
    it('accepts non-empty aircraft id up to 64 chars', () => {
      expect(isValidProfile({ aircraftId: 'f16c' })).toBe(true)
    })

    it('rejects empty or oversized aircraft id', () => {
      expect(isValidProfile({ aircraftId: '' })).toBe(false)
      expect(isValidProfile({ aircraftId: 'x'.repeat(65) })).toBe(false)
    })
  })

  describe('isValidRadarState', () => {
    it('accepts GMTI radar mode', () => {
      expect(isValidRadarState({ mode: 'GMTI', sttTargetId: 'gt_1' })).toBe(true)
    })

    it('rejects unknown radar modes', () => {
      expect(isValidRadarState({ mode: 'SAM', sttTargetId: null })).toBe(false)
    })
  })

  describe('isValidHitEvent', () => {
    it('rejects self hits', () => {
      expect(isValidHitEvent({
        sourceId: 'peer_1',
        targetId: 'peer_1',
        zone: 'FUSELAGE',
        severity: 0.2,
        weapon: 'GUN',
      }, 'peer_1')).toBe(false)
    })

    it('rejects hits with wrong sourceId', () => {
      expect(isValidHitEvent({
        sourceId: 'peer_2',
        targetId: 'peer_1',
        zone: 'FUSELAGE',
        severity: 0.2,
        weapon: 'GUN',
      }, 'peer_1')).toBe(false)
    })

    it('rejects invalid damage zones and severity', () => {
      expect(isValidHitEvent({
        sourceId: 'peer_1',
        targetId: 'peer_2',
        zone: 'NOSE' as HitEvent['zone'],
        severity: 0.2,
        weapon: 'GUN',
      }, 'peer_1')).toBe(false)

      expect(isValidHitEvent({
        sourceId: 'peer_1',
        targetId: 'peer_2',
        zone: 'ENGINE',
        severity: MAX_INBOUND_DAMAGE_SEVERITY + 0.01,
        weapon: 'MISSILE',
      }, 'peer_1')).toBe(false)
    })

    it('accepts valid gun and missile hits', () => {
      expect(isValidHitEvent({
        sourceId: 'peer_1',
        targetId: 'peer_2',
        zone: 'TAIL',
        severity: 0.5,
        weapon: 'MISSILE',
      }, 'peer_1')).toBe(true)
    })
  })

  describe('isValidPlayerState', () => {
    it('accepts a well-formed player state', () => {
      expect(isValidPlayerState(makeState([0, 0, -1000]))).toBe(true)
    })

    it('rejects invalid vectors and throttle', () => {
      expect(isValidPlayerState({ ...makeState([0, 0, -1000]), throttle: 1.5 })).toBe(false)
      expect(isValidPlayerState({ ...makeState([0, 0, -1000]), positionNED: [0, 0] })).toBe(false)
    })

    it('accepts a null countermeasure payload (the "unchanged" sentinel)', () => {
      expect(isValidPlayerState({ ...makeState([0, 0, -1000]), countermeasures: null })).toBe(true)
    })

    it('rejects a countermeasure payload missing an array', () => {
      expect(isValidPlayerState({
        ...makeState([0, 0, -1000]),
        countermeasures: { flares: [] },
      })).toBe(false)
    })

    it('rejects oversized missile and countermeasure arrays', () => {
      const missile = {
        id: 'm', positionNED: [0, 0, 0], velocityNED: [0, 0, 0], targetEntityId: 't', active: true,
      }
      expect(isValidPlayerState({
        ...makeState([0, 0, -1000]),
        missiles: Array.from({ length: MAX_NET_MISSILES + 1 }, () => missile),
      })).toBe(false)

      const flare = { positionNED: [0, 0, 0], velocityNED: [0, 0, 0], heatSignatureKW: 10, ageSec: 0 }
      expect(isValidPlayerState({
        ...makeState([0, 0, -1000]),
        countermeasures: { flares: Array.from({ length: MAX_NET_FLARES + 1 }, () => flare), chaffClouds: [] },
      })).toBe(false)
    })

    it('rejects malformed missile entries', () => {
      expect(isValidPlayerState({
        ...makeState([0, 0, -1000]),
        missiles: [{ id: 'm', positionNED: [0, 0], velocityNED: [0, 0, 0], targetEntityId: 't', active: true }],
      })).toBe(false)
    })

    it('accepts well-formed missiles and flares', () => {
      expect(isValidPlayerState({
        ...makeState([0, 0, -1000]),
        missiles: [{ id: 'm1', positionNED: [1, 2, 3], velocityNED: [4, 5, 6], targetEntityId: 'peer_2', active: true }],
        countermeasures: {
          flares: [{ positionNED: [1, 2, 3], velocityNED: [0, 0, 1], heatSignatureKW: 60, ageSec: 0.2 }],
          chaffClouds: [{ positionNED: [1, 2, 3], velocityNED: [0, 0, 1], rcsM2: 25, ageSec: 0.1 }],
        },
      })).toBe(true)
    })
  })

  describe('isPlausibleHit', () => {
    it('rejects gun hits beyond range', () => {
      const hit: HitEvent = {
        sourceId: 'peer_1',
        targetId: 'peer_2',
        zone: 'FUSELAGE',
        severity: 0.2,
        weapon: 'GUN',
      }
      const source = makeState([0, 0, -5000])
      const target = makeState([GUN_HIT_MAX_RANGE_M + 1000, 0, -5000])
      expect(isPlausibleHit(hit, source, target)).toBe(false)
    })

    it('accepts in-range gun hits within slack', () => {
      const hit: HitEvent = {
        sourceId: 'peer_1',
        targetId: 'peer_2',
        zone: 'FUSELAGE',
        severity: 0.2,
        weapon: 'GUN',
      }
      const source = makeState([0, 0, -5000])
      const target = makeState([GUN_HIT_MAX_RANGE_M + HIT_RANGE_SLACK_M - 100, 0, -5000])
      expect(isPlausibleHit(hit, source, target)).toBe(true)
    })

    it('accepts in-range missile hits', () => {
      const hit: HitEvent = {
        sourceId: 'peer_1',
        targetId: 'peer_2',
        zone: 'ENGINE',
        severity: 0.8,
        weapon: 'MISSILE',
      }
      const source = makeState([0, 0, -5000])
      const target = makeState([10000, 0, -5000])
      expect(isPlausibleHit(hit, source, target)).toBe(true)
    })

    it('rejects missile hits beyond max range', () => {
      const hit: HitEvent = {
        sourceId: 'peer_1',
        targetId: 'peer_2',
        zone: 'ENGINE',
        severity: 0.8,
        weapon: 'MISSILE',
      }
      const source = makeState([0, 0, -5000])
      const target = makeState([MISSILE_HIT_MAX_RANGE_M + HIT_RANGE_SLACK_M + 1000, 0, -5000])
      expect(isPlausibleHit(hit, source, target)).toBe(false)
    })

    it('rejects hits on ejected targets', () => {
      const hit: HitEvent = {
        sourceId: 'peer_1',
        targetId: 'peer_2',
        zone: 'COCKPIT',
        severity: 1,
        weapon: 'GUN',
      }
      const source = makeState([0, 0, -5000])
      const target = makeState([100, 0, -5000], { ejected: true })
      expect(isPlausibleHit(hit, source, target)).toBe(false)
    })
  })

  describe('nedDistanceM', () => {
    it('computes 3D NED distance', () => {
      expect(nedDistanceM([0, 0, 0], [3, 4, 0])).toBe(5)
      expect(nedDistanceM([0, 0, -1000], [0, 0, -1500])).toBe(500)
    })
  })
})
