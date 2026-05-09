export function drawFuelGauge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fuelKg: number,
  fuelCapacityKg: number,
  uiScale: number,
): void {
  const barH = Math.round(80 * uiScale)
  const barW = 12
  const fraction = Math.max(0, Math.min(1, fuelKg / fuelCapacityKg))

  const color = fraction < 0.1 ? '#ff2020' : fraction < 0.25 ? '#ffaa00' : '#00ff44'

  // FUEL label
  ctx.font = '10px monospace'
  ctx.fillStyle = '#226644'
  ctx.fillText('FUEL', x - 4, y - 4)

  // Background outline
  ctx.strokeStyle = '#226644'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, barW, barH)

  // Fill
  if (fraction > 0) {
    const fillH = Math.round(barH * fraction)
    ctx.fillStyle = color
    ctx.fillRect(x, y + barH - fillH, barW, fillH)
  }

  // Warning markers at 25% and 10%
  for (const pct of [0.25, 0.10]) {
    const markerY = y + Math.round(barH * (1 - pct))
    ctx.strokeStyle = pct === 0.10 ? '#ff2020' : '#ffaa00'
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(x - 3, markerY)
    ctx.lineTo(x + barW + 3, markerY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // kg readout below bar
  const pct = Math.round(fraction * 100)
  ctx.font = '10px monospace'
  ctx.fillStyle = color
  ctx.fillText(`${pct}%`, x - 1, y + barH + 12)
}
