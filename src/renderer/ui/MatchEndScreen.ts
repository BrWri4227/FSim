import type { MatchState, Team } from '../network/MultiplayerTypes'
import type { ScoreboardRow } from './HUDElements/Scoreboard'
import type { SortieStatsResult } from '../mission/SortieStats'

export interface MatchEndActions {
  onRematch: () => void
  onShuffleAndRematch: () => void
  onLeave: () => void
}

export interface MatchEndOptions {
  match: MatchState
  standings: readonly ScoreboardRow[]
  /** Local pilot's own sortie telemetry, for the personal line. */
  ownStats: SortieStatsResult | null
  /** Only the host can start the next one. */
  isHost: boolean
}

const TEAM_COLOR: Record<Team, string> = {
  BLUE: '#7ab8ff',
  RED: '#ff8080',
}

/**
 * The moment the session was missing.
 *
 * A LAN dogfight used to run until somebody quit: the server kept an
 * authoritative score and nothing ever compared it to anything, so there was no
 * point at which the match was *settled* and therefore no natural place to say
 * "again". This is that place — winner, board, MVP, and a rematch button.
 */
export class MatchEndScreen {
  private el: HTMLDivElement

  constructor(opts: MatchEndOptions, actions: MatchEndActions) {
    const { match, standings, ownStats, isHost } = opts

    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.92)',
      color: '#00ff88', fontFamily: 'monospace',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: '9200', gap: '14px',
      overflowY: 'auto', padding: '32px 16px',
    })

    const title = document.createElement('h1')
    title.textContent = match.winner ? `${match.winner} TEAM WINS` : 'DRAW'
    title.style.cssText =
      `color:${match.winner ? TEAM_COLOR[match.winner] : '#ffaa44'};letter-spacing:6px;` +
      'font-size:26px;margin:0;text-align:center'
    this.el.appendChild(title)

    const score = document.createElement('div')
    score.style.cssText = 'font-size:20px;letter-spacing:4px;display:flex;gap:14px;align-items:center'
    score.innerHTML =
      `<span style="color:${TEAM_COLOR.BLUE}">BLUE ${match.teamScores.BLUE}</span>` +
      `<span style="color:#446644">—</span>` +
      `<span style="color:${TEAM_COLOR.RED}">${match.teamScores.RED} RED</span>`
    this.el.appendChild(score)

    const mvp = pickMVP(standings)
    if (mvp) {
      const mvpEl = document.createElement('div')
      mvpEl.style.cssText = 'font-size:12px;color:#aaffcc;letter-spacing:2px'
      mvpEl.textContent = `MVP  ${mvp.name}  ${mvp.kills}/${mvp.deaths}  (${mvp.aircraft})`
      this.el.appendChild(mvpEl)
    }

    this.el.appendChild(this.board(standings))

    if (ownStats) {
      const pk = ownStats.missilesFired > 0 ? `${Math.round(ownStats.missilePk * 100)}%` : '—'
      const gunAcc = ownStats.gunRoundsFired > 0
        ? `${Math.round((ownStats.gunHits / ownStats.gunRoundsFired) * 100)}%`
        : '—'
      this.el.appendChild(this.section('YOUR MATCH', [
        `Missiles fired:  ${ownStats.missilesFired}   hits ${ownStats.missileHits}   Pk ${pk}`,
        `Gun rounds:      ${ownStats.gunRoundsFired}   hits ${ownStats.gunHits}   ${gunAcc}`,
        `Countermeasures: ${ownStats.flares} flare / ${ownStats.chaff} chaff   defeats ${ownStats.decoyDefeats}`,
        `Missiles evaded: ${ownStats.incomingMissiles}`,
      ].join('\n')))
    }

    const buttons = document.createElement('div')
    buttons.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px'
    if (isHost) {
      buttons.appendChild(this.button('REMATCH', actions.onRematch, true))
      buttons.appendChild(this.button('SHUFFLE TEAMS + REMATCH', actions.onShuffleAndRematch))
    } else {
      const waiting = document.createElement('div')
      waiting.textContent = 'Waiting for the host to start the next match…'
      waiting.style.cssText = 'font-size:11px;color:#88bb88;letter-spacing:1px'
      buttons.appendChild(waiting)
    }
    buttons.appendChild(this.button('LEAVE', actions.onLeave))
    this.el.appendChild(buttons)

    document.body.appendChild(this.el)
  }

  private board(rows: readonly ScoreboardRow[]): HTMLDivElement {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'border:1px solid #226644;padding:12px 16px;min-width:min(460px,92vw)'

    const header = document.createElement('div')
    header.style.cssText =
      'display:flex;justify-content:space-between;color:#66aa88;font-size:10px;' +
      'letter-spacing:2px;margin-bottom:6px'
    header.innerHTML = '<span>PILOT</span><span>K / D</span>'
    wrap.appendChild(header)

    // Sides first, then score inside each — the board should read as two teams.
    const sorted = [...rows].sort(
      (a, b) => a.team.localeCompare(b.team) || b.kills - a.kills || a.deaths - b.deaths,
    )
    for (const row of sorted) {
      const line = document.createElement('div')
      line.style.cssText =
        `display:flex;justify-content:space-between;gap:24px;font-size:12px;margin:3px 0;` +
        `color:${row.isLocal ? '#00ff44' : TEAM_COLOR[row.team]}`
      line.innerHTML =
        `<span>${row.team === 'BLUE' ? '◆' : '◇'} ${row.name} — ${row.aircraft}</span>` +
        `<span>${row.kills} / ${row.deaths}</span>`
      wrap.appendChild(line)
    }
    if (sorted.length === 0) {
      const empty = document.createElement('div')
      empty.textContent = 'no pilots'
      empty.style.cssText = 'font-size:11px;color:#66aa88'
      wrap.appendChild(empty)
    }
    return wrap
  }

  private section(heading: string, body: string): HTMLDivElement {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'border:1px solid #226644;padding:12px 16px;min-width:min(460px,92vw)'
    const h = document.createElement('div')
    h.textContent = heading
    h.style.cssText = 'color:#aaffcc;font-size:11px;letter-spacing:2px;margin-bottom:6px'
    const pre = document.createElement('pre')
    pre.textContent = body
    pre.style.cssText = 'margin:0;line-height:1.7;font-size:11px;color:#00ff88'
    wrap.appendChild(h)
    wrap.appendChild(pre)
    return wrap
  }

  private button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = label
    b.style.cssText =
      `padding:12px 26px;font:bold 13px monospace;background:#0a2a0a;color:#00ff88;` +
      `border:${primary ? 2 : 1}px solid #00ff88;cursor:pointer;letter-spacing:2px`
    b.onclick = onClick
    return b
  }

  dispose(): void {
    this.el.remove()
  }
}

/** Most kills, ties broken by fewer deaths. Null when nobody scored at all. */
export function pickMVP(rows: readonly ScoreboardRow[]): ScoreboardRow | null {
  let best: ScoreboardRow | null = null
  for (const row of rows) {
    if (row.kills === 0) continue
    if (!best || row.kills > best.kills || (row.kills === best.kills && row.deaths < best.deaths)) {
      best = row
    }
  }
  return best
}
