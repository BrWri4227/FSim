import type { LoadedStore } from '../../types/weapons'

export function drawWeaponsStatus(ctx: CanvasRenderingContext2D, x: number, y: number, stores: LoadedStore[], selectedWeapon: string, gunRounds: number): void {
  ctx.font = '12px monospace'
  const normalizedSelected = selectedWeapon.toLowerCase()
  const stackedByWeapon = new Map<string, number>()
  for (const store of stores) {
    if (!store.remainingRounds) continue
    const current = stackedByWeapon.get(store.weaponId) ?? 0
    stackedByWeapon.set(store.weaponId, current + store.remainingRounds)
  }
  let cx = x
  for (const [weaponId, rounds] of stackedByWeapon) {
    const isSel = weaponId.toLowerCase() === normalizedSelected
    ctx.fillStyle = isSel ? '#ffffff' : '#00ff44'
    const label = `${weaponId.toUpperCase()} ×${rounds}`
    ctx.fillText(label, cx, y)
    cx += ctx.measureText(label).width + 16
  }
  ctx.fillStyle = '#00ff44'
  ctx.fillText(`GUN ${gunRounds}`, cx, y)

  // Selected weapon label
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(`SEL: ${selectedWeapon?.toUpperCase() ?? 'NONE'}`, x, y + 16)
  ctx.font = '12px monospace'
}
