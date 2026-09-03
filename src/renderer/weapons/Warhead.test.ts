import { describe, expect, it, vi } from 'vitest'
import { checkProximityFuse, computeLethality, hitZoneFromMissileApproach } from './Warhead'
import { AIM120B } from '../data/weapons/aim120b'
import type { MissileState } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'

const DT = 1 / 60

function makeMissile(overrides: Partial<MissileState> = {}): MissileState {
  return {
    id: 'm1',
    spec: AIM120B,
    positionNED: [0, 0, -5000],
    velocityNED: [300, 0, 0],
    attitudeQuat: [1, 0, 0, 0],
    ageSec: 1,
    burnActive: true,
    targetEntityId: 't1',
    guidanceMode: 'ACTIVE',
    seekerAzDeg: 0,
    seekerElDeg: 0,
    locked: true,
    prevLOSUnit: [1, 0, 0],
    prevTargetVel: [0, 0, 0],
    lastKnownTargetPos: [100, 0, -5000],
    lastKnownTargetVel: [0, 0, 0],
    active: true,
    shooterEntityId: 'p1',
    ...overrides,
  }
}

function makeTarget(
  pos: [number, number, number] = [100, 0, -5000],
  vel: [number, number, number] = [0, 0, 0]
): AircraftState {
  return { positionNED: pos, velocityNED: vel } as AircraftState
}

describe('Warhead.checkProximityFuse', () => {
  it('detonates when already inside the fuse gate', () => {
    const m = makeMissile({ positionNED: [0, 0, -5000], velocityNED: [0, 0, 0] })
    const t = makeTarget([5, 0, -5000], [0, 0, 0])
    const result = checkProximityFuse(m, t, DT)
    expect(result.detonate).toBe(true)
    expect(result.missDistanceM).toBeCloseTo(5)
  })

  it('detonates on a high-closure pass whose closest approach falls strictly inside the tick', () => {
    // Head-on merge: ~1200 m/s closure (missile 900 m/s, target 300 m/s closing), so
    // relative separation changes by 1200 * (1/60) = 20 m over a single tick — enough
    // to step clean past a 12 m fuse gate. Both the start-of-tick and end-of-tick
    // positions are set up to be OUTSIDE the gate (13.45 m each) while the true
    // closest-approach point at t = dt/2 (lateral miss distance 9 m) is inside it.
    // A same-tick point test (the old, buggy behaviour) would miss this shot entirely.
    const gate = AIM120B.proxFuseRadiusM // 12
    const m = makeMissile({ positionNED: [0, 0, -5000], velocityNED: [900, 0, 0] })
    const t = makeTarget([10, 9, -5000], [-300, 0, 0])

    const result = checkProximityFuse(m, t, DT)
    expect(result.detonate).toBe(true)
    expect(result.missDistanceM).toBeCloseTo(9, 1)
    expect(result.missDistanceM).toBeLessThan(gate)
  })

  it('does not detonate when the closest approach stays outside the gate', () => {
    const gate = AIM120B.proxFuseRadiusM
    const m = makeMissile({ positionNED: [0, gate + 50, -5000], velocityNED: [300, 0, 0] })
    const t = makeTarget([500, 0, -5000], [0, 0, 0])
    const result = checkProximityFuse(m, t, DT)
    expect(result.detonate).toBe(false)
    expect(result.missDistanceM).toBeGreaterThan(gate)
  })
})

describe('Warhead.computeLethality', () => {
  const lethal = AIM120B.lethalRadiusM

  it('returns 1.0 at or inside lethal radius', () => {
    expect(computeLethality(0, lethal)).toBe(1)
    expect(computeLethality(lethal, lethal)).toBe(1)
  })

  it('returns 0 beyond 3x lethal radius', () => {
    expect(computeLethality(lethal * 3 + 1, lethal)).toBe(0)
  })

  it('linearly falls off between lethal and 3x lethal radius', () => {
    const mid = lethal * 2
    expect(computeLethality(mid, lethal)).toBeCloseTo(0.5)
  })
})

describe('Warhead.hitZoneFromMissileApproach', () => {
  it('returns FUSELAGE for near-zero velocity', () => {
    expect(hitZoneFromMissileApproach([0, 0, 0], [1, 0, 0, 0])).toBe('FUSELAGE')
  })

  it('returns ENGINE when approaching from above (negative NED z velocity)', () => {
    expect(hitZoneFromMissileApproach([50, 0, -200], [1, 0, 0, 0])).toBe('ENGINE')
  })

  it('returns FUSELAGE for head-on approach', () => {
    expect(hitZoneFromMissileApproach([300, 0, 0], [1, 0, 0, 0])).toBe('FUSELAGE')
  })

  it('returns a wing zone for lateral approach', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    expect(hitZoneFromMissileApproach([0, 300, 0], [1, 0, 0, 0])).toBe('WING_LEFT')
    vi.mocked(Math.random).mockReturnValue(0.9)
    expect(hitZoneFromMissileApproach([0, -300, 0], [1, 0, 0, 0])).toBe('WING_RIGHT')
    vi.restoreAllMocks()
  })
})
