import { describe, it, expect } from 'vitest'
import { interp1D, interp2D } from './TableLookup'

describe('interp1D', () => {
  const xs = [0, 1, 2]
  const ys = [0, 10, 20]

  it('clamps below range', () => expect(interp1D(xs, ys, -1)).toBe(0))
  it('clamps above range', () => expect(interp1D(xs, ys, 3)).toBe(20))
  it('returns exact breakpoint', () => expect(interp1D(xs, ys, 1)).toBeCloseTo(10))
  it('interpolates between breakpoints', () => expect(interp1D(xs, ys, 0.5)).toBeCloseTo(5))
  it('interpolates upper segment', () => expect(interp1D(xs, ys, 1.5)).toBeCloseTo(15))
})

describe('interp2D', () => {
  const xs = [0, 1]
  const ys = [0, 1]
  // table[x][y]
  const table = [[0, 1], [2, 3]]

  it('returns corner values', () => {
    expect(interp2D(xs, ys, table, 0, 0)).toBeCloseTo(0)
    expect(interp2D(xs, ys, table, 0, 1)).toBeCloseTo(1)
    expect(interp2D(xs, ys, table, 1, 0)).toBeCloseTo(2)
    expect(interp2D(xs, ys, table, 1, 1)).toBeCloseTo(3)
  })
  it('interpolates centre', () => expect(interp2D(xs, ys, table, 0.5, 0.5)).toBeCloseTo(1.5))
})
