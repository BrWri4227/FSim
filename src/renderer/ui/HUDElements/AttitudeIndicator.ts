export function drawAttitudeIndicator(ctx: CanvasRenderingContext2D, cx: number, cy: number, pitchDeg: number, rollDeg: number): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-rollDeg * Math.PI / 180)

  const pxPerDeg = 6

  // Pitch ladder
  for (let p = -40; p <= 40; p += 5) {
    if (p === 0) continue
    const y = (p - pitchDeg) * pxPerDeg
    const len = p % 10 === 0 ? 35 : 18
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.moveTo(-len, -y)
    ctx.lineTo(-5,   -y)
    ctx.moveTo(5,    -y)
    ctx.lineTo(len,  -y)
    ctx.stroke()
    if (p % 10 === 0) {
      ctx.globalAlpha = 0.9
      ctx.fillText(`${Math.abs(p)}`, len + 3, -y + 4)
      ctx.fillText(`${Math.abs(p)}`, -len - 20, -y + 4)
    }
  }
  ctx.globalAlpha = 1

  // Horizon line
  ctx.lineWidth = 2
  ctx.beginPath()
  const horizY = pitchDeg * pxPerDeg
  ctx.moveTo(-60, horizY)
  ctx.lineTo(-10, horizY)
  ctx.moveTo(10,  horizY)
  ctx.lineTo(60,  horizY)
  ctx.stroke()
  ctx.lineWidth = 1.5

  ctx.restore()
}
