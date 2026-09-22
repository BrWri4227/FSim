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
      ['Z', 'Flares — defeat an IR missile'],
      ['H', 'Chaff — defeat a radar missile'],
    ],
  },
  {
    label: 'RADAR / AVIONICS',
    bindings: [
      ['R', 'Radar air ⇄ ground search'],
      ['T', 'Radar select next track'],
      ['L', 'Lock selected target (STT)'],
      ['U', 'Unlock STT'],
      ['P / O / K', 'TGP power / lock / unlock'],
    ],
  },
  {
    label: 'VIEW',
    bindings: [
      ['Tab', 'Toggle cockpit / external camera'],
      ['J (hold)', 'Look back over your shoulder'],
      ['M', 'Padlock the locked bandit'],
      ['Right-drag', 'Free look'],
    ],
  },
  {
    label: 'WINGMEN',
    bindings: [
      ['1', 'Engage — attack your target'],
      ['2', 'Cover me'],
      ['3', 'Return to base'],
      ['4', 'Rejoin formation'],
    ],
  },
  {
    label: 'MISC',
    bindings: [
      ['N (hold)', 'Scoreboard'],
      ['F1 / F2', 'Cycle left / right MFD page'],
      ['F11', 'Toggle fullscreen'],
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
      ['D-pad', 'Radar air/ground · select · unlock · lock'],
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
