import type { LoadedStore } from '../../types/weapons'

export function drawStoresPage(ctx: CanvasRenderingContext2D, w: number, h: number, stores: LoadedStore[], gunRounds: number, selectedWeapon: string): void {
  ctx.fillStyle = '#001122'
  ctx.fillRect(0, 0, w, h)
  ctx.font = '11px monospace'
  ctx.fillStyle = '#4488ff'
  ctx.fillText('STORES', 4, 14)

  const normalizedSelected = selectedWeapon.toLowerCase()
  const stackedByWeapon = new Map<string, number>()
  for (const store of stores) {
    if (!store.weaponId || !store.remainingRounds) continue
    const current = stackedByWeapon.get(store.weaponId) ?? 0
    stackedByWeapon.set(store.weaponId, current + store.remainingRounds)
  }

  let y = 28
  for (const [weaponId, rounds] of stackedByWeapon) {
    const isSel = weaponId.toLowerCase() === normalizedSelected
    ctx.fillStyle = isSel ? '#ffffff' : '#4488ff'
    ctx.fillText(`${isSel ? '>' : ' '} ${weaponId.toUpperCase()} x${rounds}`, 8, y)
    y += 14
  }

  ctx.fillStyle = '#4488ff'
  ctx.fillText(`GUN: ${gunRounds}`, 8, y + 4)
}
