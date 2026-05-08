import type { ControlInputs } from '../types/aircraft'
import { DEFAULT_BINDINGS } from './ControlMapping'
import { clamp } from '../utils/MathUtils'

export class InputManager {
  private keys = new Set<string>()
  private throttle = 0.3

  private fireMissilePrev = false
  private cycleMissilePrev = false
  private gearPrev = false
  private flapsPrev = false
  private radarModePrev = false
  private radarSelectPrev = false
  private radarLockPrev = false
  private radarUnlockPrev = false
  private speedBrakeTogglePending = false

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('contextmenu', e => e.preventDefault())
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyR')) e.preventDefault()
    this.keys.add(e.code)
    if (e.code === DEFAULT_BINDINGS.throttleDown && this.throttle === 0)
      this.speedBrakeTogglePending = true
  }

  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code) }

  private axis(posCode: string, negCode: string): number {
    const pos = this.keys.has(posCode) ? 1 : 0
    const neg = this.keys.has(negCode) ? 1 : 0
    return pos - neg
  }

  getControls(dt: number): ControlInputs {
    // Gamepad support
    const gp = navigator.getGamepads()[0]
    let pitch = 0, roll = 0, yaw = 0

    if (gp) {
      // Standard gamepad layout: left stick = roll/pitch, triggers = throttle
      roll  = gp.axes[0] ?? 0
      pitch = -(gp.axes[1] ?? 0)
      yaw   = gp.axes[2] ?? 0
      const rtrigger = ((gp.buttons[7]?.value ?? 0))
      const ltrigger = ((gp.buttons[6]?.value ?? 0))
      this.throttle = clamp(this.throttle + (rtrigger - ltrigger) * 0.02, 0, 1)
    } else {
      pitch = this.axis(DEFAULT_BINDINGS.pitchUp, DEFAULT_BINDINGS.pitchDown)
      roll  = this.axis(DEFAULT_BINDINGS.rollRight, DEFAULT_BINDINGS.rollLeft)
      yaw   = this.axis(DEFAULT_BINDINGS.yawRight, DEFAULT_BINDINGS.yawLeft)
      if (this.keys.has(DEFAULT_BINDINGS.throttleUp))
        this.throttle = clamp(this.throttle + 0.25 * dt, 0, 1)
      if (this.keys.has(DEFAULT_BINDINGS.throttleDown) && this.throttle > 0)
        this.throttle = clamp(this.throttle - 0.25 * dt, 0, 1)
    }

    const fireMissile = this.keys.has(DEFAULT_BINDINGS.fireMissile)
    const cycleMissile = this.keys.has(DEFAULT_BINDINGS.cycleMissile)
    const gear = this.keys.has(DEFAULT_BINDINGS.gear)
    const flaps = this.keys.has(DEFAULT_BINDINGS.flaps)
    const radarMode = this.keys.has(DEFAULT_BINDINGS.radarMode)
    const radarSelect = this.keys.has(DEFAULT_BINDINGS.radarSelectNext)
    const radarLock = this.keys.has(DEFAULT_BINDINGS.radarLockTarget)
    const radarUnlock = this.keys.has(DEFAULT_BINDINGS.radarUnlock)

    // Edge detection for one-shot actions
    const fireMissileEdge = fireMissile && !this.fireMissilePrev
    const cycleMissileEdge = cycleMissile && !this.cycleMissilePrev
    const gearEdge = gear && !this.gearPrev
    const flapsEdge = flaps && !this.flapsPrev
    const radarModeEdge = radarMode && !this.radarModePrev
    const radarSelectEdge = radarSelect && !this.radarSelectPrev
    const radarLockEdge = radarLock && !this.radarLockPrev
    const radarUnlockEdge = radarUnlock && !this.radarUnlockPrev

    this.fireMissilePrev = fireMissile
    this.cycleMissilePrev = cycleMissile
    this.gearPrev = gear
    this.flapsPrev = flaps
    this.radarModePrev = radarMode
    this.radarSelectPrev = radarSelect
    this.radarLockPrev = radarLock
    this.radarUnlockPrev = radarUnlock

    ;(window as unknown as Record<string, unknown>)['_fsimEjectPressed'] = this.keys.has(DEFAULT_BINDINGS.eject)

    const speedBrakeToggle = this.speedBrakeTogglePending
    this.speedBrakeTogglePending = false

    return {
      pitch,
      roll,
      yaw,
      throttle: this.throttle,
      fireGun: this.keys.has(DEFAULT_BINDINGS.fireGun),
      fireMissile: fireMissileEdge,
      cycleMissile: cycleMissileEdge,
      dispenseFlare: this.keys.has(DEFAULT_BINDINGS.flare),
      dispenseChaff: this.keys.has(DEFAULT_BINDINGS.chaff),
      toggleGear: gearEdge,
      cycleFlaps: flapsEdge,
      brakeHeld: this.keys.has(DEFAULT_BINDINGS.brake),
      speedBrakeToggle,
      radarModeNext: radarModeEdge,
      radarSelectNext: radarSelectEdge,
      radarLockTarget: radarLockEdge,
      radarUnlock: radarUnlockEdge,
    }
  }

  setThrottle(v: number): void { this.throttle = clamp(v, 0, 1) }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup',   this.onKeyUp)
  }
}
