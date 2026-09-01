import { describe, it, expect } from 'vitest'
import type { Vec3 } from '../../types/common'
import {
  computeRelativeKinematics,
  resolveShootCue,
  isShootCue,
  formatAspect,
  type ShootCueLAR,
} from './TargetGeometry'

const ORIGIN: Vec3 = [0, 0, 0]

describe('computeRelativeKinematics', () => {
  it('reports closing when the target flies toward us', () => {
    // Target 10 km north, heading south at 300 m/s. We are stationary.
    const k = computeRelativeKinematics(ORIGIN, ORIGIN, [10000, 0, 0], [-300, 0, 0])
    expect(k.rangeM).toBeCloseTo(10000)
    expect(k.closureMps).toBeCloseTo(300)
  })

  it('reports opening (negative closure) when the target runs away', () => {
    const k = computeRelativeKinematics(ORIGIN, ORIGIN, [10000, 0, 0], [300, 0, 0])
    expect(k.closureMps).toBeCloseTo(-300)
  })

  it('gives ~0° aspect on a pure tail chase', () => {
    // Target ahead of us, both heading north. We are on its 6.
    const k = computeRelativeKinematics(ORIGIN, [250, 0, 0], [5000, 0, 0], [250, 0, 0])
    expect(k.aspectDeg).toBeLessThan(1)
    expect(k.aspectSide).toBe('')
  })

  it('gives ~180° aspect head-on', () => {
    const k = computeRelativeKinematics(ORIGIN, [250, 0, 0], [5000, 0, 0], [-250, 0, 0])
    expect(k.aspectDeg).toBeGreaterThan(179)
  })

  it('gives ~90° aspect when we are abeam the target and reports a side', () => {
    // Target north of us, heading east — we are off its right side (its 3-9 line).
    const k = computeRelativeKinematics(ORIGIN, ORIGIN, [5000, 0, 0], [0, 250, 0])
    expect(k.aspectDeg).toBeCloseTo(90, 0)
    expect(k.aspectSide === 'L' || k.aspectSide === 'R').toBe(true)
  })

  it('flips the aspect side with the target heading', () => {
    const right = computeRelativeKinematics(ORIGIN, ORIGIN, [5000, 0, 0], [0, 250, 0])
    const left = computeRelativeKinematics(ORIGIN, ORIGIN, [5000, 0, 0], [0, -250, 0])
    expect(right.aspectSide).not.toBe(left.aspectSide)
  })

  it('computes altitude delta (target above own is positive)', () => {
    // NED down is +z, so altitude = -z.
    const k = computeRelativeKinematics([0, 0, -1000], ORIGIN, [5000, 0, -3000], ORIGIN)
    expect(k.altDeltaM).toBeCloseTo(2000)
  })
})

describe('resolveShootCue', () => {
  const lar = (over: Partial<ShootCueLAR>): ShootCueLAR => ({
    rangeM: 15000,
    rMinM: 2000,
    rMaxM: 40000,
    inRange: true,
    inNoEscapeZone: false,
    ...over,
  })

  it('is NONE without a selected missile', () => {
    expect(resolveShootCue({ hasMissileSelected: false, lar: lar({}), offBoresightDeg: 0, seekerLimitDeg: 30 })).toBe('NONE')
  })

  it('is NONE beyond Rmax', () => {
    expect(resolveShootCue({ hasMissileSelected: true, lar: lar({ rangeM: 50000 }), offBoresightDeg: 0, seekerLimitDeg: 30 })).toBe('NONE')
  })

  it('is TOO_CLOSE inside Rmin', () => {
    expect(resolveShootCue({ hasMissileSelected: true, lar: lar({ rangeM: 1000 }), offBoresightDeg: 0, seekerLimitDeg: 30 })).toBe('TOO_CLOSE')
  })

  it('is IN_RNG when in the envelope but off the seeker cone', () => {
    expect(resolveShootCue({ hasMissileSelected: true, lar: lar({}), offBoresightDeg: 45, seekerLimitDeg: 30 })).toBe('IN_RNG')
  })

  it('is IN_RNG when there is no launch solution', () => {
    expect(resolveShootCue({ hasMissileSelected: true, lar: lar({}), offBoresightDeg: null, seekerLimitDeg: 30 })).toBe('IN_RNG')
  })

  it('is SHOOT with a good solution outside the NEZ', () => {
    expect(resolveShootCue({ hasMissileSelected: true, lar: lar({}), offBoresightDeg: 10, seekerLimitDeg: 30 })).toBe('SHOOT')
  })

  it('is SHOOT_NEZ with a good solution inside the NEZ', () => {
    expect(resolveShootCue({ hasMissileSelected: true, lar: lar({ inNoEscapeZone: true }), offBoresightDeg: 10, seekerLimitDeg: 30 })).toBe('SHOOT_NEZ')
  })

  it('isShootCue only accepts the SHOOT states', () => {
    expect(isShootCue('SHOOT')).toBe(true)
    expect(isShootCue('SHOOT_NEZ')).toBe(true)
    expect(isShootCue('IN_RNG')).toBe(false)
    expect(isShootCue('NONE')).toBe(false)
  })
})

describe('formatAspect', () => {
  it('zero-pads and appends the side', () => {
    expect(formatAspect({ aspectDeg: 75, aspectSide: 'R' } as ReturnType<typeof computeRelativeKinematics>)).toBe('075R')
    expect(formatAspect({ aspectDeg: 120, aspectSide: 'L' } as ReturnType<typeof computeRelativeKinematics>)).toBe('120L')
  })
})
