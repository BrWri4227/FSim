import type { RadarState } from '../../types/radar'
import type { Vec3, Quat } from '../../types/common'
import { mToNm } from '../../utils/Units'
import { v3dist, quatRotateVec, quatConjugate } from '../../utils/MathUtils'
import { computeRelativeKinematics } from './TargetGeometry'

const MS_TO_KTS = 1.94384

/** Dynamic launch zone for the selected missile against the current target. */
export interface RadarDLZ {
  rMinM: number
  rNeM: number
  rMaxM: number
  rangeM: number
}

export function computeTrackBScope(
  trackPos: Vec3,
  ownPos: Vec3,
  ownAttitudeQuat?: Quat,
): { rangeM: number; azDeg: number } {
  const rangeM = v3dist(trackPos, ownPos)
  let azDeg: number
  if (ownAttitudeQuat) {
    const wd: Vec3 = [
      trackPos[0] - ownPos[0],
      trackPos[1] - ownPos[1],
      trackPos[2] - ownPos[2],
    ]
    const bd = quatRotateVec(quatConjugate(ownAttitudeQuat), wd)
    azDeg = Math.atan2(bd[1], bd[0]) * (180 / Math.PI)
  } else {
    const dx = trackPos[1] - ownPos[1]
    const dy = trackPos[0] - ownPos[0]
    azDeg = Math.atan2(dx, dy) * (180 / Math.PI)
  }
  return { rangeM, azDeg }
}

