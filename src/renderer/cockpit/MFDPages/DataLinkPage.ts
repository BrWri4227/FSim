import type { DataLinkContact } from '../../types/radar'
import type { Vec3 } from '../../types/common'
import { mToNm } from '../../utils/Units'

export function drawDataLinkPage(ctx: CanvasRenderingContext2D, w: number, h: number, contacts: DataLinkContact[], playerPos: Vec3): void {
  ctx.fillStyle = '#000011'
  ctx.fillRect(0, 0, w, h)
  ctx.font = '11px monospace'
  ctx.fillStyle = '#4488ff'
  ctx.fillText('DATALINK', 4, 14)

  const cx = w / 2, cy = h / 2
  const scaleNm = 200  // display range in NM
  const pxPerNm = Math.min(w, h) * 0.4 / scaleNm

  // Grid ring
  ctx.strokeStyle = '#111133'
  ctx.lineWidth = 1
  for (const r of [50, 100, 150, 200]) {
    ctx.beginPath()
    ctx.arc(cx, cy, r * pxPerNm, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Own-ship
  ctx.fillStyle = '#00ff88'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  // Contacts
  for (const c of contacts) {
    const dx = (c.positionNED[1] - playerPos[1])  // east
    const dy = (c.positionNED[0] - playerPos[0])  // north
    const dxNm = mToNm(dx)
    const dyNm = mToNm(dy)
    const px = cx + dxNm * pxPerNm
    const py = cy - dyNm * pxPerNm  // north = up

    if (px < 0 || px > w || py < 0 || py > h) continue

    ctx.fillStyle = c.classification === 'FRIENDLY' ? '#00ccff'
                  : c.classification === 'HOSTILE'  ? '#ff4444' : '#ffaa00'
    ctx.beginPath()
    // Triangle pointing in velocity direction
    ctx.moveTo(px, py - 5)
    ctx.lineTo(px - 4, py + 4)
    ctx.lineTo(px + 4, py + 4)
    ctx.closePath()
    ctx.fill()
  }
}
