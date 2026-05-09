export function drawThrottleBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  throttle: number,
  abThreshold: number,
  uiScale: number,
): void {
  const barH = Math.round(80 * uiScale)
  const barW = 12
  const abActive = throttle >= abThreshold

  // THR label
  ctx.font = '10px monospace'
  ctx.fillStyle = '#226644'
  ctx.fillText('THR', x - 1, y - 4)

  // Background outline
  ctx.strokeStyle = '#226644'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, barW, barH)

  // Bar fills — bottom = 0, top = 1
  if (throttle > 0) {
    const fillH   = Math.round(barH * throttle)
    const fillTop = y + barH - fillH
    // AB threshold pixel — orange zone is above this line
    const abY     = y + Math.round(barH * (1 - abThreshold))

    if (abActive) {
      // Orange: fillTop → abY  (AB zone)
      ctx.fillStyle = '#ffaa00'
      ctx.fillRect(x, fillTop, barW, abY - fillTop)
      // Green: abY → bottom  (MIL zone)
      ctx.fillStyle = '#00ff44'
      ctx.fillRect(x, abY, barW, barH - (abY - y))
    } else {
      ctx.fillStyle = '#00ff44'
      ctx.fillRect(x, fillTop, barW, fillH)
    }
  }

  // AB threshold notch line
  const abNotchY = y + Math.round(barH * (1 - abThreshold))
  ctx.strokeStyle = '#558866'
  ctx.setLineDash([2, 2])
  ctx.beginPath()
  ctx.moveTo(x - 3, abNotchY)
  ctx.lineTo(x + barW + 3, abNotchY)
  ctx.stroke()
  ctx.setLineDash([])

  // AB label below bar
  ctx.font = abActive ? 'bold 10px monospace' : '10px monospace'
  ctx.fillStyle = abActive ? '#ffaa00' : '#226644'
  ctx.fillText('AB', x + 1, y + barH + 12)
}
