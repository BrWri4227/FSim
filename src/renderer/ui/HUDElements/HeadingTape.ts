export function drawHeadingTape(ctx: CanvasRenderingContext2D, cx: number, y: number, hdgDeg: number): void {
  const w = 260, h = 24
  const x = cx - w / 2
  ctx.strokeRect(x, y, w, h)

  const pxPerDeg = w / 60  // ±30°

  for (let d = Math.floor(hdgDeg - 30); d <= hdgDeg + 30; d++) {
    const dx = cx + (d - hdgDeg) * pxPerDeg
    if (dx < x || dx > x + w) continue
    const isMajor = d % 10 === 0
    ctx.beginPath()
    ctx.moveTo(dx, y + h)
    ctx.lineTo(dx, y + h - (isMajor ? 10 : 5))
    ctx.stroke()
    if (isMajor) {
      const label = ((d % 360) + 360) % 360
      ctx.fillText(`${Math.round(label / 10) * 10}`, dx - 8, y + 12)
    }
  }

  // Current heading caret
  ctx.fillStyle = '#00ff44'
  ctx.beginPath()
  ctx.moveTo(cx, y + h)
  ctx.lineTo(cx - 5, y + h - 8)
  ctx.lineTo(cx + 5, y + h - 8)
  ctx.closePath()
  ctx.fill()

  ctx.font = 'bold 13px monospace'
  const hdg = ((Math.round(hdgDeg) % 360) + 360) % 360
  ctx.fillText(hdg.toString().padStart(3,'0'), cx - 12, y + 14)
  ctx.font = '12px monospace'
}
