import type { RWRState } from '../../types/radar'
import { drawThreatDisplay, createRWRDisplayState, type RWRDisplayState } from '../../ui/HUDElements/ThreatDisplay'

const rwrDisplayState: RWRDisplayState = createRWRDisplayState()

export function drawEWPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rwr: RWRState,
  flareCount: number,
  chaffCount: number,
  timeSec = 0,
): void {
  ctx.fillStyle = '#110000'
  ctx.fillRect(0, 0, w, h)
  ctx.font = '11px monospace'
  ctx.fillStyle = '#ff4444'
  ctx.fillText('EW / RWR', 4, 14)

  // Shared HUD threat ring — nose/tail ref, lethality radius, priority highlight.
  drawThreatDisplay(ctx, w / 2, h / 2 + 8, rwr, timeSec, rwrDisplayState)

  // CMDS status
  ctx.fillStyle = '#ff4444'
  ctx.font = '11px monospace'
  ctx.fillText(`FLR: ${flareCount}`, 4, h - 16)
  ctx.fillText(`CHF: ${chaffCount}`, 4, h - 4)
}
