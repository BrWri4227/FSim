import type { RWRState } from '../../types/radar'

export function drawEWPage(ctx: CanvasRenderingContext2D, w: number, h: number, rwr: RWRState, flareCount: number, chaffCount: number): void {
  ctx.fillStyle = '#110000'
  ctx.fillRect(0, 0, w, h)
  ctx.font = '11px monospace'

  // Title
  ctx.fillStyle = '#ff4444'
  ctx.fillText('EW / RWR', 4, 14)

  // RWR azimuth ring
  const cx = w / 2, cy = h / 2 + 10
  const r  = Math.min(w, h) * 0.35
  ctx.strokeStyle = '#442222'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Cardinal labels
  ctx.fillStyle = '#884444'
  ctx.fillText('N', cx - 4, cy - r - 4)
  ctx.fillText('S', cx - 4, cy + r + 12)
  ctx.fillText('E', cx + r + 4, cy + 4)
  ctx.fillText('W', cx - r - 14, cy + 4)

  // Threats
  for (const t of rwr.threats) {
    const azRad = (t.azimuthDeg - 90) * (Math.PI / 180)
    const tx = cx + Math.cos(azRad) * r
    const ty = cy + Math.sin(azRad) * r
    ctx.fillStyle = t.type === 'TRACK' ? '#ff2222' : '#ffaa00'
    ctx.fillText(t.type[0]!, tx - 4, ty + 4)
  }

  // CMDS status
  ctx.fillStyle = '#ff4444'
  ctx.fillText(`FLR: ${flareCount}`, 4, h - 16)
  ctx.fillText(`CHF: ${chaffCount}`, 4, h - 4)
}
