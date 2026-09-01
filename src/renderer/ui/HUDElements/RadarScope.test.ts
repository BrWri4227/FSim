import { describe, it, expect } from 'vitest'
import type { Vec3, Quat } from '../../types/common'
import { computeTrackBScope } from './RadarScope'

const IDENTITY: Quat = [1, 0, 0, 0]

describe('computeTrackBScope', () => {
  it('reports range and ~0° azimuth for a contact dead ahead (no quat)', () => {
    const r = computeTrackBScope([10000, 0, 0] as Vec3, [0, 0, 0] as Vec3)
    expect(r.rangeM).toBeCloseTo(10000)
    expect(Math.abs(r.azDeg)).toBeLessThan(0.01)
  })

  it('reports positive azimuth for a contact off the right (no quat)', () => {
    // East (+y) of us, still ahead — right side.
    const r = computeTrackBScope([10000, 4000, 0] as Vec3, [0, 0, 0] as Vec3)
    expect(r.azDeg).toBeGreaterThan(0)
    expect(r.azDeg).toBeLessThan(60)
  })

  it('matches the no-quat path when attitude is identity', () => {
    const track: Vec3 = [8000, 3000, -500]
    const own: Vec3 = [0, 0, 0]
    const a = computeTrackBScope(track, own)
    const b = computeTrackBScope(track, own, IDENTITY)
    expect(b.rangeM).toBeCloseTo(a.rangeM)
    expect(b.azDeg).toBeCloseTo(a.azDeg)
  })

  it('rotates azimuth with own heading (90° yaw puts an east contact dead ahead)', () => {
    // Quat for +90° yaw about NED down axis (z): w=cos45, z=sin45.
    const yaw90: Quat = [Math.SQRT1_2, 0, 0, Math.SQRT1_2]
    const r = computeTrackBScope([0, 10000, 0] as Vec3, [0, 0, 0] as Vec3, yaw90)
    expect(Math.abs(r.azDeg)).toBeLessThan(1)
  })
})
