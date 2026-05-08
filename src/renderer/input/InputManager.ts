import type { ControlInputs } from '../types/aircraft'
import { DEFAULT_BINDINGS } from './ControlMapping'
import { clamp } from '../utils/MathUtils'

export class InputManager {
  private keys = new Set<string>()
  private throttle = 0.3

  private fireMissilePrev = false
  private cycleMissilePrev = false
  private radarModePrev = false

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('contextmenu', e => e.preventDefault())
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code)
    // Throttle
    if (e.code === DEFAULT_BINDINGS.throttleUp)
      this.throttle = clamp(this.throttle + 0.05, 0, 1)
    if (e.code === DEFAULT_BINDINGS.throttleDown)
      this.throttle = clamp(this.throttle - 0.05, 0, 1)
  }

  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code) }

  private axis(posCode: string, negCode: string): number {
    const pos = this.keys.has(posCode) ? 1 : 0
    const neg = this.keys.has(negCode) ? 1 : 0
    return pos - neg
  }

  getControls(): ControlInputs {
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
    }

    const fireMissile = this.keys.has(DEFAULT_BINDINGS.fireMissile)
    const cycleMissile = this.keys.has(DEFAULT_BINDINGS.cycleMissile)
    const radarMode = this.keys.has(DEFAULT_BINDINGS.radarMode)

    // Edge detection for one-shot actions
    const fireMissileEdge = fireMissile && !this.fireMissilePrev
    const cycleMissileEdge = cycleMissile && !this.cycleMissilePrev
    const radarModeEdge = radarMode && !this.radarModePrev

    this.fireMissilePrev = fireMissile
    this.cycleMissilePrev = cycleMissile
    this.radarModePrev = radarMode

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
      radarModeNext: radarModeEdge,
    }
  }

  setThrottle(v: number): void { this.throttle = clamp(v, 0, 1) }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup',   this.onKeyUp)
  }
}
