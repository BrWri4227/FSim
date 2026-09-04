import type { DamageState, DamageZone } from '../../types/damage'

/** Display order and short labels — six cells wide enough to read at a glance. */
const ZONE_LABELS: ReadonlyArray<readonly [DamageZone, string]> = [
  ['ENGINE', 'ENG'],
  ['WING_LEFT', 'L-WG'],
  ['WING_RIGHT', 'R-WG'],
  ['FUSELAGE', 'FUS'],
  ['TAIL', 'TAIL'],
  ['COCKPIT', 'CPT'],
]

const OK = '#00ff44'
const WARN = '#ffb000'
const CRIT = '#ff2020'
const FRAME = '#226644'
const DIM = '#446644'

function zoneColor(v: number): string {
  if (v < 0.25) return OK
  if (v < 0.6) return WARN
  return CRIT
}

/**
 * Per-zone airframe condition readout.
 *
 * The damage model already drives thrust loss, roll/pitch authority and fuel
 * leaks, but none of it was surfaced anywhere, so "why did my plane stop
 * turning" was unanswerable. Each cell is a filled bar proportional to that
 * zone's damage, coloured green/amber/red, plus FIRE and ENG FAIL flags.
 */
export function drawDamagePanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  damage: DamageState,
  uiScale: number,
): void {
  const cellW = Math.round(30 * uiScale)
  const cellH = Math.round(11 * uiScale)
  const gap = Math.round(3 * uiScale)
  const labelH = Math.round(9 * uiScale)

  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.font = `${Math.round(9 * uiScale)}px monospace`
  ctx.fillStyle = FRAME
  ctx.fillText('DMG', x, y)

  const rowY = y + Math.round(5 * uiScale)

  ZONE_LABELS.forEach(([zone, label], i) => {
    const cx = x + i * (cellW + gap)
    const v = Math.max(0, Math.min(1, damage.zones[zone]))
    const intact = v < 0.02

    // Cell outline
    ctx.strokeStyle = intact ? FRAME : zoneColor(v)
    ctx.lineWidth = 1
    ctx.strokeRect(cx, rowY, cellW, cellH)

    // Fill proportional to damage so partial damage is legible, not just banded
    if (!intact) {
      ctx.fillStyle = zoneColor(v)
      ctx.fillRect(cx + 1, rowY + 1, Math.max(1, (cellW - 2) * v), cellH - 2)
    }

    ctx.font = `${labelH}px monospace`
    ctx.fillStyle = intact ? DIM : zoneColor(v)
    ctx.fillText(label, cx, rowY + cellH + labelH)
  })

  // Cascade flags — these explain a sudden thrust or handling change.
  const flags: string[] = []
  if (damage.onFire) flags.push('FIRE')
  if (damage.engineFailed) flags.push('ENG FAIL')
  if (damage.structuralFailure) flags.push('STRUCT')

  if (flags.length > 0) {
    ctx.font = `bold ${Math.round(11 * uiScale)}px monospace`
    ctx.fillStyle = CRIT
    ctx.fillText(flags.join('  '), x, rowY + cellH + labelH * 2 + Math.round(6 * uiScale))
  }

  ctx.restore()
}
