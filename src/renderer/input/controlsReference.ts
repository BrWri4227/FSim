/**
 * Human-readable keyboard reference, shared by the Loadout screen and the
 * in-flight Pause menu. Keep in sync with [DEFAULT_BINDINGS] in ./ControlMapping.
 */

export interface ControlGroup {
  label: string
  bindings: Array<[key: string, description: string]>
}

export const CONTROLS_REFERENCE: ControlGroup[] = [
  {
    label: 'FLIGHT',
    bindings: [
      ['W / S', 'Pitch down / up'],
      ['A / D', 'Roll left / right'],
      ['Q / E', 'Yaw left / right'],
      ['Shift', 'Throttle up'],
      ['Ctrl', 'Throttle down'],
      ['G', 'Landing gear toggle'],
      ['V', 'Flaps cycle (UP → TO → LDG)'],
      ['B', 'Wheel brakes (hold)'],
      ['X', 'Speed brake toggle'],
    ],
  },
  {
    label: 'WEAPONS',
    bindings: [
      ['Space', 'Fire gun'],
      ['F', 'Fire missile'],
      ['C', 'Cycle missile'],
    ],
  },
  {
    label: 'COUNTERMEASURES',
    bindings: [
      ['Z', 'Dispense countermeasures (flare + chaff)'],
    ],
  },
  {
    label: 'RADAR / AVIONICS',
    bindings: [
      ['R', 'Radar mode cycle'],
      ['T', 'Radar select next track'],
      ['L', 'Lock selected target (STT)'],
      ['U', 'Unlock STT'],
      ['P / O / K', 'TGP power / lock / unlock'],
    ],
  },
  {
    label: 'MISC',
    bindings: [
      ['Tab', 'Toggle cockpit / external camera'],
      ['F1 / F2', 'Cycle left / right MFD page'],
      ['F12', 'Toggle debug overlay'],
      ['Esc', 'Pause menu'],
      ['` (backtick)', 'Eject'],
    ],
  },
  {
    label: 'CONTROLLER (Xbox / PlayStation)',
    bindings: [
      ['Left stick', 'Roll / pitch'],
      ['Right stick', 'Yaw (X) · throttle (push up / pull down)'],
      ['RT / LT', 'Fire gun / fire missile'],
      ['RB / LB', 'Cycle missile / countermeasures'],
      ['A / B / X / Y', 'Gear / speed brake / flaps / wheel brakes'],
      ['D-pad', 'Radar mode · select · unlock · lock'],
      ['L3 / R3', 'TGP power / TGP lock'],
      ['View / Menu', 'Camera toggle / pause'],
      ['Mouse (right-drag)', 'Cockpit freelook'],
    ],
  },
]

/** Build the controls-reference grid as a detached element. */
export function renderControlsReference(): HTMLElement {
  const grid = document.createElement('div')
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:12px'

  for (const group of CONTROLS_REFERENCE) {
    const col = document.createElement('div')
    col.style.cssText = 'font-size:11px'
    col.innerHTML =
      `<div style="color:#aaffcc;margin-bottom:4px;letter-spacing:1px">${group.label}</div>` +
      group.bindings
        .map(
          ([key, desc]) =>
            `<div style="display:flex;justify-content:space-between;gap:8px;margin:2px 0">` +
            `<span style="color:#00ff88;min-width:100px">${key}</span>` +
            `<span style="color:#88bb88">${desc}</span></div>`
        )
        .join('')
    grid.appendChild(col)
  }
  return grid
}
