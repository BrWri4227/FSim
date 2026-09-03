import type { ControlInputs } from '../types/aircraft'
import { DEFAULT_BINDINGS, DEFAULT_GAMEPAD_BINDINGS, type GamepadBindings } from './ControlMapping'
import {
  GamepadManager,
  DEFAULT_GAMEPAD_AXES,
  type GamepadAxisConfig,
  type PadSample,
} from './GamepadManager'
import { clamp } from '../utils/MathUtils'

/**
 * Merges keyboard and controller input into a single {@link ControlInputs} frame.
 *
 * Keyboard and gamepad are always live at the same time: a held key overrides the
 * corresponding stick axis, and any button action fires if *either* the key or
 * the pad button is down. Camera-toggle and pause are surfaced separately through
 * {@link getFrameActions} so they keep working while the sim loop is paused.
 */
export class InputManager {
  private keys = new Set<string>()
  private throttle = 0.3

  private readonly pad: GamepadManager
  private readonly gpAxis: GamepadAxisConfig
  private readonly gpBind: GamepadBindings
  private lastPad: PadSample | null = null

  private fireMissilePrev = false
  private cycleMissilePrev = false
  private gearPrev = false
  private flapsPrev = false
  private radarModePrev = false
  private radarSelectPrev = false
  private radarLockPrev = false
  private radarUnlockPrev = false
  private speedBrakePrev = false
  private tgpTogglePrev = false
  private tgpLockPrev = false
  private tgpUnlockPrev = false
  private wmEngagePrev = false
  private wmCoverPrev = false
  private wmRtbPrev = false
  private wmRejoinPrev = false

  private cameraTogglePrev = false
  private pausePrev = false

  private onContextMenu = (e: Event): void => { e.preventDefault() }

