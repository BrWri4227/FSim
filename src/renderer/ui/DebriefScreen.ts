import type { FlightResult, MissionOutcome } from '../types/mission'
import { loadLogbook, summariseCareer } from '../persistence'
import { mToFt } from '../utils/Units'

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

function landingGrade(sinkMS: number): string {
  if (sinkMS < 1.5) return 'A — greaser'
  if (sinkMS < 3) return 'B — firm'
  if (sinkMS < 5) return 'C — hard'
  return 'D — carrier arrival'
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
      zIndex: '9000', gap: '14px',
      overflowY: 'auto', padding: '32px 16px',
    })

    const title = document.createElement('h1')
    title.textContent = debriefTitle(stats.outcome)
    title.style.cssText = `color:${titleColor(stats.outcome)};letter-spacing:4px;font-size:20px;margin:0;text-align:center`
    this.el.appendChild(title)

    const minutes = Math.floor(stats.flightTimeSec / 60)
    const secs = Math.floor(stats.flightTimeSec % 60)
    const summaryLines = [
      `Mission:       ${stats.missionName}`,
      `Flight time:   ${minutes}m ${secs.toString().padStart(2, '0')}s`,
      `Air kills:     ${stats.kills}`,
      `Ground kills:  ${stats.groundKills}`,
      `Aircraft:      ${stats.aircraftName}`,
    ]
    if (stats.objectivesTotal > 0) {
      summaryLines.push(`Objectives:    ${stats.objectivesCompleted}/${stats.objectivesTotal}`)
    }
    this.el.appendChild(this.panel(summaryLines.join('\n')))

    if (stats.objectiveLabels.length > 0) {
      this.el.appendChild(this.panel(stats.objectiveLabels.join('\n'), { small: true, color: '#88bb88' }))
    }

    const s = stats.stats
    if (s) {
      const pk = s.missilesFired > 0 ? `${Math.round(s.missilePk * 100)}%` : '—'
      const ttk = s.timeToFirstKillSec !== null ? `${Math.round(s.timeToFirstKillSec)}s` : '—'
      this.el.appendChild(this.section('COMBAT', [
        `Missiles fired:   ${s.missilesFired}   hits ${s.missileHits}   Pk ${pk}`,
        `Gun rounds:       ${s.gunRoundsFired}   hits ${s.gunHits}`,
        `Countermeasures:  ${s.flares} flare / ${s.chaff} chaff   defeats ${s.decoyDefeats}`,
        `Missiles evaded:  ${s.incomingMissiles}`,
        `Time to 1st kill: ${ttk}`,
      ].join('\n')))

      this.el.appendChild(this.section('FLIGHT ENVELOPE', [
        `Max G:     ${s.maxG.toFixed(1)}`,
        `Max Mach:  ${s.maxMach.toFixed(2)}`,
        `Top speed: ${Math.round(s.topSpeedKts)} kts IAS`,
        `Min AGL:   ${Math.round(mToFt(s.minAglM))} ft`,
      ].join('\n')))
    }

    if (stats.landing) {
      this.el.appendChild(this.section('LANDING', [
        `Touchdown sink: ${Math.round(mToFt(stats.landing.sinkMS) * 60)} ft/min`,
        `Gear:           ${stats.landing.gearIntact ? 'intact' : 'COLLAPSED'}`,
        `Grade:          ${landingGrade(stats.landing.sinkMS)}`,
      ].join('\n')))
    }

    const career = summariseCareer(loadLogbook())
    if (career.sorties > 0) {
      const kd = career.deaths > 0 ? career.killDeathRatio.toFixed(2) : `${career.kills}`
      this.el.appendChild(this.section('CAREER', [
        `Sorties: ${career.sorties}   wins ${career.wins}`,
        `Kills:   ${career.kills} air / ${career.groundKills} ground   deaths ${career.deaths}   K/D ${kd}`,
        `Flight hours: ${career.flightHours.toFixed(1)}`,
        career.bestLandingSinkMS !== null
          ? `Best landing: ${Math.round(mToFt(career.bestLandingSinkMS) * 60)} ft/min`
          : `Best landing: —`,
      ].join('\n'), '#88bb88'))
    }

    const btn = document.createElement('button')
    btn.textContent = options?.primaryButtonLabel ?? 'RETURN TO LOADOUT'
    btn.style.cssText = 'padding:12px 40px;font:bold 14px monospace;background:#0a2a0a;color:#00ff88;border:2px solid #00ff88;cursor:pointer;letter-spacing:2px;margin-top:4px'
    btn.onclick = () => {
      onRestart()
    }
    this.el.appendChild(btn)

    document.body.appendChild(this.el)
  }

  private panel(text: string, opts?: { small?: boolean; color?: string }): HTMLPreElement {
    const el = document.createElement('pre')
    el.textContent = text
    el.style.cssText =
      `border:1px solid #226644;padding:${opts?.small ? '10px 14px' : '14px 16px'};` +
      `line-height:1.7;min-width:min(320px,90vw);font-size:${opts?.small ? '11px' : '12px'};` +
      `color:${opts?.color ?? '#00ff88'};margin:0`
    return el
  }

  private section(heading: string, body: string, color = '#00ff88'): HTMLDivElement {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'border:1px solid #226644;padding:12px 16px;min-width:min(360px,90vw)'
    const h = document.createElement('div')
    h.textContent = heading
    h.style.cssText = 'color:#aaffcc;font-size:11px;letter-spacing:2px;margin-bottom:6px'
    const pre = document.createElement('pre')
    pre.textContent = body
    pre.style.cssText = `margin:0;line-height:1.7;font-size:11px;color:${color}`
    wrap.appendChild(h)
    wrap.appendChild(pre)
    return wrap
  }

  dispose(): void {
    this.el.remove()
  }
}
