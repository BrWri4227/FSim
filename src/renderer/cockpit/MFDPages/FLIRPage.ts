import type { TargetingPodState } from '../../avionics/TargetingPod'
import type { GroundTarget } from '../../entities/GroundTarget'

/**
 * Stylized FLIR / TGP page. Renders a greyscale "camera" view based on the pod's
 * current gimbal direction with simple symbology — crosshair, locked-target box,
 * az/el readouts, and a small "FLIR" header. Not a real render-to-texture; this
 * is a 2D representation built from the locked entity's relative geometry.
 */
export function drawFLIRPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pod: TargetingPodState,
  ownPositionNED: [number, number, number],
  groundTargets: GroundTarget[],
): void {
  // Background
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, w, h)

  // Power-off state
  if (!pod.active) {
    ctx.fillStyle = '#202020'
    ctx.font = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('FLIR OFF', w / 2, h / 2)
    return
  }

  // Greyscale "scene gradient" — dark sky top, lighter ground bottom
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#1a1a1a')
  grad.addColorStop(0.5, '#3a3a3a')
  grad.addColorStop(1, '#5a5a5a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Horizon line moves with elevation depression (positive depression = pointing down)
  const horizonY = (h * 0.5) + (pod.gimbalElDeg / 90) * (h * 0.5)
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, horizonY)
  ctx.lineTo(w, horizonY)
  ctx.stroke()

  // Render targets as bright IR blobs scaled by inverse range
  for (const gt of groundTargets) {
    if (gt.state.destroyed) continue
    const dx = gt.state.positionNED[0] - ownPositionNED[0]
    const dy = gt.state.positionNED[1] - ownPositionNED[1]
    const dz = gt.state.positionNED[2] - ownPositionNED[2]
    const range = Math.hypot(dx, dy, dz)
    if (range < 1 || range > 30000) continue
    // Map relative az/el to screen — pod boresight is at center
    const tgtAz = Math.atan2(dy, dx) * 180 / Math.PI
    const tgtEl = Math.atan2(dz, Math.hypot(dx, dy)) * 180 / Math.PI
    const dAz = wrapDeg(tgtAz - pod.gimbalAzDeg)
    const dEl = tgtEl - pod.gimbalElDeg
    if (Math.abs(dAz) > 30 || Math.abs(dEl) > 25) continue
    const sx = w / 2 + (dAz / 30) * (w / 2)
    const sy = h / 2 + (dEl / 25) * (h / 2)
    // Hot blob — heat scales with IR signature
    const blobR = Math.max(2, 10 - range / 3000) * (0.5 + Math.min(1, gt.spec.irSignatureKW / 30))
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(sx, sy, blobR, 0, Math.PI * 2)
    ctx.fill()
    if (pod.lockedEntityId === gt.entityId) {
      // Lock box around locked target
      ctx.strokeStyle = '#00ff44'
      ctx.lineWidth = 2
      ctx.strokeRect(sx - 14, sy - 14, 28, 28)
    }
  }

  // Crosshair
  ctx.strokeStyle = pod.tracking ? '#00ff44' : '#aaaa00'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(w / 2 - 12, h / 2)
  ctx.lineTo(w / 2 + 12, h / 2)
  ctx.moveTo(w / 2, h / 2 - 12)
  ctx.lineTo(w / 2, h / 2 + 12)
  ctx.stroke()

  // Header
  ctx.font = '10px monospace'
  ctx.fillStyle = '#00ff44'
  ctx.textAlign = 'left'
  ctx.fillText('FLIR', 4, 12)
  ctx.textAlign = 'right'
  ctx.fillText(`AZ ${pod.gimbalAzDeg.toFixed(0).padStart(4, ' ')}°`, w - 4, 12)
  ctx.fillText(`EL -${pod.gimbalElDeg.toFixed(0).padStart(2, ' ')}°`, w - 4, 24)

  // Lock status
  if (pod.lockedEntityId) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#00ff44'
    ctx.fillText('LOCK', w / 2, h - 6)
  }
}

function wrapDeg(d: number): number {
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}
