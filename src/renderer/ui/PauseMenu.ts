import { renderControlsReference } from '../input/controlsReference'

export interface PauseMenuCallbacks {
  onResume: () => void
  onRestart: () => void
  onAbort: () => void
  /** 0..1. Applied live and persisted by the session. */
  onVolumeChange: (volume: number) => void
}

export interface PauseMenuOptions {
  /** LAN session — the sim keeps running behind the overlay, so warn the pilot. */
  multiplayer: boolean
  masterVolume: number
}

/**
 * In-flight pause overlay. In single-player [FlightSession] freezes the sim while
 * this is up; in multiplayer it is a non-freezing overlay (the session is live).
 */
export class PauseMenu {
  private el: HTMLDivElement
  private controlsPanel: HTMLDivElement
  private controlsVisible = false

  constructor(opts: PauseMenuOptions, cb: PauseMenuCallbacks) {
    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.72)',
      color: '#00ff88', fontFamily: 'monospace',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: '9500', gap: '14px',
    })

    const title = document.createElement('h1')
    title.textContent = 'PAUSED'
    title.style.cssText = 'color:#00ff88;letter-spacing:6px;font-size:22px;margin:0'
    this.el.appendChild(title)

    if (opts.multiplayer) {
      const warn = document.createElement('div')
      warn.textContent = 'MULTIPLAYER — SESSION STILL LIVE, YOUR AIRCRAFT KEEPS FLYING'
      warn.style.cssText = 'color:#ffaa44;font-size:11px;letter-spacing:1px;text-align:center;max-width:420px'
      this.el.appendChild(warn)
    }

    const mkBtn = (label: string, onClick: () => void, disabled = false): HTMLButtonElement => {
      const b = document.createElement('button')
      b.textContent = label
      b.disabled = disabled
      b.style.cssText =
        `padding:11px 40px;font:bold 13px monospace;background:#0a2a0a;color:${disabled ? '#446644' : '#00ff88'};` +
        `border:2px solid ${disabled ? '#245024' : '#00ff88'};cursor:${disabled ? 'default' : 'pointer'};` +
        'letter-spacing:2px;min-width:240px'
      if (!disabled) b.onclick = onClick
      return b
    }

    this.el.appendChild(mkBtn('RESUME', cb.onResume))
    this.el.appendChild(
      mkBtn('RESTART MISSION', cb.onRestart, opts.multiplayer)
    )
    const ctrlBtn = mkBtn('CONTROLS', () => this.toggleControls())
    this.el.appendChild(ctrlBtn)
    this.el.appendChild(mkBtn('ABORT TO DEBRIEF', cb.onAbort))

    // Mid-session volume control — otherwise the only way to turn the game down
    // is to quit to the loadout screen or mute the whole app at the OS level.
    const volRow = document.createElement('div')
    volRow.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:240px;margin-top:4px'
    const volLbl = document.createElement('span')
    volLbl.textContent = 'VOLUME'
    volLbl.style.cssText = 'font-size:11px;color:#88bb88;letter-spacing:1px'
    const volSlider = document.createElement('input')
    volSlider.type = 'range'
    volSlider.min = '0'
    volSlider.max = '100'
    volSlider.step = '1'
    volSlider.value = String(Math.round(opts.masterVolume * 100))
    volSlider.style.cssText = 'flex:1;accent-color:#00ff88'
    const volReadout = document.createElement('span')
    volReadout.textContent = `${Math.round(opts.masterVolume * 100)}%`
    volReadout.style.cssText = 'font-size:11px;color:#00ff88;min-width:38px;text-align:right'
    volSlider.oninput = () => {
      volReadout.textContent = `${volSlider.value}%`
      cb.onVolumeChange(Number(volSlider.value) / 100)
    }
    volRow.appendChild(volLbl)
    volRow.appendChild(volSlider)
    volRow.appendChild(volReadout)
    this.el.appendChild(volRow)

    this.controlsPanel = document.createElement('div')
    this.controlsPanel.style.cssText =
      'display:none;border:1px solid #226644;padding:14px;max-width:760px;width:90vw;' +
      'max-height:46vh;overflow:auto;background:#060d06'
    this.controlsPanel.appendChild(renderControlsReference())
    this.el.appendChild(this.controlsPanel)

    const hint = document.createElement('div')
    hint.textContent = 'Esc — resume'
    hint.style.cssText = 'color:#66aa88;font-size:10px;letter-spacing:1px'
    this.el.appendChild(hint)

    document.body.appendChild(this.el)
  }

  private toggleControls(): void {
    this.controlsVisible = !this.controlsVisible
    this.controlsPanel.style.display = this.controlsVisible ? 'block' : 'none'
  }

  dispose(): void {
    this.el.remove()
  }
}
