import type { RadarState } from '../../types/radar'
import type { Vec3, Quat } from '../../types/common'
import { mToNm } from '../../utils/Units'
import { computeTrackBScope } from '../../ui/HUDElements/RadarScope'

export function drawRadarPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  radar: RadarState,
  ownPos: Vec3,
  ownAttitudeQuat?: Quat,
): void {
  ctx.fillStyle = '#001100'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#00ff44'
  ctx.fillStyle   = '#00ff44'
  ctx.lineWidth   = 1
  ctx.font        = '11px monospace'

  const rangeNm = mToNm(radar.rangeModeM)
  ctx.fillText(`RADAR ${radar.mode}`, 4, 14)
  ctx.fillText(`${Math.round(rangeNm)}nm`, w - 36, 14)

  const bx = 4, by = 20, bw = w - 8, bh = h - 30

  // Range lines
  ctx.globalAlpha = 0.3
  for (let i = 1; i <= 4; i++) {
    const ly = by + bh - (i / 4) * bh
    ctx.beginPath()
    ctx.moveTo(bx, ly)
    ctx.lineTo(bx + bw, ly)
    ctx.stroke()
    ctx.fillText(`${Math.round(rangeNm * i / 4)}`, bx + 2, ly - 2)
  }
  ctx.globalAlpha = 1

  // Azimuth scan cursor
  const scanX = bx + ((radar.azimuthDeg + 60) / 120) * bw
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.moveTo(scanX, by)
  ctx.lineTo(scanX, by + bh)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Tracks
  for (const t of radar.tracks) {
    const { rangeM, azDeg } = computeTrackBScope(t.positionNED, ownPos, ownAttitudeQuat)
    if (azDeg < -60 || azDeg > 60) continue
    if (rangeM > radar.rangeModeM) continue

    const tx = bx + ((azDeg + 60) / 120) * bw
    const ty = by + bh - (rangeM / radar.rangeModeM) * bh
    const isSTT = radar.mode === 'STT' && t.entityId === radar.sttTargetId

    ctx.fillStyle = isSTT ? '#ffffff' : '#00ff44'
    if (isSTT) {
      ctx.strokeStyle = '#ffffff'
      ctx.beginPath()
      ctx.rect(tx - 5, ty - 5, 10, 10)
      ctx.stroke()
      ctx.strokeStyle = '#00ff44'
    } else {
      ctx.beginPath()
      ctx.arc(tx, ty, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#00ff44'
    ctx.fillText(`${Math.round(mToNm(rangeM))}`, tx + 4, ty)
  }

  ctx.fillText(radar.mode, w / 2 - 10, h - 4)
}
