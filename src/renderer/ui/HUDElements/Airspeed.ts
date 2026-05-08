import { msToKts } from '../../utils/Units'

export function drawAirspeed(ctx: CanvasRenderingContext2D, x: number, cy: number, iasMs: number): void {
  const kts = Math.round(msToKts(iasMs))
  const h = 120, tickH = 8

  ctx.strokeRect(x, cy - h / 2, 44, h)

  // Ticks every 10 kts, visible ±100 kts from current
  for (let v = kts - 100; v <= kts + 100; v += 10) {
    const dy = (kts - v) / 100 * (h / 2)
    if (Math.abs(dy) > h / 2) continue
    const isMajor = v % 50 === 0
    ctx.beginPath()
    ctx.moveTo(x + 44, cy + dy)
    ctx.lineTo(x + 44 - (isMajor ? tickH : tickH / 2), cy + dy)
    ctx.stroke()
    if (isMajor) ctx.fillText(`${v}`, x + 2, cy + dy + 4)
  }

  // Current speed box
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x - 2, cy - 10, 48, 20)
  ctx.fillStyle = '#00ff44'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(`${kts}`, x + 2, cy + 5)
  ctx.font = '12px monospace'
}
