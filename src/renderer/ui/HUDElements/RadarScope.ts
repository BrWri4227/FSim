import type { RadarState } from '../../types/radar'
import type { Vec3 } from '../../types/common'
import { mToNm } from '../../utils/Units'
import { v3dist } from '../../utils/MathUtils'

export function drawRadarScope(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radar: RadarState, ownPos: Vec3): void {
  ctx.strokeRect(x, y, w, h)

  const rangeNm = mToNm(radar.rangeModeM)
  ctx.font = '10px monospace'
  ctx.fillText(`${Math.round(rangeNm)}nm`, x + 2, y + 10)
  ctx.fillText(radar.mode, x + w - 28, y + 10)

  // Scan cursor
  const scanX = x + ((radar.azimuthDeg + 60) / 120) * w
  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.moveTo(scanX, y)
  ctx.lineTo(scanX, y + h)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Tracks
  for (const t of radar.tracks) {
    const rangeM = v3dist(t.positionNED, ownPos)
    const dx = t.positionNED[1] - ownPos[1]
    const dy = t.positionNED[0] - ownPos[0]
    const azDeg = Math.atan2(dx, dy) * (180 / Math.PI)

    const tx = x + ((azDeg + 60) / 120) * w
    const ty = y + h - (rangeM / radar.rangeModeM) * h
    const isSTT = radar.mode === 'STT' && t.entityId === radar.sttTargetId

    ctx.fillStyle = isSTT ? '#ffffff' : '#00ff44'
    if (isSTT) {
      ctx.strokeStyle = '#ffffff'
      ctx.beginPath()
      ctx.rect(tx - 4, ty - 4, 8, 8)
      ctx.stroke()
      ctx.strokeStyle = '#00ff44'
    } else {
      ctx.beginPath()
      ctx.arc(tx, ty, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#00ff44'
    ctx.fillText(`${Math.round(mToNm(rangeM))}`, tx + 3, ty - 2)
  }
}
