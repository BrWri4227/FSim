/**
 * Controller / gamepad support.
 *
 * Targets the W3C "standard" gamepad mapping, which Chromium (and therefore the
 * Electron renderer) reports for Xbox 360 / One / Series pads and for Sony
 * DualShock 4 / DualSense controllers. Devices that do not expose the standard
 * mapping (most HOTAS sticks) still get best-effort stick + button-by-index
 * handling — the semantic axis/button layout below simply may not line up.
 *
 * The class is dependency-injectable (`getGamepads`, `target`) so it can be
 * exercised in the node test environment, which has no `navigator`/`window`.
 */

export interface GamepadButtonLike {
  readonly pressed: boolean
  readonly value: number
}

export interface GamepadLike {
  readonly id: string
  readonly index: number
  readonly mapping: string
  readonly connected: boolean
  readonly axes: readonly number[]
  readonly buttons: readonly GamepadButtonLike[]
}

export type GamepadsProvider = () => ReadonlyArray<GamepadLike | null>

/** Standard-mapping button indices. */
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  VIEW: 8,   // Xbox "View" / PlayStation "Share|Create"
  MENU: 9,   // Xbox "Menu" / PlayStation "Options"
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  GUIDE: 16,
} as const

export type PadKind = 'xbox' | 'playstation' | 'generic'

export interface GamepadAxisConfig {
  /** Radial stick deadzone, 0..1. */
  deadzone: number
  /** Response curve, 0 = linear, 1 = fully cubic. */
  expo: number
  /** false: pull the stick back for nose-up (traditional). true: push forward. */
  invertPitch: boolean
  /** Throttle travel per second at full right-stick deflection. */
  throttleRate: number
  /** Analog-trigger press threshold, 0..1. */
  triggerThreshold: number
}

export const DEFAULT_GAMEPAD_AXES: GamepadAxisConfig = {
  deadzone: 0.12,
  expo: 0.35,
  invertPitch: false,
  throttleRate: 0.6,
  triggerThreshold: 0.4,
}

export interface PadSample {
  id: string
  kind: PadKind
  /** true when the device reports the W3C "standard" mapping. */
  standard: boolean
  /** Semantic sticks after deadzone + expo. X: right = +1. Y: up = +1. */
  leftX: number
  leftY: number
  rightX: number
  rightY: number
  /** Analog triggers, 0..1. */
  leftTrigger: number
  rightTrigger: number
  /** Digital button held state by index (see {@link PAD}). */
  down: (index: number) => boolean
  /** Analog value for a button index, 0..1 (triggers) or 0/1 (digital). */
  value: (index: number) => number
}

export function classifyPad(id: string): PadKind {
  const s = id.toLowerCase()
  if (/xbox|xinput|x-box|045e/.test(s)) return 'xbox'
  if (/dualsense|dualshock|playstation|sony|054c|wireless controller|ps[3-5]/.test(s)) return 'playstation'
  return 'generic'
}

type EventTargetLike = {
  addEventListener: (type: string, cb: (e: unknown) => void) => void
  removeEventListener: (type: string, cb: (e: unknown) => void) => void
}

export class GamepadManager {
  private readonly getGamepads: GamepadsProvider
  private readonly target?: EventTargetLike
  private cfg: GamepadAxisConfig
  private activeIndex: number | null = null

  constructor(
    opts: {
      axisConfig?: GamepadAxisConfig
      getGamepads?: GamepadsProvider
      target?: EventTargetLike | null
    } = {},
  ) {
    this.cfg = opts.axisConfig ?? DEFAULT_GAMEPAD_AXES

    if (opts.getGamepads) {
      this.getGamepads = opts.getGamepads
    } else if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      this.getGamepads = () =>
        navigator.getGamepads() as unknown as ReadonlyArray<GamepadLike | null>
    } else {
      this.getGamepads = () => []
    }

    this.target =
      opts.target === null
        ? undefined
        : (opts.target ?? (typeof window !== 'undefined' ? (window as unknown as EventTargetLike) : undefined))

    if (this.target) {
      this.target.addEventListener('gamepadconnected', this.onConnect)
      this.target.addEventListener('gamepaddisconnected', this.onDisconnect)
    }
  }

  setAxisConfig(cfg: GamepadAxisConfig): void {
    this.cfg = cfg
  }

  /** The id of the pad currently driving input, or null when none is active. */
  activePadId(): string | null {
    if (this.activeIndex === null) return null
    const gp = (this.getGamepads() ?? [])[this.activeIndex]
    return gp?.id ?? null
  }

  private onConnect = (e: unknown): void => {
    const gp = (e as { gamepad?: GamepadLike } | undefined)?.gamepad
    if (gp && this.activeIndex === null) this.activeIndex = gp.index
  }

  private onDisconnect = (e: unknown): void => {
    const gp = (e as { gamepad?: GamepadLike } | undefined)?.gamepad
    if (gp && this.activeIndex === gp.index) this.activeIndex = null
  }

  private pickPad(pads: ReadonlyArray<GamepadLike | null>): GamepadLike | null {
    if (this.activeIndex !== null) {
      const cur = pads[this.activeIndex]
      if (cur && cur.connected !== false) return cur
      this.activeIndex = null
    }
    // Adopt the first connected pad, preferring one with the standard mapping.
    let fallback: GamepadLike | null = null
    for (const p of pads) {
      if (!p || p.connected === false) continue
      if (p.mapping === 'standard') {
        this.activeIndex = p.index
        return p
      }
      if (!fallback) fallback = p
    }
    if (fallback) this.activeIndex = fallback.index
    return fallback
  }

  private applyExpo(v: number): number {
    const e = this.cfg.expo
    return (1 - e) * v + e * v * v * v
  }

  /** Radial deadzone + expo. Returns [x, y] with DOM-inverted Y flipped so up = +1. */
  private stick(x: number, y: number): [number, number] {
    const dz = this.cfg.deadzone
    const mag = Math.hypot(x, y)
    if (mag <= dz || mag === 0) return [0, 0]
    const scaled = Math.min(1, (mag - dz) / (1 - dz))
    const k = this.applyExpo(scaled) / mag
    return [x * k, -y * k]
  }

  /** Snapshot the active pad, or null when none is connected. */
  poll(): PadSample | null {
    const pads = this.getGamepads() ?? []
    const gp = this.pickPad(pads)
    if (!gp) return null

    const a = gp.axes
    const b = gp.buttons
    const [lx, ly] = this.stick(a[0] ?? 0, a[1] ?? 0)
    const [rx, ry] = this.stick(a[2] ?? 0, a[3] ?? 0)

    return {
      id: gp.id,
      kind: classifyPad(gp.id),
      standard: gp.mapping === 'standard',
      leftX: lx,
      leftY: ly,
      rightX: rx,
      rightY: ry,
      leftTrigger: b[PAD.LT]?.value ?? 0,
      rightTrigger: b[PAD.RT]?.value ?? 0,
      down: (i) => b[i]?.pressed ?? false,
      value: (i) => b[i]?.value ?? 0,
    }
  }

  dispose(): void {
    if (this.target) {
      this.target.removeEventListener('gamepadconnected', this.onConnect)
      this.target.removeEventListener('gamepaddisconnected', this.onDisconnect)
    }
  }
}
