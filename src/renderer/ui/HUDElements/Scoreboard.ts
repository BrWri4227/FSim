import type { Team } from '../../network/MultiplayerTypes'

export interface ScoreboardRow {
  playerId: string
  name: string
  aircraft: string
  kills: number
  deaths: number
  isLocal: boolean
  team: Team
}

/** Row colours by side, so the board reads as two teams rather than a list. */
const TEAM_COLOR: Record<Team, string> = {
  BLUE: '#7ab8ff',
  RED: '#ff8080',
}

/**
 * Held-key standings overlay. Tab is the camera toggle, so this is bound to N.
 * Sorted by kills so the person winning is always at the top.
 */
export function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  rows: readonly ScoreboardRow[],
  uiScale: number,
): void {
  const fontPx = Math.round(12 * uiScale)
  const headerPx = Math.round(11 * uiScale)
  const lineH = Math.round(18 * uiScale)
  const panelW = Math.round(420 * uiScale)
  const pad = Math.round(12 * uiScale)
  const headerH = Math.round(28 * uiScale)
  const panelH = headerH + pad + Math.max(1, rows.length) * lineH + pad

  const x = Math.round(cx - panelW / 2)
  const y = topY

  ctx.save()
  ctx.fillStyle = 'rgba(0, 12, 6, 0.82)'
  ctx.fillRect(x, y, panelW, panelH)
  ctx.strokeStyle = '#00ff44'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, panelW, panelH)

  ctx.font = `bold ${headerPx}px monospace`
  ctx.fillStyle = '#aaffcc'
  ctx.textAlign = 'left'
  ctx.fillText('STANDINGS  (hold N)', x + pad, y + headerPx + 8)

  ctx.font = `${fontPx}px monospace`
  ctx.fillStyle = '#66aa88'
  const colK = x + panelW - pad - Math.round(90 * uiScale)
  const colD = x + panelW - pad
  ctx.textAlign = 'left'
  ctx.fillText('PILOT', x + pad, y + headerH + fontPx)
  ctx.textAlign = 'right'
  ctx.fillText('K', colK, y + headerH + fontPx)
  ctx.fillText('D', colD, y + headerH + fontPx)

  // Grouped by side first, then by score, so the board reads as two teams.
  const sorted = [...rows].sort(
    (a, b) =>
      a.team.localeCompare(b.team) || b.kills - a.kills || a.deaths - b.deaths,
  )
  sorted.forEach((row, i) => {
    const rowY = y + headerH + lineH + i * lineH + fontPx
    ctx.fillStyle = row.isLocal ? '#00ff44' : TEAM_COLOR[row.team]
    ctx.textAlign = 'left'
    const label = `${row.team === 'BLUE' ? '◆' : '◇'} ${row.name}  ${row.aircraft}`
    ctx.fillText(label, x + pad, rowY)
    ctx.textAlign = 'right'
    ctx.fillText(String(row.kills), colK, rowY)
    ctx.fillText(String(row.deaths), colD, rowY)
  })

  if (sorted.length === 0) {
    ctx.fillStyle = '#66aa88'
    ctx.textAlign = 'left'
    ctx.fillText('waiting for players…', x + pad, y + headerH + lineH + fontPx)
  }

  ctx.restore()
}
