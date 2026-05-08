import type { PlayerAircraft } from '../entities/PlayerAircraft'
import type { EntityManager } from '../entities/EntityManager'
import { drawAttitudeIndicator } from './HUDElements/AttitudeIndicator'
import { drawAirspeed }          from './HUDElements/Airspeed'
import { drawAltimeter }         from './HUDElements/Altimeter'
import { drawGMeter }            from './HUDElements/GMeter'
import { drawHeadingTape }       from './HUDElements/HeadingTape'
import { drawRadarScope }        from './HUDElements/RadarScope'
import { drawWeaponsStatus }     from './HUDElements/WeaponsStatus'
import { drawThreatDisplay }     from './HUDElements/ThreatDisplay'

export class HUD {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private player: PlayerAircraft
  private entityManager: EntityManager

  constructor(canvas: HTMLCanvasElement, player: PlayerAircraft, entityManager: EntityManager) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.player = player
    this.entityManager = entityManager
  }

  render(): void {
    const { canvas: c, ctx, player } = this
    const state = player.state
    const radar = player.radar.state
    const rwr   = player.rwr.state
    const stores = state.loadedStores
    const selectedWeapon = player.getSelectedWeaponName()
    const gunRounds = player.gun.getRoundsRemaining()

    ctx.clearRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#00ff44'
    ctx.fillStyle   = '#00ff44'
    ctx.lineWidth   = 1.5
    ctx.font        = '12px monospace'

    const W = c.width, H = c.height
    const cx = W / 2, cy = H / 2

    // Heading tape — top center
    drawHeadingTape(ctx, cx, 8, state.headingDeg)

    // Attitude indicator — center
    drawAttitudeIndicator(ctx, cx, cy, state.pitchDeg, state.rollDeg)

    // IAS tape — left (iasKts → convert to m/s for drawAirspeed which shows knots internally)
    drawAirspeed(ctx, 30, cy, state.iasKts * 0.51444)

    // Altimeter tape — right
    drawAltimeter(ctx, W - 78, cy, state.altitudeM)

    // G-meter — lower left
    drawGMeter(ctx, 32, cy + 80, state.gCurrent, state.gMax)

    // Mach — lower right
    ctx.fillText(`M ${state.mach.toFixed(2)}`, W - 72, cy + 80)

    // VVI
    const vvi = Math.round(state.vviMps * 196.85)
    ctx.fillText(`VVI ${vvi >= 0 ? '+' : ''}${vvi}`, 32, cy - 80)

    // Weapons status — bottom left
    drawWeaponsStatus(ctx, 16, H - 48, stores, selectedWeapon, gunRounds)

    // Radar B-scope — bottom center
    drawRadarScope(ctx, cx - 60, H - 100, 120, 90, radar, state.positionNED)

    // RWR threat ring — bottom right
    drawThreatDisplay(ctx, W - 70, H - 60, rwr)

    // Flight path marker
    const betaPx  = (state.betaDeg  / 60) * (W / 2)
    const alphaPx = (state.alphaDeg / 40) * (H / 2)
    const fpmX = cx + betaPx, fpmY = cy - alphaPx
    ctx.beginPath()
    ctx.arc(fpmX, fpmY, 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(fpmX - 14, fpmY); ctx.lineTo(fpmX - 6,  fpmY)
    ctx.moveTo(fpmX + 6,  fpmY); ctx.lineTo(fpmX + 14, fpmY)
    ctx.moveTo(fpmX, fpmY - 6);  ctx.lineTo(fpmX, fpmY - 14)
    ctx.stroke()
  }

  resize(w: number, h: number): void {
    this.canvas.width  = w
    this.canvas.height = h
  }

  dispose(): void { /* canvas managed externally */ }
}
