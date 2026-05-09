import type { RadarState } from '../../types/radar'
import type { Vec3, Quat } from '../../types/common'
import { mToNm } from '../../utils/Units'
import { v3dist, quatRotateVec, quatConjugate } from '../../utils/MathUtils'

export function drawRadarScope(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radar: RadarState, ownPos: Vec3, ownAttitudeQuat?: Quat): void {
  ctx.strokeStyle = '#00ff44'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)

  const rangeNm = mToNm(radar.rangeModeM)
  ctx.font = '10px monospace'
  ctx.fillStyle = '#00ff44'
  ctx.fillText(`${Math.round(rangeNm)}nm`, x + 2, y + 10)
  ctx.fillText(radar.mode, x + w - 28, y + 10)
  ctx.fillText(`${radar.tracks.length}TGT`, x + w / 2 - 12, y + 10)

  // Range lines at 1/4, 1/2, 3/4
  ctx.globalAlpha = 0.15
  for (let i = 1; i < 4; i++) {
    const ly = y + h - (i / 4) * h
    ctx.beginPath()
    ctx.moveTo(x, ly)
    ctx.lineTo(x + w, ly)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Scan cursor
  const scanX = x + ((radar.azimuthDeg + 60) / 120) * w
  ctx.globalAlpha = 0.25
  ctx.beginPath()
  ctx.moveTo(scanX, y)
  ctx.lineTo(scanX, y + h)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Tracks
  for (const t of radar.tracks) {
    const rangeM = v3dist(t.positionNED, ownPos)
    let azDeg: number
    if (ownAttitudeQuat) {
      // Body-relative azimuth — world delta rotated into body frame.
      const wd: Vec3 = [
        t.positionNED[0] - ownPos[0],
        t.positionNED[1] - ownPos[1],
        t.positionNED[2] - ownPos[2],
      ]
      const bd = quatRotateVec(quatConjugate(ownAttitudeQuat), wd)
      azDeg = Math.atan2(bd[1], bd[0]) * (180 / Math.PI)
    } else {
      // Fallback: bearing from north (matches legacy behaviour when only facing north).
      const dx = t.positionNED[1] - ownPos[1]
      const dy = t.positionNED[0] - ownPos[0]
      azDeg = Math.atan2(dx, dy) * (180 / Math.PI)
    }

    // Skip targets outside the ±60° scope cone — they're behind the wing or off the side.
    if (azDeg < -60 || azDeg > 60) continue
    if (rangeM > radar.rangeModeM) continue

    const tx = x + ((azDeg + 60) / 120) * w
    const ty = y + h - (rangeM / radar.rangeModeM) * h
    // STT for aircraft, or GMTI lock for ground — both render as the hard-lock symbol.
    const isLocked = (radar.mode === 'STT' || radar.mode === 'GMTI') && t.entityId === radar.sttTargetId
    const isSelected = !isLocked && t.entityId === radar.selectedTrackId

    if (isLocked) {
      // White square — hard lock
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(tx - 5, ty - 5, 10, 10)
      ctx.strokeStyle = '#00ff44'
      ctx.lineWidth = 1
    } else if (isSelected) {
      // Yellow bracket — cursor selection
      ctx.strokeStyle = '#ffee00'
      ctx.lineWidth = 1.5
      const bs = 7
      ctx.beginPath()
      // top-left bracket
      ctx.moveTo(tx - bs, ty - bs + 3); ctx.lineTo(tx - bs, ty - bs); ctx.lineTo(tx - bs + 3, ty - bs)
      // top-right bracket
      ctx.moveTo(tx + bs - 3, ty - bs); ctx.lineTo(tx + bs, ty - bs); ctx.lineTo(tx + bs, ty - bs + 3)
      // bottom-right bracket
      ctx.moveTo(tx + bs, ty + bs - 3); ctx.lineTo(tx + bs, ty + bs); ctx.lineTo(tx + bs - 3, ty + bs)
      // bottom-left bracket
      ctx.moveTo(tx - bs + 3, ty + bs); ctx.lineTo(tx - bs, ty + bs); ctx.lineTo(tx - bs, ty + bs - 3)
      ctx.stroke()
      ctx.strokeStyle = '#00ff44'
      ctx.lineWidth = 1
    } else {
      // Green circle — normal track
      ctx.fillStyle = '#00ff44'
      ctx.beginPath()
      ctx.arc(tx, ty, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // Range label
    ctx.fillStyle = isLocked ? '#ffffff' : isSelected ? '#ffee00' : '#00ff44'
    ctx.font = '9px monospace'
    ctx.fillText(`${Math.round(mToNm(rangeM))}`, tx + 5, ty - 2)
  }

  // Mode hint
  ctx.fillStyle = '#888888'
  ctx.font = '8px monospace'
  if (radar.mode === 'STT') {
    ctx.fillText('T:sel  U:unlock', x + 2, y + h - 3)
  } else if (radar.tracks.length > 0) {
    ctx.fillText('T:sel  L:lock', x + 2, y + h - 3)
  }
}
