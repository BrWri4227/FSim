import type { LoadedStore } from '../../types/weapons'

export function drawStoresPage(ctx: CanvasRenderingContext2D, w: number, h: number, stores: LoadedStore[], gunRounds: number, selectedWeapon: string): void {
  ctx.fillStyle = '#001122'
  ctx.fillRect(0, 0, w, h)
  ctx.font = '11px monospace'
  ctx.fillStyle = '#4488ff'
  ctx.fillText('STORES', 4, 14)

  let y = 28
  for (const s of stores) {
    if (!s.weaponId || !s.remainingRounds) continue
    const isSel = s.weaponId === selectedWeapon
    ctx.fillStyle = isSel ? '#ffffff' : '#4488ff'
    ctx.fillText(`${isSel ? '>' : ' '} ${s.weaponId.toUpperCase()} x${s.remainingRounds}`, 8, y)
    y += 14
  }

  ctx.fillStyle = '#4488ff'
  ctx.fillText(`GUN: ${gunRounds}`, 8, y + 4)
}
