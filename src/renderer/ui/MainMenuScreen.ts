import { loadLogbook, summariseCareer } from '../persistence'

export interface MainMenuCallbacks {
  onSinglePlayer: () => void
  onMultiplayer: () => void
}

/**
 * The fork the app was missing.
 *
 * Host and join used to live two thirds of the way down the *aircraft* screen,
 * behind a mission picker whose choice most players got wrong — the warning
 * that they had selected a single-player scenario only appeared after they had
 * already connected. Deciding "alone or together" first makes everything after
 * it answerable.
 */
export class MainMenuScreen {
  private el: HTMLDivElement

  constructor(cb: MainMenuCallbacks) {
    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0',
      background: '#0a0f0a',
      color: '#00ff88', fontFamily: 'monospace',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '18px', zIndex: '8000',
      overflowY: 'auto', padding: '32px 16px',
    })

    const title = document.createElement('h1')
    title.textContent = 'FSIM'
    title.style.cssText =
      'color:#00ff88;letter-spacing:14px;font-size:clamp(28px,6vw,46px);margin:0;text-align:center'
    this.el.appendChild(title)

    const tagline = document.createElement('div')
    tagline.textContent = 'COMBAT FLIGHT'
    tagline.style.cssText = 'color:#66aa88;letter-spacing:6px;font-size:11px;margin-top:-8px'
    this.el.appendChild(tagline)

    const buttons = document.createElement('div')
    buttons.style.cssText = 'display:flex;flex-direction:column;gap:12px;margin-top:14px'
    buttons.appendChild(this.button('SINGLE PLAYER', 'Missions and free flight', cb.onSinglePlayer))
    buttons.appendChild(this.button('MULTIPLAYER', 'Host or join a LAN session', cb.onMultiplayer))
    this.el.appendChild(buttons)

    // A little continuity between sessions — the logbook already tracks this.
    const career = summariseCareer(loadLogbook())
    if (career.sorties > 0) {
      const line = document.createElement('div')
      const kd = career.deaths > 0 ? career.killDeathRatio.toFixed(2) : `${career.kills}`
      line.textContent =
        `${career.sorties} sorties · ${career.kills} air kills · K/D ${kd} · ${career.flightHours.toFixed(1)} h`
      line.style.cssText = 'font-size:11px;color:#66aa88;letter-spacing:1px;margin-top:10px'
      this.el.appendChild(line)
    }

    const versionBadge = document.createElement('div')
    versionBadge.textContent = `v${window.fsim?.version ?? 'dev'}`
    versionBadge.style.cssText =
      'position:fixed;top:10px;right:14px;font-size:11px;color:#66bb88;letter-spacing:1px;pointer-events:none'
    this.el.appendChild(versionBadge)

    document.body.appendChild(this.el)
  }

  private button(label: string, hint: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.style.cssText =
      'padding:16px 40px;font:bold 15px monospace;background:#0a2a0a;color:#00ff88;' +
      'border:2px solid #00ff88;cursor:pointer;letter-spacing:3px;min-width:min(340px,88vw);' +
      'display:flex;flex-direction:column;gap:5px;align-items:center'
    b.innerHTML =
      `<span>${label}</span>` +
      `<span style="font:11px monospace;color:#66aa88;letter-spacing:1px">${hint}</span>`
    b.onclick = onClick
    return b
  }

  dispose(): void {
    this.el.remove()
  }
}
