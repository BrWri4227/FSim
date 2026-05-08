import type { RWRState } from '../../types/radar'

// Real RWR display: azimuth ring with 12-o'clock = aircraft nose.
// Missiles flash at 4 Hz. A "MSL" banner appears when any missile is inbound.
export function drawThreatDisplay(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rwr: RWRState,
  timeSec: number,
): void {
  const r = 60
  const hasMissile = rwr.threats.some(t => t.type === 'MISSILE')
  const flash4Hz = Math.floor(timeSec * 4) % 2 === 0  // true/false alternating at 4 Hz

  ctx.save()
  ctx.font = '10px monospace'
  ctx.strokeStyle = '#00ff44'
  ctx.fillStyle = '#00ff44'

  // Outer ring
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Inner reference ring at 50% radius (shows closer threats)
  ctx.globalAlpha = 0.15
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
  ctx.stroke()

  ctx.globalAlpha = 1

  // Cardinal tick marks and labels
  const cardinals: [number, string][] = [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]
  ctx.fillStyle = '#00ff44'
  ctx.globalAlpha = 0.55
  for (const [deg, label] of cardinals) {
    const rad = (deg - 90) * Math.PI / 180
    // Tick mark
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(rad) * (r - 5), cy + Math.sin(rad) * (r - 5))
    ctx.lineTo(cx + Math.cos(rad) * (r + 5), cy + Math.sin(rad) * (r + 5))
    ctx.stroke()
    // Label
    ctx.fillText(label, cx + Math.cos(rad) * (r + 10) - 4, cy + Math.sin(rad) * (r + 10) + 4)
  }

  // Centre dot
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.arc(cx, cy, 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = 1

  // Threat symbols
  for (const t of rwr.threats) {
    // azimuthDeg: 0 = nose (12-o'clock), positive = clockwise
    // canvas: 0-rad = 3-o'clock, so offset by -90°
    const azRad = (t.azimuthDeg - 90) * Math.PI / 180
    const tx = cx + Math.cos(azRad) * r
    const ty = cy + Math.sin(azRad) * r

    if (t.type === 'MISSILE') {
      if (!flash4Hz) continue  // blink

      ctx.fillStyle = '#ff0000'
      ctx.strokeStyle = '#ff0000'
      ctx.font = 'bold 13px monospace'

      // Filled diamond behind the "M"
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(Math.PI / 4)
      ctx.strokeRect(-5, -5, 10, 10)
      ctx.restore()

      ctx.fillText('M', tx - 4, ty + 5)

      // Range text inside ring when close (< 10 km)
      if (t.distanceM !== undefined && t.distanceM < 10000) {
        ctx.font = '8px monospace'
        const km = (t.distanceM / 1000).toFixed(1)
        ctx.fillText(`${km}k`, tx - 8, ty + 16)
      }

      ctx.font = '10px monospace'
      ctx.fillStyle = '#00ff44'
      ctx.strokeStyle = '#00ff44'
    } else if (t.type === 'TRACK') {
      ctx.fillStyle = '#ff4444'
      ctx.font = '11px monospace'
      ctx.fillText('T', tx - 4, ty + 4)
      ctx.font = '10px monospace'
      ctx.fillStyle = '#00ff44'
    } else {
      // SEARCH
      ctx.fillStyle = '#ffaa00'
      ctx.fillText('S', tx - 4, ty + 4)
      ctx.fillStyle = '#00ff44'
    }
  }

  // ── Missile launch warning banner ──────────────────────────────────────────
  if (hasMissile && flash4Hz) {
    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = '#ff0000'
    // Banner above the ring
    ctx.fillText('◄ MSL ►', cx - 22, cy - r - 10)
    ctx.font = '10px monospace'
  }

  ctx.restore()
  ctx.fillStyle = '#00ff44'
}
