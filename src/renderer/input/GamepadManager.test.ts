/**
 * Controller layer: stick shaping (deadzone + expo + DOM Y flip), device
 * classification, active-pad selection, and connect/disconnect handling.
 */
import { describe, it, expect } from 'vitest'
import {
  GamepadManager,
  classifyPad,
  PAD,
  DEFAULT_GAMEPAD_AXES,
  type GamepadLike,
} from './GamepadManager'

function makePad(over: Partial<GamepadLike> = {}): GamepadLike {
  return {
    id: 'Xbox Wireless Controller',
    index: 0,
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    ...over,
  }
}

const NO_TARGET = { target: null as null }

describe('classifyPad', () => {
  it('recognises Xbox pads', () => {
    expect(classifyPad('Xbox Wireless Controller')).toBe('xbox')
    expect(classifyPad('045e-02ea-Microsoft X-Box One S pad')).toBe('xbox')
  })
  it('recognises PlayStation pads', () => {
    expect(classifyPad('DualSense Wireless Controller')).toBe('playstation')
    expect(classifyPad('054c-09cc-Sony Interactive Entertainment Wireless Controller')).toBe('playstation')
  })
  it('falls back to generic', () => {
    expect(classifyPad('Thrustmaster T.16000M')).toBe('generic')
  })
})

describe('GamepadManager.poll', () => {
  it('returns null when nothing is connected', () => {
    const gm = new GamepadManager({ getGamepads: () => [], ...NO_TARGET })
    expect(gm.poll()).toBeNull()
  })

  it('applies a radial deadzone', () => {
    const pad = makePad({ axes: [0.05, 0.05, 0, 0] })
    const gm = new GamepadManager({ getGamepads: () => [pad], ...NO_TARGET })
    const s = gm.poll()!
    expect(s.leftX).toBe(0)
    expect(s.leftY).toBe(0)
  })

  it('passes full single-axis deflection through and flips DOM Y so up is positive', () => {
    const gm = new GamepadManager({ getGamepads: () => [makePad({ axes: [1, 0, 0, 0] })], ...NO_TARGET })
    expect(gm.poll()!.leftX).toBeGreaterThan(0.9)

    const gm2 = new GamepadManager({ getGamepads: () => [makePad({ axes: [0, -1, 0, 0] })], ...NO_TARGET })
    expect(gm2.poll()!.leftY).toBeGreaterThan(0.9) // axes[1] = -1 (stick up) → leftY ≈ +1
  })

  it('clamps a full diagonal to the unit circle (round-gate stick)', () => {
    const gm = new GamepadManager({ getGamepads: () => [makePad({ axes: [1, 1, 0, 0] })], ...NO_TARGET })
    const s = gm.poll()!
    expect(Math.hypot(s.leftX, s.leftY)).toBeLessThanOrEqual(1.0001)
    expect(s.leftX).toBeGreaterThan(0.6)
  })

  it('reads analog triggers and digital buttons by index', () => {
    const buttons = makePad().buttons.map((b) => ({ ...b }))
    buttons[PAD.RT] = { pressed: true, value: 0.73 }
    buttons[PAD.A] = { pressed: true, value: 1 }
    const gm = new GamepadManager({ getGamepads: () => [makePad({ buttons })], ...NO_TARGET })
    const s = gm.poll()!
    expect(s.rightTrigger).toBeCloseTo(0.73)
    expect(s.down(PAD.A)).toBe(true)
    expect(s.down(PAD.B)).toBe(false)
  })

  it('prefers a standard-mapping pad over a non-standard one', () => {
    const hotas = makePad({ index: 0, id: 'T.16000M', mapping: '' })
    const xbox = makePad({ index: 1, id: 'Xbox Wireless Controller', mapping: 'standard' })
    const gm = new GamepadManager({ getGamepads: () => [hotas, xbox], ...NO_TARGET })
    expect(gm.poll()!.id).toBe('Xbox Wireless Controller')
  })

  it('drops the active pad when it disconnects and adopts another', () => {
    let pads: (GamepadLike | null)[] = [makePad({ index: 0, id: 'pad-A' })]
    const gm = new GamepadManager({ getGamepads: () => pads, ...NO_TARGET })
    expect(gm.poll()!.id).toBe('pad-A')

    pads = [null, makePad({ index: 1, id: 'pad-B' })]
    expect(gm.poll()!.id).toBe('pad-B')
  })
})

describe('GamepadManager expo curve', () => {
  it('a mid deflection is attenuated by the cubic term', () => {
    expect(DEFAULT_GAMEPAD_AXES.expo).toBeGreaterThan(0)
    const pad = makePad({ axes: [0, 0, 0.5, 0] })
    const gm = new GamepadManager({ getGamepads: () => [pad], ...NO_TARGET })
    const s = gm.poll()!
    // Post-deadzone input ≈ 0.43; expo pulls it below linear.
    expect(Math.abs(s.rightX)).toBeLessThan(0.43)
    expect(Math.abs(s.rightX)).toBeGreaterThan(0)
  })
})
