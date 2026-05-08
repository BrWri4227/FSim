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
  radarMode:  string
  eject:      string
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
  chaff:        'KeyX',
  radarMode:    'KeyR',
  eject:        'Backquote',
}
