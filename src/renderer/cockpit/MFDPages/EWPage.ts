import type { RWRState } from '../../types/radar'

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

  const hasMissile = rwr.threats.some(t => t.type === 'MISSILE')
  const flash4Hz   = Math.floor(timeSec * 4) % 2 === 0

  // Title / missile alert
  if (hasMissile && flash4Hz) {
    ctx.fillStyle = '#ff0000'
    ctx.font = 'bold 11px monospace'
    ctx.fillText('◄ MSL LAUNCH ►', 4, 14)
    ctx.font = '11px monospace'
  } else {
    ctx.fillStyle = '#ff4444'
    ctx.fillText('EW / RWR', 4, 14)
  }

  // RWR azimuth ring
  const cx = w / 2, cy = h / 2 + 10
  const r  = Math.min(w, h) * 0.35
  ctx.strokeStyle = '#442222'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Inner ring
  ctx.globalAlpha = 0.4
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1

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

    if (t.type === 'MISSILE') {
      if (!flash4Hz) continue
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 12px monospace'
      ctx.fillText('M', tx - 4, ty + 4)
      if (t.distanceM !== undefined) {
        ctx.font = '9px monospace'
        ctx.fillText(`${(t.distanceM / 1000).toFixed(1)}k`, tx - 8, ty + 14)
      }
      ctx.font = '11px monospace'
    } else {
      ctx.fillStyle = t.type === 'TRACK' ? '#ff2222' : '#ffaa00'
      ctx.fillText(t.type[0]!, tx - 4, ty + 4)
    }
  }

  // CMDS status
  ctx.fillStyle = '#ff4444'
  ctx.fillText(`FLR: ${flareCount}`, 4, h - 16)
  ctx.fillText(`CHF: ${chaffCount}`, 4, h - 4)
}
