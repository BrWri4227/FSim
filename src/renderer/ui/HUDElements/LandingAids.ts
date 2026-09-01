import type { AircraftState } from '../../types/aircraft'
import { mToFt } from '../../utils/Units'

const HUD_GREEN = '#00ff44'
const HUD_AMBER = '#ffb000'

/** Approach on-speed angle of attack (deg) and the half-width of the on-speed band. */
const ONSPEED_DEG = 9
const ONSPEED_BAND_DEG = 2

/**
 * Landing aids: an AoA indexer (shown gear-down) and a radar-altitude readout
 * (shown below ~1500 ft AGL). Called from HUD.render after the primary symbology.
 */
export function drawLandingAids(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  uiScale: number,
  state: AircraftState,
  aglM: number,
): void {
  ctx.save()

  if (state.gearDown) {
    drawAoAIndexer(ctx, cx - 132 * uiScale, cy, state.alphaDeg)
  }

  if (aglM >= 0 && aglM < 460) {
    drawRadarAltitude(ctx, cx, cy + 116 * uiScale, aglM, state)
  }

  ctx.restore()
}

function drawAoAIndexer(ctx: CanvasRenderingContext2D, x: number, y: number, alphaDeg: number): void {
  const slow = alphaDeg > ONSPEED_DEG + ONSPEED_BAND_DEG   // high AoA — add power
  const fast = alphaDeg < ONSPEED_DEG - ONSPEED_BAND_DEG   // low AoA — reduce power
  const onSpeed = !slow && !fast

  ctx.lineWidth = 2
  ctx.font = '9px monospace'
  ctx.textAlign = 'center'

  // Top chevron ▲ — slow / high AoA
  ctx.strokeStyle = slow ? HUD_AMBER : '#1c4a2c'
  ctx.beginPath()
  ctx.moveTo(x - 9, y - 16)
  ctx.lineTo(x, y - 26)
  ctx.lineTo(x + 9, y - 16)
  ctx.stroke()

  // Centre donut ● — on speed
  ctx.strokeStyle = onSpeed ? HUD_GREEN : '#1c4a2c'
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.stroke()

  // Bottom chevron ▼ — fast / low AoA
  ctx.strokeStyle = fast ? HUD_AMBER : '#1c4a2c'
  ctx.beginPath()
  ctx.moveTo(x - 9, y + 16)
  ctx.lineTo(x, y + 26)
  ctx.lineTo(x + 9, y + 16)
  ctx.stroke()

  ctx.fillStyle = '#88bb88'
  ctx.fillText(`AOA ${alphaDeg.toFixed(1)}`, x, y + 42)
  ctx.textAlign = 'left'
}

function drawRadarAltitude(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  aglM: number,
  state: AircraftState,
): void {
  const ft = Math.max(0, Math.round(mToFt(aglM) / 10) * 10)
  const label = `R ${ft}`
  ctx.font = 'bold 13px monospace'
  const w = Math.max(64, ctx.measureText(label).width + 16)
  const h = 20
  const x = cx - w / 2

  // Amber when descending fast and low with the gear out — "check your sink"
  const sinkMS = -state.vviMps
  const hot = state.gearDown && aglM < 150 && sinkMS > 4
  ctx.strokeStyle = hot ? HUD_AMBER : HUD_GREEN
  ctx.fillStyle = hot ? HUD_AMBER : HUD_GREEN
  ctx.lineWidth = 1.5
  ctx.strokeRect(x, y - h + 4, w, h)
  ctx.textAlign = 'center'
  ctx.fillText(label, cx, y - 1)
  ctx.textAlign = 'left'
}
