import { describe, it, expect } from 'vitest'
import { clamp, lerp, wrapAngle180, wrapAngle360, v3add, v3sub, v3dot, v3len } from './MathUtils'

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })
  it('clamps to lower bound', () => {
    expect(clamp(-1, 0, 1)).toBe(0)
  })
  it('clamps to upper bound', () => {
    expect(clamp(2, 0, 1)).toBe(1)
  })
})

describe('lerp', () => {
  it('returns start at t=0', () => expect(lerp(0, 10, 0)).toBe(0))
  it('returns end at t=1', () => expect(lerp(0, 10, 1)).toBe(10))
  it('interpolates at t=0.5', () => expect(lerp(0, 10, 0.5)).toBe(5))
})

describe('wrapAngle180', () => {
  it('wraps 270 to -90', () => expect(wrapAngle180(270)).toBeCloseTo(-90))
  it('wraps -270 to 90', () => expect(wrapAngle180(-270)).toBeCloseTo(90))
  it('leaves 90 unchanged', () => expect(wrapAngle180(90)).toBe(90))
})

describe('wrapAngle360', () => {
  it('wraps -90 to 270', () => expect(wrapAngle360(-90)).toBeCloseTo(270))
  it('wraps 370 to 10', () => expect(wrapAngle360(370)).toBeCloseTo(10))
})

describe('v3 operations', () => {
  it('v3add', () => expect(v3add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]))
  it('v3sub', () => expect(v3sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]))
  it('v3dot', () => expect(v3dot([1, 0, 0], [0, 1, 0])).toBe(0))
  it('v3len of unit vector', () => expect(v3len([1, 0, 0])).toBeCloseTo(1))
  it('v3len', () => expect(v3len([3, 4, 0])).toBeCloseTo(5))
})
