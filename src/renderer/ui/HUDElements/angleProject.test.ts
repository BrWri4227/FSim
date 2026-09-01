import { describe, it, expect } from 'vitest'
import type { Vec3, Quat } from '../../types/common'
import { boresightAngles, HudProjection } from './angleProject'

const LEVEL: Quat = [1, 0, 0, 0] // wings level, nose north
const ORIGIN: Vec3 = [0, 0, 0]

describe('boresightAngles', () => {
  it('is dead ahead for a point on the nose', () => {
    const a = boresightAngles(ORIGIN, LEVEL, [10000, 0, 0])
    expect(a.ahead).toBe(true)
    expect(Math.abs(a.azDeg)).toBeLessThan(0.01)
    expect(Math.abs(a.elDeg)).toBeLessThan(0.01)
    expect(a.rangeM).toBeCloseTo(10000)
  })

  it('gives positive azimuth for a point off the right', () => {
    const a = boresightAngles(ORIGIN, LEVEL, [10000, 10000, 0])
    expect(a.azDeg).toBeCloseTo(45, 0)
  })

  it('gives positive elevation for a point above (NED down is +z)', () => {
    const a = boresightAngles(ORIGIN, LEVEL, [10000, 0, -10000])
    expect(a.elDeg).toBeCloseTo(45, 0)
  })

  it('flags points behind the wing line', () => {
    const a = boresightAngles(ORIGIN, LEVEL, [-10000, 0, 0])
    expect(a.ahead).toBe(false)
  })
})

describe('HudProjection', () => {
  const P = new HudProjection(512, 256, 13, 9)

  it('maps boresight to the texture centre', () => {
    const { x, y } = P.toPx(0, 0)
    expect(x).toBeCloseTo(256)
    expect(y).toBeCloseTo(128)
  })

  it('maps +az right and +el up', () => {
    expect(P.toPx(5, 0).x).toBeGreaterThan(256)
    expect(P.toPx(0, 5).y).toBeLessThan(128)
  })

  it('reports in/out of the glass FOV', () => {
    expect(P.inFov(10, 5)).toBe(true)
    expect(P.inFov(20, 0)).toBe(false)
    expect(P.inFov(0, 12)).toBe(false)
  })

  it('clamps an out-of-FOV point onto the glass rectangle', () => {
    const e = P.clampToEdge(40, 0)
    expect(e.x).toBeGreaterThan(256)
    expect(e.x).toBeLessThanOrEqual(256 + 13 * P.pxPerDegH + 0.01)
  })
})
