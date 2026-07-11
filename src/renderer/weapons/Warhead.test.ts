import { describe, expect, it, vi } from 'vitest'
import { checkProximityFuse, computeLethality, hitZoneFromMissileApproach } from './Warhead'
import { AIM120B } from '../data/weapons/aim120b'
import type { MissileState } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'

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
    prevMissDistanceM: null,
    ...overrides,
  }
}

function makeTarget(pos: [number, number, number] = [100, 0, -5000]): AircraftState {
  return { positionNED: pos } as AircraftState
}

describe('Warhead.checkProximityFuse', () => {
  it('detonates when inside fuse gate', () => {
    const m = makeMissile({ positionNED: [0, 0, -5000] })
    const t = makeTarget([5, 0, -5000])
    expect(checkProximityFuse(m, t)).toBe(true)
  })

  it('detonates on closest-approach when distance starts increasing inside gate', () => {
    const gate = AIM120B.proxFuseRadiusM
    const m = makeMissile({
      positionNED: [0, 0, -5000],
      prevMissDistanceM: gate - 1,
    })
    const t = makeTarget([gate + 2, 0, -5000])
    expect(checkProximityFuse(m, t)).toBe(true)
    expect(m.prevMissDistanceM).toBeGreaterThan(gate)
  })

  it('does not detonate when still closing and outside gate', () => {
    const gate = AIM120B.proxFuseRadiusM
    const m = makeMissile({
      positionNED: [0, 0, -5000],
      prevMissDistanceM: gate + 50,
    })
    const t = makeTarget([gate + 40, 0, -5000])
    expect(checkProximityFuse(m, t)).toBe(false)
    expect(m.prevMissDistanceM).toBeCloseTo(gate + 40)
  })
})

describe('Warhead.computeLethality', () => {
  const lethal = AIM120B.lethalRadiusM

  it('returns 1.0 at or inside lethal radius', () => {
    expect(computeLethality([0, 0, 0], [lethal, 0, 0], lethal)).toBe(1)
    expect(computeLethality([0, 0, 0], [0, 0, 0], lethal)).toBe(1)
  })

  it('returns 0 beyond 3x lethal radius', () => {
    expect(computeLethality([0, 0, 0], [lethal * 3 + 1, 0, 0], lethal)).toBe(0)
  })

  it('linearly falls off between lethal and 3x lethal radius', () => {
    const mid = lethal * 2
    expect(computeLethality([0, 0, 0], [mid, 0, 0], lethal)).toBeCloseTo(0.5)
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
