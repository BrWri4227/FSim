import type { FlightResult } from '../App'

export class DebriefScreen {
  private el: HTMLDivElement

  constructor(
    _container: HTMLElement,
    stats: FlightResult,
    onRestart: () => void,
    options?: { primaryButtonLabel?: string }
  ) {
    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.9)',
      color: '#00ff88', fontFamily: 'monospace',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: '9000', gap: '16px'
    })

    const title = document.createElement('h1')
    title.textContent = stats.deaths > 0 ? 'MISSION ABORTED — EJECTED' : 'MISSION COMPLETE'
    title.style.cssText = 'color:#00ff88;letter-spacing:4px;font-size:20px;margin:0'
    this.el.appendChild(title)

    const statsEl = document.createElement('pre')
    const minutes = Math.floor(stats.flightTimeSec / 60)
    const secs    = Math.floor(stats.flightTimeSec % 60)
    statsEl.textContent = [
      `Flight time:   ${minutes}m ${secs.toString().padStart(2,'0')}s`,
      `Kills:         ${stats.kills}`,
      `Aircraft:      ${stats.aircraftName}`,
    ].join('\n')
    statsEl.style.cssText = 'border:1px solid #226644;padding:16px;line-height:1.8'
    this.el.appendChild(statsEl)

    const btn = document.createElement('button')
    btn.textContent = options?.primaryButtonLabel ?? 'RETURN TO LOADOUT'
    btn.style.cssText = 'padding:12px 40px;font:bold 14px monospace;background:#0a2a0a;color:#00ff88;border:2px solid #00ff88;cursor:pointer;letter-spacing:2px'
    btn.onclick = () => {
      onRestart()
    }
    this.el.appendChild(btn)

    document.body.appendChild(this.el)
  }

  dispose(): void {
    this.el.remove()
  }
}
