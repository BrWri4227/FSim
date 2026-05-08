import { mToFt } from '../../utils/Units'

export function drawAltimeter(ctx: CanvasRenderingContext2D, x: number, cy: number, altM: number): void {
  const ft = Math.round(mToFt(altM))
  const h = 120, tickH = 8

  ctx.strokeRect(x, cy - h / 2, 44, h)

  for (let v = ft - 2000; v <= ft + 2000; v += 200) {
    const dy = (ft - v) / 2000 * (h / 2)
    if (Math.abs(dy) > h / 2) continue
    const isMajor = v % 1000 === 0
    ctx.beginPath()
    ctx.moveTo(x, cy + dy)
    ctx.lineTo(x + (isMajor ? tickH : tickH / 2), cy + dy)
    ctx.stroke()
    if (isMajor) ctx.fillText(`${Math.round(v / 100) * 100}`, x + tickH + 1, cy + dy + 4)
  }

  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x - 2, cy - 10, 48, 20)
  ctx.fillStyle = '#00ff44'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(`${ft}`, x + 1, cy + 5)
  ctx.font = '12px monospace'
}
