import { mToFt } from '../../utils/Units'

/** Radio (radar) altimeters on fighters stop tracking a few thousand feet up. */
const RADALT_CEILING_FT = 5000
/**
 * Wheels-to-antenna height (ft). `getAGLM` measures the CG/reference point above
 * the terrain, so subtract this so the readout shows ~0 at touchdown.
 */
const RADALT_GEAR_OFFSET_FT = 5

/**
 * Altitude tape. Reads radar altitude (height above terrain) whenever the
 * aircraft is within radio-altimeter range, tagged `R`; above that ceiling it
 * falls back to barometric altitude, tagged `B`.
 */
export function drawAltimeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  baroAltM: number,
  aglM: number,
): void {
  const baroFt = Math.round(mToFt(baroAltM))
  const aglFt = mToFt(aglM) - RADALT_GEAR_OFFSET_FT
  const radarFt = Math.max(0, Math.round(aglFt))
  const onRadar = aglFt <= RADALT_CEILING_FT && aglM > -3
  const ft = onRadar ? radarFt : baroFt

  const h = 120, tickH = 8
  // Tighter scale on radar altitude so low-level 100-ft steps are readable.
  const span = onRadar ? 600 : 2000
  const step = onRadar ? 100 : 200
  const majorEvery = onRadar ? 500 : 1000

  ctx.strokeRect(x, cy - h / 2, 44, h)

  for (let v = ft - span; v <= ft + span; v += step) {
    if (v < 0 && onRadar) continue
    const dy = (ft - v) / span * (h / 2)
    if (Math.abs(dy) > h / 2) continue
    const isMajor = v % majorEvery === 0
    ctx.beginPath()
    ctx.moveTo(x, cy + dy)
    ctx.lineTo(x + (isMajor ? tickH : tickH / 2), cy + dy)
    ctx.stroke()
    if (isMajor) ctx.fillText(`${v}`, x + tickH + 1, cy + dy + 4)
  }

  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x - 2, cy - 10, 56, 20)
  ctx.fillStyle = '#00ff44'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(`${onRadar ? 'R' : 'B'}${ft}`, x + 1, cy + 5)
  ctx.font = '12px monospace'
}
