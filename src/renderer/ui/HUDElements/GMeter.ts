export function drawGMeter(ctx: CanvasRenderingContext2D, x: number, y: number, gCurrent: number, gMax: number): void {
  ctx.fillStyle = gCurrent > 7 ? '#ff4444' : gCurrent < -2 ? '#ff8888' : '#00ff44'
  ctx.font = 'bold 13px monospace'
  ctx.fillText(`${gCurrent.toFixed(1)}G`, x, y)
  ctx.fillStyle = '#00ff44'
  ctx.font = '11px monospace'
  ctx.fillText(`MAX ${gMax.toFixed(1)}G`, x, y + 14)
}