export function drawRadarScope(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radar: RadarState,
  ownPos: Vec3,
  ownAttitudeQuat?: Quat,
  ownVelNED?: Vec3,
  dlz?: RadarDLZ,
): void {
  const isGMTI = radar.mode === 'GMTI'
  ctx.save()
  ctx.strokeStyle = '#00ff44'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)

  const azToX = (azDeg: number) => x + ((azDeg + 60) / 120) * w
  const rangeToY = (rangeM: number) => y + h - (rangeM / radar.rangeModeM) * h

  // ── Header line ────────────────────────────────────────────────────────────
  const rangeNm = mToNm(radar.rangeModeM)
  ctx.font = '10px monospace'
  ctx.fillStyle = '#00ff44'
  ctx.fillText(`${Math.round(rangeNm)}nm`, x + 2, y + 10)
  ctx.fillText(radar.mode, x + w / 2 - 12, y + 10)
  ctx.textAlign = 'right'
  ctx.fillText(`${radar.tracks.length}T`, x + w - 3, y + 10)
  ctx.textAlign = 'left'

  // Scan-bar elevation readout (air modes only).
  if (!isGMTI && radar.mode !== 'OFF') {
    const elSign = radar.elevationBarDeg >= 0 ? '+' : '-'
    ctx.fillStyle = '#88bb88'
    ctx.fillText(`B${radar.barIndex + 1} EL${elSign}${Math.abs(Math.round(radar.elevationBarDeg))}`, x + 2, y + 21)
  }

  // ── Range rings at 1/4, 1/2, 3/4 ───────────────────────────────────────────
  ctx.globalAlpha = 0.15
  ctx.strokeStyle = '#00ff44'
  for (let i = 1; i < 4; i++) {
    const ly = y + h - (i / 4) * h
    ctx.beginPath()
    ctx.moveTo(x, ly)
    ctx.lineTo(x + w, ly)
    ctx.stroke()
  }
  // Azimuth grid at ±30° and boresight.
  for (const az of [-30, 0, 30]) {
    const gx = azToX(az)
    ctx.beginPath()
    ctx.moveTo(gx, y)
    ctx.lineTo(gx, y + h)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Azimuth scale ticks along the bottom edge.
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = '#00ff44'
  for (let az = -60; az <= 60; az += 15) {
    const gx = azToX(az)
    ctx.beginPath()
    ctx.moveTo(gx, y + h)
    ctx.lineTo(gx, y + h - (az % 30 === 0 ? 6 : 3))
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // ── Scan cursor + bar-elevation strobe ─────────────────────────────────────
  if (!isGMTI) {
    const scanX = azToX(radar.azimuthDeg)
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.moveTo(scanX, y)
    ctx.lineTo(scanX, y + h)
    ctx.stroke()
    ctx.globalAlpha = 1

    // Left-gutter elevation strobe: rides up/down with the active bar.
    const elNorm = (6 - radar.elevationBarDeg) / 12 // +6° at top, -6° at bottom
    const strobeY = y + 4 + Math.max(0, Math.min(1, elNorm)) * (h - 8)
    ctx.fillStyle = '#00ff44'
    ctx.fillRect(x - 4, strobeY - 4, 3, 8)
  }

  // ── STT azimuth cue: full-height line at the locked target's bearing ───────
  const lockedTrack = radar.sttTargetId
    ? radar.tracks.find(t => t.entityId === radar.sttTargetId)
    : undefined
  if (lockedTrack) {
    const { azDeg } = computeTrackBScope(lockedTrack.positionNED, ownPos, ownAttitudeQuat)
    if (azDeg >= -60 && azDeg <= 60) {
      const lx = azToX(azDeg)
      ctx.strokeStyle = '#ffffff'
      ctx.globalAlpha = 0.4
      ctx.beginPath()
      ctx.moveTo(lx, y)
      ctx.lineTo(lx, y + h)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  // ── Tracks ────────────────────────────────────────────────────────────────
  for (const t of radar.tracks) {
    const { rangeM, azDeg } = computeTrackBScope(t.positionNED, ownPos, ownAttitudeQuat)
    if (azDeg < -60 || azDeg > 60) continue
    if (rangeM > radar.rangeModeM) continue

    const tx = azToX(azDeg)
    const ty = rangeToY(rangeM)
    const isLocked = (radar.mode === 'STT' || radar.mode === 'GMTI') && t.entityId === radar.sttTargetId
    const isSystem = !isLocked && t.entityId === radar.selectedTrackId
    const coasting = t.confidence < 0.6
    const alpha = Math.max(0.3, Math.min(1, t.confidence + 0.15))

    ctx.globalAlpha = alpha

    // Velocity leader line (air tracks): where the contact will be in ~12 s.
    if (!isGMTI) {
      const lead: Vec3 = [
        t.positionNED[0] + t.velocityNED[0] * 12,
        t.positionNED[1] + t.velocityNED[1] * 12,
        t.positionNED[2] + t.velocityNED[2] * 12,
      ]
      const leadBs = computeTrackBScope(lead, ownPos, ownAttitudeQuat)
      let lx = azToX(leadBs.azDeg)
      let ly = rangeToY(leadBs.rangeM)
      // Clamp the leader to a sane on-scope length.
      const dx = lx - tx, dy = ly - ty
      const llen = Math.hypot(dx, dy)
      const maxLen = 22
      if (llen > maxLen) { lx = tx + (dx / llen) * maxLen; ly = ty + (dy / llen) * maxLen }
      if (llen > 1.5) {
        ctx.strokeStyle = isLocked ? '#ffffff' : '#00ff44'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(lx, ly)
        ctx.stroke()
      }
    }

    if (isLocked) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(tx - 5, ty - 5, 10, 10)
    } else if (isSystem) {
      // Filled down-caret above the symbol marks the TWS system target.
      ctx.fillStyle = '#00ff44'
      ctx.beginPath()
      ctx.moveTo(tx, ty - 6)
      ctx.lineTo(tx - 4, ty - 12)
      ctx.lineTo(tx + 4, ty - 12)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#00ff44'
      ctx.lineWidth = 1.5
      ctx.strokeRect(tx - 4, ty - 4, 8, 8)
    }

    if (t.entityId === radar.selectedTrackId && !isLocked) {
      // Yellow acquisition brackets follow the cursor selection.
      ctx.strokeStyle = '#ffee00'
      ctx.lineWidth = 1.5
      const bs = 8
      ctx.beginPath()
      ctx.moveTo(tx - bs, ty - bs + 3); ctx.lineTo(tx - bs, ty - bs); ctx.lineTo(tx - bs + 3, ty - bs)
      ctx.moveTo(tx + bs - 3, ty - bs); ctx.lineTo(tx + bs, ty - bs); ctx.lineTo(tx + bs, ty - bs + 3)
      ctx.moveTo(tx + bs, ty + bs - 3); ctx.lineTo(tx + bs, ty + bs); ctx.lineTo(tx + bs - 3, ty + bs)
      ctx.moveTo(tx - bs + 3, ty + bs); ctx.lineTo(tx - bs, ty + bs); ctx.lineTo(tx - bs, ty + bs - 3)
      ctx.stroke()
    }

    if (isGMTI) {
      // Ground moving target — chevron.
      ctx.strokeStyle = t.entityId === radar.sttTargetId ? '#ffffff' : '#00ff44'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(tx - 5, ty + 3)
      ctx.lineTo(tx, ty - 4)
      ctx.lineTo(tx + 5, ty + 3)
      ctx.stroke()
    } else if (coasting) {
      // Extrapolated / memory track — hollow dashed square.
      ctx.strokeStyle = '#00cc44'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.strokeRect(tx - 4, ty - 4, 8, 8)
      ctx.setLineDash([])
    } else if (!isLocked && !isSystem) {
      ctx.fillStyle = '#00ff44'
      ctx.beginPath()
      ctx.arc(tx, ty, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // Altitude tag (thousands of ft) below the symbol.
    const altK = Math.round((-t.positionNED[2]) * 3.28084 / 1000)
    ctx.fillStyle = isLocked ? '#ffffff' : t.entityId === radar.selectedTrackId ? '#ffee00' : '#00ff44'
    ctx.font = '9px monospace'
    ctx.fillText(`${Math.round(mToNm(rangeM))}`, tx + 6, ty - 2)
    if (!isGMTI) ctx.fillText(`${altK}`, tx + 6, ty + 9)

    ctx.globalAlpha = 1
  }

  // ── Dynamic launch zone staple, right gutter ──────────────────────────────
  if (dlz && dlz.rMaxM > dlz.rMinM) {
    const sx = x + w - 5
    const yMax = rangeToY(Math.min(dlz.rMaxM, radar.rangeModeM))
    const yMin = rangeToY(Math.min(dlz.rMinM, radar.rangeModeM))
    const yNe = rangeToY(Math.min(dlz.rNeM, radar.rangeModeM))
    ctx.strokeStyle = '#00ff44'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(sx, yMax); ctx.lineTo(sx, yMin)
    ctx.moveTo(sx - 3, yMax); ctx.lineTo(sx + 1, yMax)
    ctx.moveTo(sx - 3, yMin); ctx.lineTo(sx + 1, yMin)
    ctx.stroke()
    // No-escape band.
    ctx.strokeStyle = 'rgba(0,255,68,0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(sx, yMin); ctx.lineTo(sx, yNe)
    ctx.stroke()
    // Current-range caret.
    const yr = rangeToY(Math.min(dlz.rangeM, radar.rangeModeM))
    const inLar = dlz.rangeM >= dlz.rMinM && dlz.rangeM <= dlz.rMaxM
    ctx.fillStyle = inLar ? '#00ff44' : '#ffb000'
    ctx.beginPath()
    ctx.moveTo(sx + 2, yr)
    ctx.lineTo(sx + 8, yr - 3)
    ctx.lineTo(sx + 8, yr + 3)
    ctx.closePath()
    ctx.fill()
    ctx.lineWidth = 1
  }

  // ── Locked-target data strip (STT) ────────────────────────────────────────
  if (lockedTrack && ownVelNED) {
    const k = computeRelativeKinematics(ownPos, ownVelNED, lockedTrack.positionNED, lockedTrack.velocityNED)
    const vc = Math.round(k.closureMps * MS_TO_KTS)
    ctx.fillStyle = '#ffffff'
    ctx.font = '9px monospace'
    ctx.fillText(`Vc ${vc >= 0 ? '+' : ''}${vc}`, x + 2, y + h - 13)
  }

  // Mode hint.
  ctx.fillStyle = '#888888'
  ctx.font = '8px monospace'
  if (radar.mode === 'STT') {
    ctx.fillText('T:sel  U:unlock', x + 2, y + h - 3)
  } else if (radar.tracks.length > 0) {
    ctx.fillText('T:sel  L:lock', x + 2, y + h - 3)
  }

  ctx.restore()
}
