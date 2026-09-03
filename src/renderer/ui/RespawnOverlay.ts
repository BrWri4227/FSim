import type { ScoreboardRow } from './HUDElements/Scoreboard'

export interface RespawnOverlayOptions {
  /** Display name of whoever shot us, or null for terrain / a stall / eject. */
  killerName: string | null
  outcome: 'killed' | 'ejected'
  delaySec: number
  getStandings: () => readonly ScoreboardRow[]
}

/**
 * In-flight "you died" card for multiplayer. The session stays alive behind it;
 * Esc still opens the pause menu so ABORT TO DEBRIEF remains the way out.
 */
export class RespawnOverlay {
  private el: HTMLDivElement
  private countdownEl: HTMLDivElement
  private standingsEl: HTMLDivElement
  private remainSec: number
  private timer: ReturnType<typeof setInterval> | null = null
  private getStandings: () => readonly ScoreboardRow[]

  constructor(opts: RespawnOverlayOptions) {
    this.remainSec = opts.delaySec
    this.getStandings = opts.getStandings

    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.55)',
      color: '#00ff88',
      fontFamily: 'monospace',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9000',
      gap: '12px',
      pointerEvents: 'none',
    })

    const title = document.createElement('div')
    title.textContent = opts.outcome === 'ejected' ? 'EJECTED' : 'SHOT DOWN'
    title.style.cssText = 'color:#ff4444;letter-spacing:8px;font-size:28px;font-weight:bold'
    this.el.appendChild(title)

    const byline = document.createElement('div')
    byline.textContent = opts.killerName
      ? `BY  ${opts.killerName}`
      : opts.outcome === 'ejected'
        ? 'BAILOUT'
        : 'DESTROYED'
    byline.style.cssText = 'color:#ffaa44;font-size:14px;letter-spacing:3px'
    this.el.appendChild(byline)

    this.countdownEl = document.createElement('div')
    this.countdownEl.style.cssText = 'color:#00ff88;font-size:18px;letter-spacing:2px;margin-top:8px'
    this.el.appendChild(this.countdownEl)

    this.standingsEl = document.createElement('div')
    this.standingsEl.style.cssText =
      'margin-top:18px;border:1px solid #226644;padding:12px 18px;min-width:280px;background:#060d06'
    this.el.appendChild(this.standingsEl)

    const hint = document.createElement('div')
    hint.textContent = 'Esc — pause / abort to debrief'
    hint.style.cssText = 'color:#66aa88;font-size:10px;letter-spacing:1px;margin-top:8px'
    this.el.appendChild(hint)

    this.refresh()
    this.timer = setInterval(() => {
      this.remainSec = Math.max(0, this.remainSec - 0.1)
      this.refresh()
    }, 100)

    document.body.appendChild(this.el)
  }

  private refresh(): void {
    this.countdownEl.textContent = `RESPAWN IN  ${Math.ceil(this.remainSec)}`
    const rows = [...this.getStandings()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    if (rows.length === 0) {
      this.standingsEl.textContent = 'no scores yet'
      return
    }
    this.standingsEl.innerHTML = rows
      .map(r => {
        const color = r.isLocal ? '#00ff44' : '#88bb88'
        return (
          `<div style="display:flex;justify-content:space-between;gap:24px;color:${color};font-size:12px;margin:3px 0">` +
          `<span>${r.name}</span><span>${r.kills} / ${r.deaths}</span></div>`
        )
      })
      .join('')
  }

  dispose(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.el.remove()
  }
}