  constructor(opts: {
    gamepad?: GamepadManager
    gamepadAxes?: GamepadAxisConfig
    gamepadBindings?: GamepadBindings
  } = {}) {
    this.gpAxis = opts.gamepadAxes ?? DEFAULT_GAMEPAD_AXES
    this.gpBind = opts.gamepadBindings ?? DEFAULT_GAMEPAD_BINDINGS
    this.pad = opts.gamepad ?? new GamepadManager({ axisConfig: this.gpAxis })

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown)
      window.addEventListener('keyup', this.onKeyUp)
      window.addEventListener('contextmenu', this.onContextMenu)
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyR')) e.preventDefault()
    this.keys.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code) }

  /**
   * Poll the controller once per rendered frame. Must be called before
   * {@link getControls} / {@link getFrameActions} and also while paused so the
   * Menu button can resume the sim.
   */
  beginFrame(): void {
    this.lastPad = this.pad.poll()
  }

  /** True when a controller is currently driving input. */
  hasGamepad(): boolean { return this.lastPad !== null }

  private axis(posCode: string, negCode: string): number {
    const pos = this.keys.has(posCode) ? 1 : 0
    const neg = this.keys.has(negCode) ? 1 : 0
    return pos - neg
  }

  private applyAxisDeadzone(v: number, deadzone: number): number {
    const av = Math.abs(v)
    if (av <= deadzone) return 0
    const scaled = (av - deadzone) / (1 - deadzone)
    return Math.sign(v) * scaled
  }

  /** A gamepad button/trigger counts as held once past the trigger threshold. */
  private padDown(index: number): boolean {
    const p = this.lastPad
    if (!p) return false
    return p.down(index) || p.value(index) >= this.gpAxis.triggerThreshold
  }

  getControls(dt: number): ControlInputs {
    const pad = this.lastPad
    let pitch = 0, roll = 0, yaw = 0

    const kPitch = this.axis(DEFAULT_BINDINGS.pitchUp, DEFAULT_BINDINGS.pitchDown)
    const kRoll  = this.axis(DEFAULT_BINDINGS.rollRight, DEFAULT_BINDINGS.rollLeft)
    const kYaw   = this.axis(DEFAULT_BINDINGS.yawRight, DEFAULT_BINDINGS.yawLeft)

    if (pad) {
      // Left stick → roll / pitch, right stick → yaw / throttle.
      roll  = pad.leftX
      pitch = this.gpAxis.invertPitch ? pad.leftY : -pad.leftY
      yaw   = pad.rightX
      // Right stick Y is already flipped so up = +1 → push up for more thrust.
      this.throttle = clamp(
        this.throttle + pad.rightY * this.gpAxis.throttleRate * dt,
        0, 1,
      )
      // A held key always wins over the stick for that axis.
      if (kPitch !== 0) pitch = kPitch
      if (kRoll  !== 0) roll  = kRoll
      if (kYaw   !== 0) yaw   = kYaw
    } else {
      pitch = kPitch
      roll  = kRoll
      yaw   = kYaw
    }

    if (this.keys.has(DEFAULT_BINDINGS.throttleUp))
      this.throttle = clamp(this.throttle + 0.25 * dt, 0, 1)
    if (this.keys.has(DEFAULT_BINDINGS.throttleDown) && this.throttle > 0)
      this.throttle = clamp(this.throttle - 0.25 * dt, 0, 1)

    const gb = this.gpBind
    const fireGun      = this.keys.has(DEFAULT_BINDINGS.fireGun)      || this.padDown(gb.fireGun)
    const fireMissile  = this.keys.has(DEFAULT_BINDINGS.fireMissile)  || this.padDown(gb.fireMissile)
    const cycleMissile = this.keys.has(DEFAULT_BINDINGS.cycleMissile) || this.padDown(gb.cycleMissile)
    const countermeasures = this.keys.has(DEFAULT_BINDINGS.flare)
      || this.keys.has(DEFAULT_BINDINGS.chaff) || this.padDown(gb.countermeasures)
    const gear        = this.keys.has(DEFAULT_BINDINGS.gear)            || this.padDown(gb.toggleGear)
    const flaps       = this.keys.has(DEFAULT_BINDINGS.flaps)           || this.padDown(gb.cycleFlaps)
    const radarMode   = this.keys.has(DEFAULT_BINDINGS.radarMode)       || this.padDown(gb.radarModeNext)
    const radarSelect = this.keys.has(DEFAULT_BINDINGS.radarSelectNext) || this.padDown(gb.radarSelectNext)
    const radarLock   = this.keys.has(DEFAULT_BINDINGS.radarLockTarget) || this.padDown(gb.radarLockTarget)
    const radarUnlock = this.keys.has(DEFAULT_BINDINGS.radarUnlock)     || this.padDown(gb.radarUnlock)
    const tgpToggle   = this.keys.has(DEFAULT_BINDINGS.tgpToggle)       || this.padDown(gb.tgpToggle)
    const tgpLock     = this.keys.has(DEFAULT_BINDINGS.tgpLock)         || this.padDown(gb.tgpLock)
    const tgpUnlock   = this.keys.has(DEFAULT_BINDINGS.tgpUnlock)
    const speedBrake  = this.keys.has(DEFAULT_BINDINGS.speedBrake)      || this.padDown(gb.speedBrake)
    const brakeHeld   = this.keys.has(DEFAULT_BINDINGS.brake)           || this.padDown(gb.wheelBrake)
    const wmEngage = this.keys.has(DEFAULT_BINDINGS.wingmanEngage)
    const wmCover  = this.keys.has(DEFAULT_BINDINGS.wingmanCover)
    const wmRtb    = this.keys.has(DEFAULT_BINDINGS.wingmanRTB)
    const wmRejoin = this.keys.has(DEFAULT_BINDINGS.wingmanRejoin)

    // Edge detection for one-shot actions
    const fireMissileEdge = fireMissile && !this.fireMissilePrev
    const cycleMissileEdge = cycleMissile && !this.cycleMissilePrev
    const gearEdge = gear && !this.gearPrev
    const flapsEdge = flaps && !this.flapsPrev
    const radarModeEdge = radarMode && !this.radarModePrev
    const radarSelectEdge = radarSelect && !this.radarSelectPrev
    const radarLockEdge = radarLock && !this.radarLockPrev
    const radarUnlockEdge = radarUnlock && !this.radarUnlockPrev
    const tgpToggleEdge = tgpToggle && !this.tgpTogglePrev
    const tgpLockEdge = tgpLock && !this.tgpLockPrev
    const tgpUnlockEdge = tgpUnlock && !this.tgpUnlockPrev
    const speedBrakeToggle = speedBrake && !this.speedBrakePrev
    const wmEngageEdge = wmEngage && !this.wmEngagePrev
    const wmCoverEdge = wmCover && !this.wmCoverPrev
    const wmRtbEdge = wmRtb && !this.wmRtbPrev
    const wmRejoinEdge = wmRejoin && !this.wmRejoinPrev

    this.fireMissilePrev = fireMissile
    this.cycleMissilePrev = cycleMissile
    this.gearPrev = gear
    this.flapsPrev = flaps
    this.radarModePrev = radarMode
    this.radarSelectPrev = radarSelect
    this.radarLockPrev = radarLock
    this.radarUnlockPrev = radarUnlock
    this.tgpTogglePrev = tgpToggle
    this.tgpLockPrev = tgpLock
    this.tgpUnlockPrev = tgpUnlock
    this.speedBrakePrev = speedBrake
    this.wmEngagePrev = wmEngage
    this.wmCoverPrev = wmCover
    this.wmRtbPrev = wmRtb
    this.wmRejoinPrev = wmRejoin

    return {
      pitch,
      roll,
      yaw,
      throttle: this.throttle,
      fireGun,
      fireMissile: fireMissileEdge,
      cycleMissile: cycleMissileEdge,
      dispenseFlare: countermeasures,
      dispenseChaff: countermeasures,
      toggleGear: gearEdge,
      cycleFlaps: flapsEdge,
      brakeHeld,
      speedBrakeToggle,
      radarModeNext: radarModeEdge,
      radarSelectNext: radarSelectEdge,
      radarLockTarget: radarLockEdge,
      radarUnlock: radarUnlockEdge,
      ejectRequested: this.keys.has(DEFAULT_BINDINGS.eject),
      tgpToggle: tgpToggleEdge,
      tgpLock: tgpLockEdge,
      tgpUnlock: tgpUnlockEdge,
      wingmanEngage: wmEngageEdge,
      wingmanCover: wmCoverEdge,
      wingmanRTB: wmRtbEdge,
      wingmanRejoin: wmRejoinEdge,
    }
  }

  /**
   * One-shot navigation actions that must work even while the sim loop is paused
   * (so they are polled every frame from the render loop, not per fixed tick).
   * The keyboard equivalents (Tab, Esc) are still handled by their own listeners.
   */
  getFrameActions(): { cameraToggle: boolean; pauseToggle: boolean } {
    const cameraDown = this.padDown(this.gpBind.cameraToggle)
    const pauseDown = this.padDown(this.gpBind.pause)
    const cameraToggle = cameraDown && !this.cameraTogglePrev
    const pauseToggle = pauseDown && !this.pausePrev
    this.cameraTogglePrev = cameraDown
    this.pausePrev = pauseDown
    return { cameraToggle, pauseToggle }
  }

  setThrottle(v: number): void { this.throttle = clamp(v, 0, 1) }

  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown',      this.onKeyDown)
      window.removeEventListener('keyup',        this.onKeyUp)
      window.removeEventListener('contextmenu',  this.onContextMenu)
    }
    this.pad.dispose()
  }
}
