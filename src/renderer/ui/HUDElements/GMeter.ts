export interface GMeterPhysio {
  /** 1 = fresh, 0 = at the G-LOC threshold. */
  reserveFraction: number
  /** 0..1 AGSM straining effort. */
  agsmStrain: number
  incapacitated: boolean
}

export function drawGMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gCurrent: number,
  gMax: number,
  physio?: GMeterPhysio,
): void {
  // G readout — colour tracks physiological state when the model is supplied.
  let color = gCurrent > 7 ? '#ff4444' : gCurrent < -2 ? '#ff8888' : '#00ff44'
  if (physio) {
    if (physio.incapacitated) color = '#ff2222'
    else if (physio.reserveFraction < 0.35) color = '#ff4444'
    else if (physio.reserveFraction < 0.65) color = '#ffcc33'
  }
  ctx.fillStyle = color
  ctx.font = 'bold 13px monospace'
  ctx.fillText(`${gCurrent.toFixed(1)}G`, x, y)
  ctx.fillStyle = '#00ff44'
  ctx.font = '11px monospace'
  ctx.fillText(`MAX ${gMax.toFixed(1)}G`, x, y + 14)

  if (physio) {
    // Physiological reserve bar + AGSM straining tick.
    const barW = 46
    const barY = y + 22
    ctx.fillStyle = '#003311'
    ctx.fillRect(x, barY, barW, 4)
    ctx.fillStyle = physio.reserveFraction < 0.35 ? '#ff4444'
      : physio.reserveFraction < 0.65 ? '#ffcc33' : '#00ff44'
    ctx.fillRect(x, barY, barW * physio.reserveFraction, 4)
    if (physio.agsmStrain > 0.25) {
      ctx.fillStyle = '#66ddff'
      ctx.font = '9px monospace'
      ctx.fillText('AGSM', x + barW + 4, barY + 4)
    }
  }
}
