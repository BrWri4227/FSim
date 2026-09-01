import type { RWRState, RWRThreat } from '../../types/radar'

/**
 * Per-frame memory for the RWR display so newly-appearing emitters can strobe
 * briefly. Owned by the HUD and passed in each call (mirrors HUD.gunFunnelState).
 */
export interface RWRDisplayState {
  /** entityId → time (sec) the emitter was first seen. */
  seen: Map<string, number>
}

export function createRWRDisplayState(): RWRDisplayState {
  return { seen: new Map() }
}

const NEW_THREAT_STROBE_SEC = 1.2

/** Radial position (0..1 of ring radius) for a threat by lethality. */
function threatRadiusFrac(t: RWRThreat): number {
  if (t.type === 'MISSILE') {
    const d = t.distanceM ?? 15000
    return Math.max(0.14, Math.min(0.55, d / 40000))
  }
  if (t.type === 'SAM') return t.priority >= 4 ? 0.6 : 0.78
  if (t.type === 'TRACK') return t.priority >= 4 ? 0.62 : 0.74
  return 1 // SEARCH sits on the outer ring
}

// Real RWR display: azimuth ring with 12-o'clock = aircraft nose. Missiles flash
// at 4 Hz; a "MSL" banner appears when any missile is inbound.
export function drawThreatDisplay(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rwr: RWRState,
  timeSec: number,
  displayState?: RWRDisplayState,
): void {
  const r = 60
  const hasMissile = rwr.threats.some(t => t.type === 'MISSILE')
  const flash4Hz = Math.floor(timeSec * 4) % 2 === 0

  // Track first-seen times for the new-emitter strobe.
  const live = new Set(rwr.threats.map(t => t.entityId))
  if (displayState) {
    for (const t of rwr.threats) {
      if (!displayState.seen.has(t.entityId)) displayState.seen.set(t.entityId, timeSec)
    }
    for (const id of displayState.seen.keys()) {
      if (!live.has(id)) displayState.seen.delete(id)
    }
  }

  // Highest-priority emitter gets emphasised.
  let topPriority = 0
  for (const t of rwr.threats) topPriority = Math.max(topPriority, t.priority)

  ctx.save()
  ctx.font = '10px monospace'
  ctx.strokeStyle = '#00ff44'
  ctx.fillStyle = '#00ff44'

  // Outer ring
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Inner lethality ring
  ctx.globalAlpha = 0.15
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Nose reference (▲ at 12 o'clock) + 3/6/9 ticks, no compass letters.
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.moveTo(cx, cy - r - 7)
  ctx.lineTo(cx - 4, cy - r + 1)
  ctx.lineTo(cx + 4, cy - r + 1)
  ctx.closePath()
  ctx.fill()
  for (const deg of [90, 180, 270]) {
    const rad = (deg - 90) * Math.PI / 180
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(rad) * (r - 4), cy + Math.sin(rad) * (r - 4))
    ctx.lineTo(cx + Math.cos(rad) * (r + 4), cy + Math.sin(rad) * (r + 4))
    ctx.stroke()
  }
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.arc(cx, cy, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // De-conflict emitters that would overlap: nudge radius when close in azimuth.
  const placed: { az: number; rf: number }[] = []
  const radiusFor = (t: RWRThreat): number => {
    let rf = threatRadiusFrac(t)
    for (const p of placed) {
      if (Math.abs(((t.azimuthDeg - p.az + 540) % 360) - 180) < 8 && Math.abs(rf - p.rf) < 0.13) {
        rf = Math.max(0.12, rf - 0.16)
      }
    }
    placed.push({ az: t.azimuthDeg, rf })
    return rf
  }

  // New-threat strobe lines (drawn under the symbols).
  if (displayState) {
    for (const t of rwr.threats) {
      const seenAt = displayState.seen.get(t.entityId)
      if (seenAt === undefined || timeSec - seenAt > NEW_THREAT_STROBE_SEC) continue
      const azRad = (t.azimuthDeg - 90) * Math.PI / 180
      ctx.strokeStyle = t.type === 'MISSILE' ? '#ff0000' : '#ffaa00'
      ctx.globalAlpha = 0.5 * (1 - (timeSec - seenAt) / NEW_THREAT_STROBE_SEC)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(azRad) * r, cy + Math.sin(azRad) * r)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.lineWidth = 1
    }
  }

  // Threat symbols
  for (const t of rwr.threats) {
    const azRad = (t.azimuthDeg - 90) * Math.PI / 180
    const rf = radiusFor(t)
    const tx = cx + Math.cos(azRad) * r * rf
    const ty = cy + Math.sin(azRad) * r * rf
    const isTop = t.priority === topPriority && topPriority >= 3

    if (t.type === 'MISSILE') {
      if (!flash4Hz) continue
      ctx.fillStyle = '#ff0000'
      ctx.strokeStyle = '#ff0000'
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(Math.PI / 4)
      ctx.lineWidth = isTop ? 2.5 : 1.5
      ctx.strokeRect(-5, -5, 10, 10)
      ctx.restore()
      ctx.font = 'bold 12px monospace'
      ctx.fillText('M', tx - 4, ty + 4)
      if (t.distanceM !== undefined) {
        ctx.font = '8px monospace'
        const km = t.distanceM >= 10000
          ? `${(t.distanceM / 1000).toFixed(0)}k`
          : `${(t.distanceM / 1000).toFixed(1)}k`
        ctx.fillText(km, tx - 8, ty + 15)
      }
    } else if (t.type === 'SAM') {
      ctx.fillStyle = isTop ? '#ff2020' : '#ff8800'
      ctx.font = `${isTop ? 'bold ' : ''}11px monospace`
      ctx.fillText('⊙', tx - 4, ty + 4) // circled dot
    } else if (t.type === 'TRACK') {
      ctx.fillStyle = t.priority >= 4 ? '#ff2020' : '#ff4444'
      ctx.font = `${isTop ? 'bold 12' : '11'}px monospace`
      ctx.fillText('T', tx - 4, ty + 4)
    } else {
      ctx.fillStyle = '#ffaa00'
      ctx.font = '10px monospace'
      ctx.fillText('S', tx - 4, ty + 4)
    }

    if (isTop) {
      ctx.strokeStyle = '#ffff00'
      ctx.globalAlpha = 0.8
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(tx, ty, 9, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = '#00ff44'
    ctx.strokeStyle = '#00ff44'
  }

  // Missile-launch banner + bearing.
  if (hasMissile && flash4Hz) {
    const first = rwr.threats.find(t => t.type === 'MISSILE')
    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = '#ff0000'
    const brg = first ? ` ${Math.round(((first.azimuthDeg % 360) + 360) % 360).toString().padStart(3, '0')}` : ''
    ctx.fillText(`◄ MSL${brg} ►`, cx - 30, cy - r - 12)
    ctx.font = '10px monospace'
  }

  ctx.restore()
  ctx.fillStyle = '#00ff44'
}
