import type { ControlInputs } from '../types/aircraft'
import { DEFAULT_BINDINGS } from './ControlMapping'
import { clamp } from '../utils/MathUtils'

export interface InputOptions {
  /** Flip the pitch axis for players who expect pull-back-to-climb on W. */
  invertPitch?: boolean
}

export class InputManager {
  private keys = new Set<string>()
  private throttle = 0.3
  private opts: InputOptions

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

  private onContextMenu = (e: Event): void => { e.preventDefault() }

  constructor(opts: InputOptions = {}) {
    this.opts = opts
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('contextmenu', this.onContextMenu)
  }

  setInvertPitch(invert: boolean): void { this.opts.invertPitch = invert }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyR')) e.preventDefault()
    this.keys.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code) }

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

  getControls(dt: number): ControlInputs {
    const gp = navigator.getGamepads()[0]

    // Keyboard axes are read unconditionally. Chromium exposes a gamepad as soon
    // as it sees one input event from it, so branching on mere presence meant a
    // controller sitting on the desk permanently killed W/A/S/D/Q/E.
    let pitch = this.axis(DEFAULT_BINDINGS.pitchUp, DEFAULT_BINDINGS.pitchDown)
    let roll  = this.axis(DEFAULT_BINDINGS.rollRight, DEFAULT_BINDINGS.rollLeft)
    let yaw   = this.axis(DEFAULT_BINDINGS.yawRight, DEFAULT_BINDINGS.yawLeft)

    if (gp) {
      // Standard layout: left stick = roll/pitch, right stick X = yaw.
      // Deadzone first, so stick drift can never beat a deliberate keypress below.
      const padRoll  = this.applyAxisDeadzone(gp.axes[0] ?? 0, 0.08)
      const padPitch = this.applyAxisDeadzone(-(gp.axes[1] ?? 0), 0.08)
      const padYaw   = this.applyAxisDeadzone(gp.axes[2] ?? 0, 0.10)
      // Per axis, whichever device is deflected further wins.
      if (Math.abs(padPitch) > Math.abs(pitch)) pitch = padPitch
      if (Math.abs(padRoll)  > Math.abs(roll))  roll  = padRoll
      if (Math.abs(padYaw)   > Math.abs(yaw))   yaw   = padYaw
    }

    // Throttle keys stay live regardless of pad presence; the triggers add to them.
    if (this.keys.has(DEFAULT_BINDINGS.throttleUp))
      this.throttle = clamp(this.throttle + 0.25 * dt, 0, 1)
    if (this.keys.has(DEFAULT_BINDINGS.throttleDown) && this.throttle > 0)
      this.throttle = clamp(this.throttle - 0.25 * dt, 0, 1)
    if (gp) {
      const rtrigger = gp.buttons[7]?.value ?? 0
      const ltrigger = gp.buttons[6]?.value ?? 0
      if (rtrigger > 0.05 || ltrigger > 0.05)
        this.throttle = clamp(this.throttle + (rtrigger - ltrigger) * 0.02, 0, 1)
    }

    if (this.opts.invertPitch) pitch = -pitch

    // Minimum viable pad weapon bindings so a stick user is not locked out of
    // fighting. Full mapping is deferred. RB rather than RT for the gun, because
    // the triggers are the throttle.
    const padFireGun  = (gp?.buttons[5]?.pressed ?? false)
    const padFireMsl  = (gp?.buttons[0]?.pressed ?? false)
    const padDecoy    = (gp?.buttons[1]?.pressed ?? false)

    const fireMissile = this.keys.has(DEFAULT_BINDINGS.fireMissile) || padFireMsl
    const cycleMissile = this.keys.has(DEFAULT_BINDINGS.cycleMissile)
    const gear = this.keys.has(DEFAULT_BINDINGS.gear)
    const flaps = this.keys.has(DEFAULT_BINDINGS.flaps)
    const radarMode = this.keys.has(DEFAULT_BINDINGS.radarMode)
    const radarSelect = this.keys.has(DEFAULT_BINDINGS.radarSelectNext)
    const radarLock = this.keys.has(DEFAULT_BINDINGS.radarLockTarget)
    const radarUnlock = this.keys.has(DEFAULT_BINDINGS.radarUnlock)
    const tgpToggle = this.keys.has(DEFAULT_BINDINGS.tgpToggle)
    const tgpLock = this.keys.has(DEFAULT_BINDINGS.tgpLock)
    const tgpUnlock = this.keys.has(DEFAULT_BINDINGS.tgpUnlock)
    const speedBrake = this.keys.has(DEFAULT_BINDINGS.speedBrake)
    const wmEngage = this.keys.has(DEFAULT_BINDINGS.wingmanEngage)
    const wmCover = this.keys.has(DEFAULT_BINDINGS.wingmanCover)
    const wmRtb = this.keys.has(DEFAULT_BINDINGS.wingmanRTB)
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
      fireGun: this.keys.has(DEFAULT_BINDINGS.fireGun) || padFireGun,
      fireMissile: fireMissileEdge,
      cycleMissile: cycleMissileEdge,
      dispenseFlare: this.keys.has(DEFAULT_BINDINGS.flare) || padDecoy,
      dispenseChaff: this.keys.has(DEFAULT_BINDINGS.chaff) || padDecoy,
      toggleGear: gearEdge,
      cycleFlaps: flapsEdge,
      brakeHeld: this.keys.has(DEFAULT_BINDINGS.brake),
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

  setThrottle(v: number): void { this.throttle = clamp(v, 0, 1) }

  dispose(): void {
    window.removeEventListener('keydown',      this.onKeyDown)
    window.removeEventListener('keyup',        this.onKeyUp)
    window.removeEventListener('contextmenu',  this.onContextMenu)
  }
}
