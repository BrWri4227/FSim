/**
 * InputManager controller integration: stick → control axes, right-stick throttle,
 * one-shot button edges, and the paused-safe frame actions (View / Menu).
 */
import { describe, it, expect } from 'vitest'
import { InputManager } from './InputManager'
import { GamepadManager, PAD, type GamepadLike } from './GamepadManager'
import { DEFAULT_GAMEPAD_BINDINGS as GB } from './ControlMapping'

const DT = 1 / 60

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

function press(indices: number[], axes = [0, 0, 0, 0]): GamepadLike {
  const buttons = makePad().buttons.map((b) => ({ ...b }))
  for (const i of indices) buttons[i] = { pressed: true, value: 1 }
  return makePad({ axes, buttons })
}

function harness(getPad: () => GamepadLike | null) {
  const gm = new GamepadManager({ getGamepads: () => [getPad()], target: null })
  const im = new InputManager({ gamepad: gm })
  return im
}

describe('InputManager — no controller', () => {
  it('reports a neutral frame from a fresh manager', () => {
    const im = new InputManager({ gamepad: new GamepadManager({ getGamepads: () => [], target: null }) })
    im.beginFrame()
    const c = im.getControls(DT)
    expect(c.pitch).toBe(0)
    expect(c.roll).toBe(0)
    expect(c.throttle).toBeCloseTo(0.3)
    expect(im.hasGamepad()).toBe(false)
  })
})

describe('InputManager — controller axes', () => {
  it('maps the left stick to roll (X) and pitch (Y, pull back = nose up)', () => {
    const roll = harness(() => makePad({ axes: [1, 0, 0, 0] }))
    roll.beginFrame()
    expect(roll.getControls(DT).roll).toBeGreaterThan(0.9)
    expect(roll.hasGamepad()).toBe(true)

    const pitch = harness(() => makePad({ axes: [0, 1, 0, 0] })) // stick pulled back
    pitch.beginFrame()
    expect(pitch.getControls(DT).pitch).toBeGreaterThan(0.9)
  })

  it('maps the right stick X to yaw', () => {
    const im = harness(() => makePad({ axes: [0, 0, -1, 0] }))
    im.beginFrame()
    expect(im.getControls(DT).yaw).toBeLessThan(-0.9)
  })

  it('raises throttle while the right stick is held up and lowers it when held down', () => {
    let axes = [0, 0, 0, -1] // right stick up
    const im = harness(() => makePad({ axes }))
    for (let i = 0; i < 120; i++) { im.beginFrame(); im.getControls(DT) }
    const up = im.getControls(DT).throttle
    expect(up).toBeGreaterThan(0.3)

    axes = [0, 0, 0, 1] // right stick down
    for (let i = 0; i < 240; i++) { im.beginFrame(); im.getControls(DT) }
    expect(im.getControls(DT).throttle).toBeLessThan(up)
  })
})

describe('InputManager — controller buttons', () => {
  it('fires the gun while the right trigger is held', () => {
    const im = harness(() => press([GB.fireGun]))
    im.beginFrame()
    expect(im.getControls(DT).fireGun).toBe(true)
  })

  it('emits a single edge for cycle-missile no matter how long the button is held', () => {
    const im = harness(() => press([GB.cycleMissile]))
    im.beginFrame()
    expect(im.getControls(DT).cycleMissile).toBe(true)
    im.beginFrame()
    expect(im.getControls(DT).cycleMissile).toBe(false)
  })

  it('routes the D-pad to radar actions', () => {
    const im = harness(() => press([GB.radarLockTarget]))
    im.beginFrame()
    expect(im.getControls(DT).radarLockTarget).toBe(true)
  })

  it('holds the wheel brake while the face button is down', () => {
    const im = harness(() => press([GB.wheelBrake]))
    im.beginFrame()
    expect(im.getControls(DT).brakeHeld).toBe(true)
  })
})

describe('InputManager — frame actions (work while paused)', () => {
  it('emits one camera-toggle edge per View press', () => {
    let down = false
    const im = harness(() => (down ? press([PAD.VIEW]) : makePad()))
    im.beginFrame()
    expect(im.getFrameActions().cameraToggle).toBe(false)

    down = true
    im.beginFrame()
    expect(im.getFrameActions().cameraToggle).toBe(true)
    im.beginFrame()
    expect(im.getFrameActions().cameraToggle).toBe(false)
  })

  it('emits a pause edge on the Menu button', () => {
    const im = harness(() => press([PAD.MENU]))
    im.beginFrame()
    expect(im.getFrameActions().pauseToggle).toBe(true)
  })
})
