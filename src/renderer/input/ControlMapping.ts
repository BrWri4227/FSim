import { PAD } from './GamepadManager'

export interface KeyBindings {
  pitchUp:    string
  pitchDown:  string
  rollLeft:   string
  rollRight:  string
  yawLeft:    string
  yawRight:   string
  throttleUp: string
  throttleDown: string
  fireGun:    string
  fireMissile: string
  cycleMissile: string
  flare:      string
  chaff:      string
  gear:       string
  flaps:      string
  brake:      string
  speedBrake: string
  radarAirGround: string
  radarSelectNext: string
  radarLockTarget: string
  radarUnlock: string
  lookBack:   string
  padlock:    string
  eject:      string
  tgpToggle:  string
  tgpLock:    string
  tgpUnlock:  string
  wingmanEngage: string
  wingmanCover:  string
  wingmanRTB:    string
  wingmanRejoin: string
}

export const DEFAULT_BINDINGS: KeyBindings = {
  pitchUp:      'KeyS',
  pitchDown:    'KeyW',
  rollLeft:     'KeyA',
  rollRight:    'KeyD',
  yawLeft:      'KeyQ',
  yawRight:     'KeyE',
  throttleUp:   'ShiftLeft',
  throttleDown: 'ControlLeft',
  fireGun:      'Space',
  fireMissile:  'KeyF',
  cycleMissile: 'KeyC',
  flare:        'KeyZ',
  // Separate from flares on purpose: an IR shot and a radar shot want different
  // decoys, and sharing one key meant defending one always spent both.
  chaff:        'KeyH',
  gear:         'KeyG',
  flaps:        'KeyV',
  brake:        'KeyB',
  speedBrake:   'KeyX',
  radarAirGround: 'KeyR',
  radarSelectNext: 'KeyT',
  radarLockTarget: 'KeyL',
  radarUnlock:  'KeyU',
  lookBack:     'KeyJ',
  padlock:      'KeyM',
  eject:        'Backquote',
  tgpToggle:    'KeyP',
  tgpLock:      'KeyO',
  tgpUnlock:    'KeyK',
  wingmanEngage: 'Digit1',
  wingmanCover:  'Digit2',
  wingmanRTB:    'Digit3',
  wingmanRejoin: 'Digit4',
}

/**
 * Controller button map, keyed to the W3C "standard" gamepad layout shared by
 * Xbox and PlayStation pads. Sticks and triggers are handled as analog axes in
 * {@link ../input/GamepadManager}:
 *   - Left stick   → roll (X) / pitch (Y)
 *   - Right stick  → yaw (X) / throttle (Y, push up for more thrust)
 * Actions with no controller binding (wingman calls, TGP unlock, eject,
 * look-back, padlock) stay keyboard-only by design — the standard layout has no
 * free buttons left. `countermeasures` still dispenses flares *and* chaff on the
 * pad for the same reason, though the keyboard now separates them.
 */
export interface GamepadBindings {
  fireGun: number
  fireMissile: number
  cycleMissile: number
  countermeasures: number
  toggleGear: number
  speedBrake: number
  cycleFlaps: number
  wheelBrake: number
  radarAirGround: number
  radarSelectNext: number
  radarUnlock: number
  radarLockTarget: number
  tgpToggle: number
  tgpLock: number
  cameraToggle: number
  pause: number
}

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  fireGun:         PAD.RT,
  fireMissile:     PAD.LT,
  cycleMissile:    PAD.RB,
  countermeasures: PAD.LB,
  toggleGear:      PAD.A,
  speedBrake:      PAD.B,
  cycleFlaps:      PAD.X,
  wheelBrake:      PAD.Y,
  radarAirGround:  PAD.DPAD_UP,
  radarSelectNext: PAD.DPAD_DOWN,
  radarUnlock:     PAD.DPAD_LEFT,
  radarLockTarget: PAD.DPAD_RIGHT,
  tgpToggle:       PAD.L3,
  tgpLock:         PAD.R3,
  cameraToggle:    PAD.VIEW,
  pause:           PAD.MENU,
}
