import type { LoadedStore } from '../../types/weapons'

export function drawWeaponsStatus(ctx: CanvasRenderingContext2D, x: number, y: number, stores: LoadedStore[], selectedWeapon: string, gunRounds: number): void {
  ctx.font = '12px monospace'
  let cx = x
  for (const s of stores) {
    if (!s.remainingRounds) continue
    const isSel = s.weaponId === selectedWeapon
    ctx.fillStyle = isSel ? '#ffffff' : '#00ff44'
    const label = `${s.weaponId?.toUpperCase()} ×${s.remainingRounds}`
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
