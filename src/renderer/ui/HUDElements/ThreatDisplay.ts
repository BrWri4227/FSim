import type { RWRState } from '../../types/radar'

export function drawThreatDisplay(ctx: CanvasRenderingContext2D, cx: number, cy: number, rwr: RWRState): void {
  const r = 42
  // Ring
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1

  // N label
  ctx.font = '10px monospace'
  ctx.fillText('N', cx - 4, cy - r - 3)

  for (const t of rwr.threats) {
    const azRad = (t.azimuthDeg - 90) * Math.PI / 180
    const tx = cx + Math.cos(azRad) * r
    const ty = cy + Math.sin(azRad) * r
    ctx.fillStyle = t.type === 'TRACK' ? '#ff2222' : '#ffaa00'
    ctx.fillText(t.type[0]!, tx - 4, ty + 4)
  }
  ctx.fillStyle = '#00ff44'
}
