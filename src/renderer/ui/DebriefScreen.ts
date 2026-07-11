import type { FlightResult, MissionOutcome } from '../types/mission'

function debriefTitle(outcome: MissionOutcome): string {
  switch (outcome) {
    case 'success':
      return 'MISSION COMPLETE'
    case 'aborted':
      return 'MISSION ABORTED'
    case 'ejected':
      return 'MISSION ABORTED — EJECTED'
    case 'killed':
      return 'MISSION FAILED — AIRCRAFT DESTROYED'
    case 'failure':
      return 'MISSION FAILED'
    default:
      return 'MISSION END'
  }
}

function titleColor(outcome: MissionOutcome): string {
  switch (outcome) {
    case 'success':
      return '#00ff88'
    case 'aborted':
      return '#ffaa44'
    case 'ejected':
    case 'killed':
    case 'failure':
      return '#ff6666'
    default:
      return '#00ff88'
  }
}

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
    title.textContent = debriefTitle(stats.outcome)
    title.style.cssText = `color:${titleColor(stats.outcome)};letter-spacing:4px;font-size:20px;margin:0;text-align:center`
    this.el.appendChild(title)

    const statsEl = document.createElement('pre')
    const minutes = Math.floor(stats.flightTimeSec / 60)
    const secs    = Math.floor(stats.flightTimeSec % 60)
    const lines = [
      `Mission:       ${stats.missionName}`,
      `Flight time:   ${minutes}m ${secs.toString().padStart(2, '0')}s`,
      `Air kills:     ${stats.kills}`,
      `Ground kills:  ${stats.groundKills}`,
      `Aircraft:      ${stats.aircraftName}`,
    ]
    if (stats.objectivesTotal > 0) {
      lines.push(`Objectives:    ${stats.objectivesCompleted}/${stats.objectivesTotal}`)
    }
    statsEl.textContent = lines.join('\n')
    statsEl.style.cssText = 'border:1px solid #226644;padding:16px;line-height:1.8;min-width:280px'
    this.el.appendChild(statsEl)

    if (stats.objectiveLabels.length > 0) {
      const objEl = document.createElement('pre')
      objEl.textContent = stats.objectiveLabels.join('\n')
      objEl.style.cssText = 'border:1px solid #226644;padding:12px 16px;line-height:1.6;font-size:11px;color:#88bb88;min-width:280px'
      this.el.appendChild(objEl)
    }

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
