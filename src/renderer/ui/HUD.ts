import * as THREE from 'three'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import type { EntityManager } from '../entities/EntityManager'
import type { Aircraft } from '../entities/Aircraft'
import { drawAttitudeIndicator } from './HUDElements/AttitudeIndicator'
import { drawAirspeed }          from './HUDElements/Airspeed'
import { drawAltimeter }         from './HUDElements/Altimeter'
import { drawGMeter }            from './HUDElements/GMeter'
import { drawHeadingTape }       from './HUDElements/HeadingTape'
import { drawRadarScope }        from './HUDElements/RadarScope'
import { drawWeaponsStatus }     from './HUDElements/WeaponsStatus'
import { drawThreatDisplay }     from './HUDElements/ThreatDisplay'

const G0 = 9.80665
const MIN_INTERCEPT_TIME_S = 0.05
const MAX_INTERCEPT_TIME_S = 5

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

  render(camera?: THREE.PerspectiveCamera): void {
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
    drawRadarScope(ctx, cx - 110, H - 185, 220, 170, radar, state.positionNED)

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

    // STT lock cues — world-space projection
    if (camera && radar.mode === 'STT' && radar.sttTargetId) {
      const enemies = this.entityManager.getEnemies()
      const target = enemies.find(e => e.entityId === radar.sttTargetId)
      if (target) {
        this.drawGunFunnel(ctx, camera, target, W, H)
        this.drawLockDiamond(ctx, camera, target, W, H)
      }
    }
  }

  private drawGunFunnel(
    ctx: CanvasRenderingContext2D,
    camera: THREE.PerspectiveCamera,
    target: Aircraft,
    W: number,
    H: number
  ): void {
    const gunSpec = this.player.spec.gunSpec
    if (!gunSpec || this.player.gun.getRoundsRemaining() <= 0) return

    const ownPos = this.player.state.positionNED
    const ownVel = this.player.state.velocityNED
    const tgtPos = target.state.positionNED
    const tgtVel = target.state.velocityNED

    const relPos: [number, number, number] = [
      tgtPos[0] - ownPos[0],
      tgtPos[1] - ownPos[1],
      tgtPos[2] - ownPos[2],
    ]
    const relVel: [number, number, number] = [
      tgtVel[0] - ownVel[0],
      tgtVel[1] - ownVel[1],
      tgtVel[2] - ownVel[2],
    ]

    const interceptT = this.solveInterceptTime(relPos, relVel, gunSpec.muzzleVelocityMS)
    if (!interceptT) return

    const leadAimNED: [number, number, number] = [
      tgtPos[0] + tgtVel[0] * interceptT,
      tgtPos[1] + tgtVel[1] * interceptT,
      tgtPos[2] + tgtVel[2] * interceptT - 0.5 * G0 * interceptT * interceptT,
    ]
    const leadScreen = this.projectNEDToScreen(camera, leadAimNED, W, H)
    if (!leadScreen) return

    const rangeM = Math.hypot(relPos[0], relPos[1], relPos[2])
    const wingspanM = Math.max(4, target.spec.mass.wingspanM)
    const angularSpanRad = 2 * Math.atan2(wingspanM * 0.5, Math.max(1, rangeM))
    const horizontalFovRad = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * camera.aspect)
    const pxPerRad = W / horizontalFovRad
    const halfSpanPx = THREE.MathUtils.clamp((angularSpanRad * 0.5) * pxPerRad, 12, W * 0.3)
    const bracketHalfHeightPx = THREE.MathUtils.clamp(halfSpanPx * 0.65, 14, 80)

    const leftX = leadScreen.x - halfSpanPx
    const rightX = leadScreen.x + halfSpanPx
    const topY = leadScreen.y - bracketHalfHeightPx
    const bottomY = leadScreen.y + bracketHalfHeightPx

    ctx.save()
    ctx.strokeStyle = rangeM <= gunSpec.maxRangeM ? '#00ff44' : '#ffb000'
    ctx.lineWidth = 2

    // Draw the range-driven funnel brackets (target wings should fit between these lines).
    ctx.beginPath()
    ctx.moveTo(leftX + 8, topY)
    ctx.bezierCurveTo(leftX - 6, topY + 8, leftX - 6, bottomY - 8, leftX + 8, bottomY)
    ctx.moveTo(rightX - 8, topY)
    ctx.bezierCurveTo(rightX + 6, topY + 8, rightX + 6, bottomY - 8, rightX - 8, bottomY)
    ctx.stroke()

    // LCOS pipper at lead+drop compensated impact point.
    const r = 10
    ctx.beginPath()
    ctx.arc(leadScreen.x, leadScreen.y, r, 0, Math.PI * 2)
    ctx.moveTo(leadScreen.x - 16, leadScreen.y)
    ctx.lineTo(leadScreen.x - 4, leadScreen.y)
    ctx.moveTo(leadScreen.x + 4, leadScreen.y)
    ctx.lineTo(leadScreen.x + 16, leadScreen.y)
    ctx.moveTo(leadScreen.x, leadScreen.y - 16)
    ctx.lineTo(leadScreen.x, leadScreen.y - 4)
    ctx.moveTo(leadScreen.x, leadScreen.y + 4)
    ctx.lineTo(leadScreen.x, leadScreen.y + 16)
    ctx.stroke()

    ctx.font = '11px monospace'
    ctx.fillStyle = ctx.strokeStyle
    ctx.fillText(`GUN LCOS ${Math.round(rangeM)}m`, leadScreen.x + 14, leadScreen.y - 14)
    ctx.restore()
  }

  private drawLockDiamond(
    ctx: CanvasRenderingContext2D,
    camera: THREE.PerspectiveCamera,
    target: Aircraft,
    W: number,
    H: number
  ): void {
    const screen = this.projectNEDToScreen(camera, target.state.positionNED, W, H)
    if (!screen) return

    const r = 22
    ctx.strokeStyle = '#ff2020'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(screen.x,     screen.y - r)  // top
    ctx.lineTo(screen.x + r, screen.y)      // right
    ctx.lineTo(screen.x,     screen.y + r)  // bottom
    ctx.lineTo(screen.x - r, screen.y)      // left
    ctx.closePath()
    ctx.stroke()

    // Inner cross-hairs
    ctx.beginPath()
    ctx.moveTo(screen.x - 5, screen.y); ctx.lineTo(screen.x + 5, screen.y)
    ctx.moveTo(screen.x, screen.y - 5); ctx.lineTo(screen.x, screen.y + 5)
    ctx.stroke()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#00ff44'
  }

  private projectNEDToScreen(
    camera: THREE.PerspectiveCamera,
    posNED: readonly [number, number, number],
    W: number,
    H: number
  ): { x: number; y: number } | null {
    // NED -> Three.js: x=East, y=Up, z=South.
    const worldVec = new THREE.Vector3(posNED[1], -posNED[2], -posNED[0])
    worldVec.project(camera)
    if (worldVec.z < -1 || worldVec.z > 1) return null
    const x = (worldVec.x + 1) * 0.5 * W
    const y = (1 - worldVec.y) * 0.5 * H
    return { x, y }
  }

  private solveInterceptTime(
    relPos: readonly [number, number, number],
    relVel: readonly [number, number, number],
    projectileSpeedMS: number
  ): number | null {
    const rDotV = relPos[0] * relVel[0] + relPos[1] * relVel[1] + relPos[2] * relVel[2]
    const rDotR = relPos[0] * relPos[0] + relPos[1] * relPos[1] + relPos[2] * relPos[2]
    const vDotV = relVel[0] * relVel[0] + relVel[1] * relVel[1] + relVel[2] * relVel[2]
    const speed2 = projectileSpeedMS * projectileSpeedMS

    const a = vDotV - speed2
    const b = 2 * rDotV
    const c = rDotR
    const eps = 1e-6

    let t: number | null = null
    if (Math.abs(a) < eps) {
      if (Math.abs(b) > eps) {
        const linearT = -c / b
        if (linearT > 0) t = linearT
      }
    } else {
      const disc = b * b - 4 * a * c
      if (disc >= 0) {
        const root = Math.sqrt(disc)
        const t1 = (-b - root) / (2 * a)
        const t2 = (-b + root) / (2 * a)
        const candidates = [t1, t2].filter(x => x > 0)
        if (candidates.length > 0) t = Math.min(...candidates)
      }
    }

    if (t == null) {
      const rangeM = Math.sqrt(rDotR)
      if (projectileSpeedMS > eps) t = rangeM / projectileSpeedMS
    }
    if (t == null) return null
    return THREE.MathUtils.clamp(t, MIN_INTERCEPT_TIME_S, MAX_INTERCEPT_TIME_S)
  }

  resize(w: number, h: number): void {
    this.canvas.width  = w
    this.canvas.height = h
  }

  dispose(): void { /* canvas managed externally */ }
}
