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

    // ── Bottom-center status strip ───────────────────────────────────────────
    ctx.font = '11px monospace'
    const stripY = H - 12
    const stripCX = cx

    // Gear indicator: solid box when down
    const gearLabel = 'GEAR'
    const gearW = 44, gearH = 16
    const gearX = stripCX - 108
    if (state.gearDown) {
      ctx.fillStyle = '#00ff44'
      ctx.fillRect(gearX, stripY - gearH + 2, gearW, gearH)
      ctx.fillStyle = '#000'
      ctx.fillText(gearLabel, gearX + 5, stripY - 1)
    } else {
      ctx.strokeStyle = '#226644'
      ctx.strokeRect(gearX, stripY - gearH + 2, gearW, gearH)
      ctx.fillStyle = '#226644'
      ctx.fillText(gearLabel, gearX + 5, stripY - 1)
    }

    // Flap position indicator: three segments [UP][TO][LDG]
    const flapLabels = ['UP', 'TO', 'LDG']
    const flapSegW = [28, 24, 32]
    let flapX = stripCX - 52
    for (let i = 0; i < 3; i++) {
      const active = state.flaps === i
      const segW = flapSegW[i]!
      if (active) {
        ctx.fillStyle = i === 0 ? '#226644' : '#00ff44'
        ctx.fillRect(flapX, stripY - gearH + 2, segW, gearH)
        ctx.fillStyle = i === 0 ? '#88bb88' : '#000'
      } else {
        ctx.strokeStyle = '#226644'
        ctx.strokeRect(flapX, stripY - gearH + 2, segW, gearH)
        ctx.fillStyle = '#226644'
      }
      ctx.fillText(flapLabels[i]!, flapX + 3, stripY - 1)
      flapX += segW + 2
    }

    // Speed brake indicator
    const sbW = 28, sbX = flapX + 4
    if (state.speedBrake) {
      ctx.fillStyle = '#00ff44'
      ctx.fillRect(sbX, stripY - gearH + 2, sbW, gearH)
      ctx.fillStyle = '#000'
      ctx.fillText('SB', sbX + 5, stripY - 1)
    } else {
      ctx.strokeStyle = '#226644'
      ctx.strokeRect(sbX, stripY - gearH + 2, sbW, gearH)
      ctx.fillStyle = '#226644'
      ctx.fillText('SB', sbX + 5, stripY - 1)
    }

    // Wheel brake indicator
    const brkW = 32, brkX = sbX + sbW + 4
    if (state.brakeHeld) {
      ctx.fillStyle = '#00ff44'
      ctx.fillRect(brkX, stripY - gearH + 2, brkW, gearH)
      ctx.fillStyle = '#000'
      ctx.fillText('BRK', brkX + 4, stripY - 1)
    } else {
      ctx.strokeStyle = '#226644'
      ctx.strokeRect(brkX, stripY - gearH + 2, brkW, gearH)
      ctx.fillStyle = '#226644'
      ctx.fillText('BRK', brkX + 4, stripY - 1)
    }

    // ── CMDS counters (lower left, above weapons panel) ───────────────────────
    ctx.font = '11px monospace'
    const cmdsX = 16
    const cmdsY = H - 60
    const flareCount = player.cmds.flareCount
    const chaffCount = player.cmds.chaffCount
    const flareColor = flareCount === 0 ? '#ff4444' : flareCount <= 5 ? '#ffaa00' : '#00ff44'
    const chaffColor = chaffCount === 0 ? '#ff4444' : chaffCount <= 5 ? '#ffaa00' : '#00ff44'
    ctx.fillStyle = '#88bb88'
    ctx.fillText('FLARE', cmdsX, cmdsY)
    ctx.fillStyle = flareColor
    ctx.fillText(String(flareCount).padStart(3, ' '), cmdsX + 40, cmdsY)
    ctx.fillStyle = '#88bb88'
    ctx.fillText('CHAFF', cmdsX, cmdsY + 14)
    ctx.fillStyle = chaffColor
    ctx.fillText(String(chaffCount).padStart(3, ' '), cmdsX + 40, cmdsY + 14)

    ctx.strokeStyle = '#00ff44'
    ctx.fillStyle   = '#00ff44'
    ctx.font        = '12px monospace'

    // STT lock cues — world-space projection
    if (camera && radar.mode === 'STT' && radar.sttTargetId) {
      const enemies = this.entityManager.getEnemies()
      const target = enemies.find(e => e.entityId === radar.sttTargetId)
      if (target) {
        this.drawGunFunnel(ctx, camera, target, W, H)
        this.drawLockDiamond(ctx, camera, target, W, H)
      }
    }

    if (camera) this.drawSituationalMarkers(ctx, camera, W, H)
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

  private drawSituationalMarkers(
    ctx: CanvasRenderingContext2D,
    camera: THREE.PerspectiveCamera,
    W: number,
    H: number
  ): void {
    const ownPos = this.player.state.positionNED

    ctx.save()
    ctx.lineWidth = 1.5
    ctx.font = '10px monospace'

    // Enemy aircraft markers: yellow square + range text.
    for (const enemy of this.entityManager.getEnemies()) {
      const screen = this.projectNEDToScreen(camera, enemy.state.positionNED, W, H)
      if (!screen) continue

      const dx = enemy.state.positionNED[0] - ownPos[0]
      const dy = enemy.state.positionNED[1] - ownPos[1]
      const dz = enemy.state.positionNED[2] - ownPos[2]
      const rangeM = Math.hypot(dx, dy, dz)
      if (rangeM > 120000) continue

      const r = THREE.MathUtils.clamp(12 - rangeM / 12000, 5, 12)
      ctx.strokeStyle = '#ffd54d'
      ctx.beginPath()
      ctx.rect(screen.x - r, screen.y - r, r * 2, r * 2)
      ctx.stroke()
      ctx.fillStyle = '#ffd54d'
      ctx.fillText(`${(rangeM / 1000).toFixed(1)}km`, screen.x + r + 4, screen.y - r - 2)
    }

    // Missiles: own missiles and inbound-to-player missiles get distinct marker colors.
    const ownMissiles = this.player.missiles.getMissiles().filter(m => m.active)
    for (const m of ownMissiles) {
      const screen = this.projectNEDToScreen(camera, m.positionNED, W, H)
      if (!screen) continue
      ctx.strokeStyle = '#66ccff'
      this.drawDiamond(ctx, screen.x, screen.y, 7)
    }

    const inbound = this.entityManager.getInboundMissiles(['player'])
    for (const m of inbound) {
      const screen = this.projectNEDToScreen(camera, m.positionNED, W, H)
      if (!screen) continue
      ctx.strokeStyle = '#ff6aa8'
      this.drawDiamond(ctx, screen.x, screen.y, 8)
    }

    ctx.restore()
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath()
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r, y)
    ctx.lineTo(x, y + r)
    ctx.lineTo(x - r, y)
    ctx.closePath()
    ctx.stroke()
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
