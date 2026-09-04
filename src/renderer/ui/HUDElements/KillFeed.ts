export interface KillFeedEntry {
  /** Display name of the pilot who died. */
  victim: string
  /** Display name of the killer, or null for terrain / a stall / an eject. */
  killer: string | null
  /** True if the local player got this kill — highlighted. */
  ownKill: boolean
  /** True if the local player was the victim. */
  ownDeath: boolean
  /** Seconds remaining before the line disappears. */
  remainSec: number
}

export const KILL_FEED_LINE_SEC = 6
export const KILL_FEED_MAX_LINES = 4

const OWN_KILL = '#00ff44'
const OWN_DEATH = '#ff2020'
const NEUTRAL = '#aaccbb'

/**
 * Recent kills, newest at the top, right-aligned.
 *
 * Drawn below the targeting-pod FLIR overlay's maximum extent rather than in
 * the top-right corner: the FLIR is 180 * uiScale square at the right edge and
 * is painted after this, so anything up there vanishes the moment a player
 * turns on the pod.
 */
export function drawKillFeed(
  ctx: CanvasRenderingContext2D,
  rightX: number,
  topY: number,
  entries: readonly KillFeedEntry[],
  uiScale: number,
): void {
  if (entries.length === 0) return

  const lineH = Math.round(14 * uiScale)
  const fontPx = Math.round(11 * uiScale)

  ctx.save()
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${fontPx}px monospace`

  entries.slice(0, KILL_FEED_MAX_LINES).forEach((e, i) => {
    // Fade over the last second so lines leave without popping.
    ctx.globalAlpha = Math.min(1, e.remainSec)
    ctx.fillStyle = e.ownKill ? OWN_KILL : e.ownDeath ? OWN_DEATH : NEUTRAL
    const text = e.killer ? `${e.killer}  ✕  ${e.victim}` : `${e.victim}  went down`
    ctx.fillText(text, rightX, topY + i * lineH + fontPx)
  })

  ctx.restore()
}
