import * as THREE from 'three'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import type { EntityManager } from '../entities/EntityManager'
import type { Aircraft } from '../entities/Aircraft'
import type { MissileState } from '../types/weapons'
import { drawAttitudeIndicator } from './HUDElements/AttitudeIndicator'
import { drawAirspeed }          from './HUDElements/Airspeed'
import { drawAltimeter }         from './HUDElements/Altimeter'
import { drawGMeter }            from './HUDElements/GMeter'
import { drawHeadingTape }       from './HUDElements/HeadingTape'
import { drawRadarScope }        from './HUDElements/RadarScope'
import { drawWeaponsStatus }     from './HUDElements/WeaponsStatus'
import { drawThrottleBar }       from './HUDElements/ThrottleBar'
import { drawFuelGauge }         from './HUDElements/FuelGauge'
import { drawThreatDisplay }     from './HUDElements/ThreatDisplay'
import { drawFLIRPage } from '../cockpit/MFDPages/FLIRPage'
import { AIM120B } from '../data/weapons/aim120b'
import { R77 } from '../data/weapons/r77'
import type { LoadedStore, MissileSpec } from '../types/weapons'
import { MISSILE_SPECS } from '../data/weapons/catalog'
import { computeAtmosphere } from '../physics/Atmosphere'
import { quatRotateVec, v3len } from '../utils/MathUtils'

const G0 = 9.80665
const MIN_INTERCEPT_TIME_S = 0.05
const MAX_INTERCEPT_TIME_S = 5
const MAX_HUD_TTI_LINES = 3
const ARH_MISSILE_RANGES_M: Record<string, number> = {
  aim120b: AIM120B.maxRangeM,
  r77: R77.maxRangeM,
}

interface LARInfo {
  rangeM: number
  rMinM: number
  rNeM: number
  rMaxM: number
  inRange: boolean
  inNoEscapeZone: boolean
}

interface MissileTTIInfo {
  missile: MissileState
  timeToImpactSec: number | null
  pitbull: boolean
}

interface MissileLeadSolution {
  interceptTimeSec: number
  aimPointNED: [number, number, number]
  offBoresightDeg: number
  targetRangeM: number
}

export class HUD {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private player: PlayerAircraft
  private entityManager: EntityManager
  /** Remaining display time (sec) for the decoy-success flash cue. */
  private decoyFlashRemainSec = 0
  private decoyFlashType: 'FLARE' | 'CHAFF' | null = null
  private wmCmdFlashRemainSec = 0
  private lastWmCmdSeen: string | null = null
  private lastRenderMs = 0
  private gunFunnelState: {
    x: number
    y: number
    fitY: number
    rangeM: number
    lastTsMs: number
    initialized: boolean
  } = {
    x: 0,
    y: 0,
    fitY: 0,
    rangeM: 0,
    lastTsMs: 0,
    initialized: false,
  }

  constructor(canvas: HTMLCanvasElement, player: PlayerAircraft, entityManager: EntityManager) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.player = player
    this.entityManager = entityManager
  }

  /** Called by the missile system when a decoy (flare or chaff) successfully seduces a missile. */
  notifyDecoySuccess(type: 'FLARE' | 'CHAFF'): void {
    this.decoyFlashRemainSec = 2.0
    this.decoyFlashType = type
  }

  render(camera?: THREE.PerspectiveCamera): void {
    const { canvas: c, ctx, player } = this
    const state = player.state
    const radar = player.radar.state
    const rwr   = player.rwr.state
    const stores = state.loadedStores
    const selectedWeapon = player.getSelectedWeaponName()
    const gunRounds = player.gun.getRoundsRemaining()

    // Advance decoy flash timer using wall-clock delta
    const nowMs = performance.now()
    const dtSec = Math.min((nowMs - this.lastRenderMs) / 1000, 0.1)
    this.lastRenderMs = nowMs
    if (this.decoyFlashRemainSec > 0) this.decoyFlashRemainSec = Math.max(0, this.decoyFlashRemainSec - dtSec)
    if (this.wmCmdFlashRemainSec > 0) this.wmCmdFlashRemainSec = Math.max(0, this.wmCmdFlashRemainSec - dtSec)

    ctx.clearRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#00ff44'
    ctx.fillStyle   = '#00ff44'
    ctx.lineWidth   = 1.5
    ctx.font        = '12px monospace'

    const W = c.width, H = c.height
    const cx = W / 2, cy = H / 2
    const uiScale = THREE.MathUtils.clamp(Math.min(W / 1920, H / 1080), 0.75, 1.35)
    const edgePadX = Math.round(THREE.MathUtils.clamp(W * 0.014, 10, 34))
    const edgePadY = Math.round(THREE.MathUtils.clamp(H * 0.014, 8, 24))
    const headingBandH = Math.round(THREE.MathUtils.clamp(30 * uiScale, 22, 38))
    const bottomInfoReserve = Math.round(THREE.MathUtils.clamp(68 * uiScale, 52, 92))
    const sideTapeOffset = Math.round(THREE.MathUtils.clamp(W * 0.24, 170, 370))
    const airspeedX = Math.max(edgePadX, Math.round(cx - sideTapeOffset - 22))
    const altimeterX = Math.min(W - edgePadX - 44, Math.round(cx + sideTapeOffset - 22))
    const gMeterX = airspeedX + 2
    const vviX = airspeedX + 2
    const lowerClusterY = Math.round(cy + THREE.MathUtils.clamp(H * 0.11, 74, 142))
    const radarW = Math.round(THREE.MathUtils.clamp(220 * uiScale, 185, 270))
    const radarH = Math.round(THREE.MathUtils.clamp(170 * uiScale, 145, 210))
    const radarX = Math.round(cx - radarW / 2)
    const radarY = Math.min(H - bottomInfoReserve - edgePadY - radarH, Math.round(lowerClusterY))
    const threatCx = THREE.MathUtils.clamp(
      Math.round(cx + radarW * 0.5 + 120 * uiScale),
      Math.round(cx + radarW * 0.5 + 80),
      W - edgePadX - 62
    )
    const threatCy = THREE.MathUtils.clamp(
      Math.round(radarY + radarH * 0.55),
      edgePadY + headingBandH + 66,
      H - bottomInfoReserve - 62
    )
    const ttiPanelX = W - edgePadX - 146
    const ttiPanelY = edgePadY + headingBandH + 6
    const larX = THREE.MathUtils.clamp(
      Math.round(altimeterX - THREE.MathUtils.clamp(58 * uiScale, 44, 74)),
      Math.round(cx + 68),
      W - edgePadX - 12
    )
    const larY = THREE.MathUtils.clamp(
      Math.round(cy - 118 * uiScale),
      ttiPanelY + 66,
      H - bottomInfoReserve - 134 - 16
    )
    const weaponsY = H - edgePadY
    const cmdsY = weaponsY - Math.round(36 * uiScale)

    // Heading tape — top center
    drawHeadingTape(ctx, cx, edgePadY, state.headingDeg)

    // Attitude indicator — center
    drawAttitudeIndicator(ctx, cx, cy, state.pitchDeg, state.rollDeg)

    // IAS tape — left (iasKts → convert to m/s for drawAirspeed which shows knots internally)
    drawAirspeed(ctx, airspeedX, cy, state.iasKts * 0.51444)

    // Altimeter tape — right
    drawAltimeter(ctx, altimeterX, cy, state.altitudeM)

    // G-meter — lower left
    drawGMeter(ctx, gMeterX, cy + 80 * uiScale, state.gCurrent, state.gMax)

    // Throttle bar — lower left, right of G-meter
    drawThrottleBar(
      ctx,
      gMeterX + 80,
      cy + 50 * uiScale,
      state.throttle,
      player.spec.engine.afterburnerThrottleMin,
      uiScale,
    )

    // Fuel gauge — lower left, right of throttle bar
    drawFuelGauge(
      ctx,
      gMeterX + 106,
      cy + 50 * uiScale,
      state.fuelKg,
      player.spec.mass.fuelCapacityKg,
      uiScale,
    )

    // Fuel state warning — flashes BINGO at 20% / EMERGENCY at 10%
    const fuelFrac = state.fuelKg / Math.max(player.spec.mass.fuelCapacityKg, 1)
    if (fuelFrac < 0.2) {
      const flashOn = (Math.floor(performance.now() / 400) & 1) === 0
      if (flashOn) {
        const emergency = fuelFrac < 0.1
        const label = emergency ? 'FUEL EMERG' : 'BINGO FUEL'
        ctx.font = `bold ${Math.round(13 * uiScale)}px monospace`
        ctx.fillStyle = emergency ? '#ff2020' : '#ffaa00'
        ctx.textAlign = 'left'
        ctx.fillText(label, gMeterX + 106, cy + 50 * uiScale - 8)
      }
    }

    // Mach — lower right
    ctx.fillText(`M ${state.mach.toFixed(2)}`, altimeterX + 2, cy + 80 * uiScale)

    // VVI
    const vvi = Math.round(state.vviMps * 196.85)
    ctx.fillText(`VVI ${vvi >= 0 ? '+' : ''}${vvi}`, vviX, cy - 80 * uiScale)

    // Weapons status — bottom left
    drawWeaponsStatus(ctx, edgePadX, weaponsY, stores, selectedWeapon, gunRounds)

    // Radar B-scope — bottom center
    drawRadarScope(ctx, radarX, radarY, radarW, radarH, radar, state.positionNED, state.attitudeQuat)

    // RWR threat ring — bottom right
    drawThreatDisplay(ctx, threatCx, threatCy, rwr, performance.now() / 1000)
    this.drawMissileTTIPanel(ctx, ttiPanelX, ttiPanelY)
    this.drawLAR(ctx, larX, larY)

    // Targeting pod FLIR view — top-right corner overlay when active
    if (player.targetingPod.state.active) {
      const flirSize = Math.round(180 * uiScale)
      const flirX = W - edgePadX - flirSize
      const flirY = headingBandH + edgePadY + 4
      // Draw into a temporary offscreen canvas to keep coordinate math local
      ctx.save()
      ctx.translate(flirX, flirY)
      // Border
      ctx.strokeStyle = '#00ff44'
      ctx.lineWidth = 1
      ctx.strokeRect(0, 0, flirSize, flirSize)
      ctx.beginPath()
      ctx.rect(0, 0, flirSize, flirSize)
      ctx.clip()
      drawFLIRPage(ctx, flirSize, flirSize, player.targetingPod.state, state.positionNED, this.entityManager.getGroundTargets())
      ctx.restore()
    }

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
    const stripY = H - Math.max(10, edgePadY - 2)
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
    const cmdsX = edgePadX
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

    // Decoy-success flash: "DECOY" in bright amber with fade-out
    if (this.decoyFlashRemainSec > 0 && this.decoyFlashType) {
      const alpha = Math.min(1, this.decoyFlashRemainSec * 2)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = 'bold 13px monospace'
      ctx.fillStyle = '#ffcc00'
      ctx.fillText('DECOY', cmdsX, cmdsY + 30)
      ctx.restore()
    }

    // ── Wingman command indicator (upper-left, below heading tape) ───────────
    if (this.entityManager.getWingmen().length > 0) {
      const wmCmd = this.entityManager.getLastWingmanCommand()
      const wmCmdKey = wmCmd ?? '----'
      if (wmCmdKey !== this.lastWmCmdSeen) {
        if (wmCmd !== null) this.wmCmdFlashRemainSec = 2.0
        this.lastWmCmdSeen = wmCmdKey
      }
      const wmFlashing = this.wmCmdFlashRemainSec > 0
      const wmX = edgePadX
      const wmY = edgePadY + headingBandH + 18
      const badgeW = 56, badgeH = 16
      ctx.font = '11px monospace'
      ctx.fillStyle = '#226644'
      ctx.textAlign = 'left'
      ctx.fillText('WM', wmX, wmY - 1)
      const badgeX = wmX + 22
      if (wmFlashing) {
        ctx.fillStyle = '#00ff44'
        ctx.fillRect(badgeX, wmY - badgeH + 2, badgeW, badgeH)
        ctx.fillStyle = '#000'
        ctx.fillText(wmCmdKey, badgeX + 4, wmY - 1)
      } else {
        ctx.strokeStyle = wmCmd !== null ? '#00ff44' : '#226644'
        ctx.lineWidth = 1
        ctx.strokeRect(badgeX, wmY - badgeH + 2, badgeW, badgeH)
        ctx.fillStyle = wmCmd !== null ? '#00ff44' : '#226644'
        ctx.fillText(wmCmdKey, badgeX + 4, wmY - 1)
      }
    }

    ctx.strokeStyle = '#00ff44'
    ctx.fillStyle   = '#00ff44'
    ctx.font        = '12px monospace'

    // STT lock cues — world-space projection
    if (camera && radar.mode === 'STT' && radar.sttTargetId) {
      const enemies = this.entityManager.getEnemies()
      const target = enemies.find(e => e.entityId === radar.sttTargetId)
      if (target) {
        this.drawGunFunnel(ctx, camera, target, W, H)
        this.drawLockDiamond(ctx, camera, target, W, H, this.shouldShowRadarShootCue(target))
        this.drawMissileLeadIndicator(ctx, camera, target, W, H)
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
    const horizontalFovRad = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * camera.aspect)
    const pxPerRad = W / horizontalFovRad
    const nearRangeM = 180
    const farRangeM = THREE.MathUtils.clamp(gunSpec.maxRangeM * 0.8, 800, 1600)
    const nowMs = performance.now()
    const dtSec = this.gunFunnelState.lastTsMs > 0
      ? Math.min(0.1, Math.max(0.001, (nowMs - this.gunFunnelState.lastTsMs) / 1000))
      : 1 / 60
    this.gunFunnelState.lastTsMs = nowMs

    const pipperTrackAlpha = this.computeSmoothingAlpha(dtSec, 0.11)
    const rangeTrackAlpha = this.computeSmoothingAlpha(dtSec, 0.18)

    if (!this.gunFunnelState.initialized) {
      this.gunFunnelState.x = leadScreen.x
      this.gunFunnelState.y = leadScreen.y
      this.gunFunnelState.fitY = leadScreen.y
      this.gunFunnelState.rangeM = rangeM
      this.gunFunnelState.initialized = true
    } else {
      this.gunFunnelState.x = THREE.MathUtils.lerp(this.gunFunnelState.x, leadScreen.x, pipperTrackAlpha)
      this.gunFunnelState.y = THREE.MathUtils.lerp(this.gunFunnelState.y, leadScreen.y, pipperTrackAlpha)
      this.gunFunnelState.rangeM = THREE.MathUtils.lerp(this.gunFunnelState.rangeM, rangeM, rangeTrackAlpha)
    }

    const funnelTopY = this.gunFunnelState.y - 12
    const funnelHeightPx = THREE.MathUtils.clamp(H * 0.2, 95, 165)
    const railSteps = 18
    const leftRail: Array<{x: number; y: number}> = []
    const rightRail: Array<{x: number; y: number}> = []
    for (let i = 0; i < railSteps; i++) {
      const t = i / (railSteps - 1)
      // Far range at top, near range at bottom for a realistic funnel profile.
      const sampleRangeM = THREE.MathUtils.lerp(farRangeM, nearRangeM, t)
      const angularHalfSpanRad = Math.atan2(wingspanM * 0.5, sampleRangeM)
      const halfWidthPx = THREE.MathUtils.clamp(angularHalfSpanRad * pxPerRad, 9, W * 0.34)
      const y = funnelTopY + t * funnelHeightPx
      leftRail.push({ x: this.gunFunnelState.x - halfWidthPx, y })
      rightRail.push({ x: this.gunFunnelState.x + halfWidthPx, y })
    }

    ctx.save()
    ctx.strokeStyle = rangeM <= gunSpec.maxRangeM ? '#00ff44' : '#ffb000'
    ctx.lineWidth = 2

    // Draw realistic stadiametric funnel rails (fit target wings between rails).
    ctx.beginPath()
    for (let i = 0; i < leftRail.length; i++) {
      const p = leftRail[i]!
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    for (let i = 0; i < rightRail.length; i++) {
      const p = rightRail[i]!
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()

    // Range reference gates (distance where target wingspan should match rail spacing).
    const gateRangesM = [1200, 900, 600, 400]
    ctx.lineWidth = 1.5
    for (const gateRangeM of gateRangesM) {
      const gateT = THREE.MathUtils.clamp((farRangeM - gateRangeM) / Math.max(1, farRangeM - nearRangeM), 0, 1)
      const gateY = funnelTopY + gateT * funnelHeightPx
      const angularHalfSpanRad = Math.atan2(wingspanM * 0.5, Math.max(nearRangeM, gateRangeM))
      const gateHalfWidthPx = THREE.MathUtils.clamp(angularHalfSpanRad * pxPerRad, 9, W * 0.34)
      const innerGap = 9
      ctx.beginPath()
      ctx.moveTo(this.gunFunnelState.x - gateHalfWidthPx, gateY)
      ctx.lineTo(this.gunFunnelState.x - innerGap, gateY)
      ctx.moveTo(this.gunFunnelState.x + innerGap, gateY)
      ctx.lineTo(this.gunFunnelState.x + gateHalfWidthPx, gateY)
      ctx.stroke()
    }

    // Show the current target-size fit band on the funnel.
    const rangeT = THREE.MathUtils.clamp((farRangeM - this.gunFunnelState.rangeM) / Math.max(1, farRangeM - nearRangeM), 0, 1)
    const desiredFitY = funnelTopY + rangeT * funnelHeightPx
    this.gunFunnelState.fitY = THREE.MathUtils.lerp(this.gunFunnelState.fitY, desiredFitY, rangeTrackAlpha)
    const currentHalfSpanPx = THREE.MathUtils.clamp(Math.atan2(wingspanM * 0.5, Math.max(nearRangeM, this.gunFunnelState.rangeM)) * pxPerRad, 9, W * 0.34)
    ctx.beginPath()
    ctx.moveTo(this.gunFunnelState.x - currentHalfSpanPx, this.gunFunnelState.fitY)
    ctx.lineTo(this.gunFunnelState.x + currentHalfSpanPx, this.gunFunnelState.fitY)
    ctx.stroke()

    // LCOS pipper at lead+drop compensated impact point (realistic small ring + center dot).
    const r = 9
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(this.gunFunnelState.x, this.gunFunnelState.y, r, 0, Math.PI * 2)
    ctx.moveTo(this.gunFunnelState.x - 15, this.gunFunnelState.y)
    ctx.lineTo(this.gunFunnelState.x - 5, this.gunFunnelState.y)
    ctx.moveTo(this.gunFunnelState.x + 5, this.gunFunnelState.y)
    ctx.lineTo(this.gunFunnelState.x + 15, this.gunFunnelState.y)
    ctx.moveTo(this.gunFunnelState.x, this.gunFunnelState.y - 15)
    ctx.lineTo(this.gunFunnelState.x, this.gunFunnelState.y - 5)
    ctx.moveTo(this.gunFunnelState.x, this.gunFunnelState.y + 5)
    ctx.lineTo(this.gunFunnelState.x, this.gunFunnelState.y + 15)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(this.gunFunnelState.x, this.gunFunnelState.y, 2.2, 0, Math.PI * 2)
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()

    ctx.font = '11px monospace'
    ctx.fillStyle = ctx.strokeStyle
    ctx.fillText(`${Math.round(this.gunFunnelState.rangeM)}m`, this.gunFunnelState.x + 13, this.gunFunnelState.y - 14)
    ctx.restore()
  }

  private computeSmoothingAlpha(dtSec: number, timeConstantSec: number): number {
    return 1 - Math.exp(-dtSec / Math.max(0.001, timeConstantSec))
  }

  private drawLockDiamond(
    ctx: CanvasRenderingContext2D,
    camera: THREE.PerspectiveCamera,
    target: Aircraft,
    W: number,
    H: number,
    showShootCue: boolean
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
    if (showShootCue) {
      ctx.fillStyle = '#00ff44'
      ctx.font = 'bold 13px monospace'
      ctx.fillText('SHOOT', screen.x + r + 10, screen.y + 4)
      ctx.font = '12px monospace'
    }
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#00ff44'
  }

  private drawMissileLeadIndicator(
    ctx: CanvasRenderingContext2D,
    camera: THREE.PerspectiveCamera,
    target: Aircraft,
    W: number,
    H: number
  ): void {
    const selectedStore = this.getSelectedMissileStore()
    if (!selectedStore) return
    const missileSpec = MISSILE_SPECS[selectedStore.weaponId]
    if (!missileSpec) return

    const solution = this.computeMissileLeadSolution(missileSpec, target)
    if (!solution) return

    const leadScreen = this.projectNEDToScreen(camera, solution.aimPointNED, W, H)
    if (!leadScreen) return

    const targetScreen = this.projectNEDToScreen(camera, target.state.positionNED, W, H)
    if (!targetScreen) return

    const seekerLimitDeg = this.getMissileSeekerLimitDeg(missileSpec)
    const optimalLaunchDeg = this.computeMissileOptimalLaunchAngleDeg(missileSpec, solution.targetRangeM)
    const hardLimitDeg = Math.max(optimalLaunchDeg + 1, seekerLimitDeg)
    const cueColor =
      solution.offBoresightDeg <= optimalLaunchDeg ? '#00ff44' :
      solution.offBoresightDeg <= hardLimitDeg ? '#ffb000' : '#ff4040'

    const horizontalFovDeg = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * camera.aspect)
    )
    const pxPerDeg = W / Math.max(1, horizontalFovDeg)
    const centerX = W * 0.5
    const centerY = H * 0.5
    const optRadiusPx = THREE.MathUtils.clamp(optimalLaunchDeg * pxPerDeg, 18, Math.min(W, H) * 0.18)
    const maxRadiusPx = THREE.MathUtils.clamp(hardLimitDeg * pxPerDeg, optRadiusPx + 8, Math.min(W, H) * 0.28)

    ctx.save()
    ctx.strokeStyle = cueColor
    ctx.fillStyle = cueColor
    ctx.lineWidth = 1.7
    ctx.font = '11px monospace'

    // Steering line from boresight to dynamic lead point.
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(leadScreen.x, leadScreen.y)
    ctx.stroke()
    ctx.setLineDash([])

    // Predicted missile lead pipper.
    this.drawDiamond(ctx, leadScreen.x, leadScreen.y, 10)
    ctx.beginPath()
    ctx.moveTo(leadScreen.x - 5, leadScreen.y)
    ctx.lineTo(leadScreen.x + 5, leadScreen.y)
    ctx.moveTo(leadScreen.x, leadScreen.y - 5)
    ctx.lineTo(leadScreen.x, leadScreen.y + 5)
    ctx.stroke()

    // Lightweight target marker to align with lead pipper.
    ctx.globalAlpha = 0.75
    this.drawDiamond(ctx, targetScreen.x, targetScreen.y, 7)
    ctx.globalAlpha = 1.0

    // Launch-angle tick around boresight.
    const angleNorm = THREE.MathUtils.clamp(solution.offBoresightDeg / Math.max(1, hardLimitDeg), 0, 1)
    const angleRadiusPx = THREE.MathUtils.lerp(optRadiusPx, maxRadiusPx, Math.pow(angleNorm, 1.2))
    const theta = Math.atan2(leadScreen.y - centerY, leadScreen.x - centerX)
    const tickHalfLen = 8
    const tx = centerX + Math.cos(theta) * angleRadiusPx
    const ty = centerY + Math.sin(theta) * angleRadiusPx
    const nx = -Math.sin(theta)
    const ny = Math.cos(theta)
    ctx.beginPath()
    ctx.moveTo(tx - nx * tickHalfLen, ty - ny * tickHalfLen)
    ctx.lineTo(tx + nx * tickHalfLen, ty + ny * tickHalfLen)
    ctx.stroke()

    const angleText = `${solution.offBoresightDeg.toFixed(0)}°`
    ctx.fillText(`ANG ${angleText}`, leadScreen.x + 12, leadScreen.y - 4)
    ctx.restore()
  }

  private shouldShowRadarShootCue(target: Aircraft): boolean {
    const selectedStore = this.getSelectedMissileStore()
    if (!selectedStore || selectedStore.category !== 'ARH_MISSILE') return false

    const maxRangeM = ARH_MISSILE_RANGES_M[selectedStore.weaponId]
    if (!maxRangeM) return false

    const ownPos = this.player.state.positionNED
    const tgtPos = target.state.positionNED
    const rangeM = Math.hypot(
      tgtPos[0] - ownPos[0],
      tgtPos[1] - ownPos[1],
      tgtPos[2] - ownPos[2]
    )
    return rangeM <= maxRangeM
  }

  isRadarShootCueActive(): boolean {
    const radar = this.player.radar.state
    if (radar.mode !== 'STT' || !radar.sttTargetId) return false
    const target = this.entityManager.getEnemies().find(e => e.entityId === radar.sttTargetId)
    if (!target) return false
    return this.shouldShowRadarShootCue(target)
  }

  private drawLAR(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const selectedStore = this.getSelectedMissileStore()
    if (!selectedStore) return
    const missileSpec = MISSILE_SPECS[selectedStore.weaponId]
    if (!missileSpec) return

    const target = this.getCurrentTargetForLAR()
    const barH = 134
    const barW = 12

    ctx.save()
    ctx.lineWidth = 1.2
    ctx.font = '10px monospace'

    // Base frame and labels stay visible whenever a missile is selected.
    ctx.strokeStyle = '#00ff44'
    ctx.fillStyle = '#00ff44'
    ctx.strokeRect(x, y, barW, barH)
    ctx.fillText('LAR', x - 20, y - 6)
    ctx.fillText(missileSpec.id.toUpperCase(), x - 46, y + barH + 12)

    if (!target) {
      ctx.fillStyle = '#88bb88'
      ctx.fillText('NO TGT', x - 44, y + barH + 25)
      ctx.restore()
      return
    }

    const lar = this.computeLARInfo(missileSpec, target)
    if (!lar) {
      ctx.restore()
      return
    }

    // Draw no-escape region (Rmin..Rne) as a solid filled segment.
    const yRMin = y + barH
    const yRNe = this.rangeToLARY(lar.rNeM, lar.rMinM, lar.rMaxM, y, barH)
    ctx.fillStyle = 'rgba(0, 255, 68, 0.25)'
    ctx.fillRect(x + 1, yRNe, barW - 2, yRMin - yRNe)

    // Reference lines.
    ctx.strokeStyle = '#00ff44'
    this.drawHorizontalTick(ctx, x - 6, x + barW + 6, y, 'RMAX')
    this.drawHorizontalTick(ctx, x - 6, x + barW + 6, yRNe, 'RNE')
    this.drawHorizontalTick(ctx, x - 6, x + barW + 6, yRMin, 'RMIN')

    // Target range caret.
    const targetY = this.rangeToLARY(lar.rangeM, lar.rMinM, lar.rMaxM, y, barH)
    const caretY = THREE.MathUtils.clamp(targetY, y - 8, y + barH + 8)
    const caretColor = lar.inRange ? '#00ff44' : '#ffb000'
    ctx.strokeStyle = caretColor
    ctx.fillStyle = caretColor
    ctx.beginPath()
    ctx.moveTo(x - 10, caretY)
    ctx.lineTo(x - 2, caretY - 4)
    ctx.lineTo(x - 2, caretY + 4)
    ctx.closePath()
    ctx.stroke()
    ctx.fill()

    const statusText = lar.inNoEscapeZone ? 'IN NEZ' : lar.inRange ? 'IN LAR' : lar.rangeM > lar.rMaxM ? 'OUT RNG' : 'TOO CLOSE'
    ctx.fillText(statusText, x - 45, y - 18)
    ctx.fillText(`${(lar.rangeM / 1000).toFixed(1)}km`, x - 45, y - 30)
    ctx.restore()
  }

  private drawHorizontalTick(
    ctx: CanvasRenderingContext2D,
    x0: number,
    x1: number,
    y: number,
    label: string
  ): void {
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
    ctx.fillText(label, x1 + 3, y + 3)
  }

  private rangeToLARY(rangeM: number, rMinM: number, rMaxM: number, y: number, barH: number): number {
    const norm = THREE.MathUtils.clamp((rangeM - rMinM) / Math.max(1, rMaxM - rMinM), 0, 1)
    return y + barH - norm * barH
  }

  private computeLARInfo(missileSpec: MissileSpec, target: Aircraft): LARInfo | null {
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
    const rangeM = Math.hypot(relPos[0], relPos[1], relPos[2])
    if (!Number.isFinite(rangeM) || rangeM < 1) return null

    const rangeRate = (
      relPos[0] * relVel[0] +
      relPos[1] * relVel[1] +
      relPos[2] * relVel[2]
    ) / rangeM
    const closingMS = -rangeRate
    const ownAltM = Math.max(0, -this.player.state.positionNED[2])
    const altFactor = THREE.MathUtils.clamp(0.8 + ownAltM / 50000, 0.8, 1.2)
    const closureFactor = THREE.MathUtils.clamp(0.55 + (closingMS + 120) / 520, 0.45, 1.15)

    let rMaxM = missileSpec.maxRangeM * altFactor * closureFactor
    let rMinM = missileSpec.category === 'ARH_MISSILE' ? 1800 : 500
    rMinM += Math.max(0, -closingMS) * 5
    rMinM = THREE.MathUtils.clamp(rMinM, 300, missileSpec.maxRangeM * 0.5)
    rMaxM = Math.max(rMinM + 1000, rMaxM)

    const nezSpan = missileSpec.category === 'ARH_MISSILE' ? 0.62 : 0.52
    const rNeM = THREE.MathUtils.clamp(rMinM + (rMaxM - rMinM) * nezSpan, rMinM + 300, rMaxM - 250)
    return {
      rangeM,
      rMinM,
      rNeM,
      rMaxM,
      inRange: rangeM >= rMinM && rangeM <= rMaxM,
      inNoEscapeZone: rangeM >= rMinM && rangeM <= rNeM,
    }
  }

  private getCurrentTargetForLAR(): Aircraft | null {
    const sttTargetId = this.player.radar.state.sttTargetId
    const hmsTargetId = this.player.hms.state.lockedEntityId
    const targetId = sttTargetId ?? hmsTargetId
    if (!targetId) return null
    return this.entityManager.getEnemies().find(e => e.entityId === targetId) ?? null
  }

  private getSelectedMissileStore(): LoadedStore | null {
    const selectedWeaponId = this.player.getSelectedWeaponName().toLowerCase()
    return this.player.state.loadedStores.find(s =>
      s.weaponId === selectedWeaponId &&
      (s.category === 'IR_MISSILE' || s.category === 'ARH_MISSILE') &&
      s.remainingRounds > 0
    ) ?? null
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
      const pitbull = m.spec.category === 'ARH_MISSILE' && m.guidanceMode === 'ACTIVE'
      ctx.strokeStyle = pitbull ? '#ffe66d' : '#66ccff'
      ctx.fillStyle = pitbull ? '#ffe66d' : '#66ccff'
      if (pitbull) {
        this.fillDiamond(ctx, screen.x, screen.y, 7)
      } else {
        this.drawDiamond(ctx, screen.x, screen.y, 7)
      }
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

  private fillDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath()
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r, y)
    ctx.lineTo(x, y + r)
    ctx.lineTo(x - r, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  private drawMissileTTIPanel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const ttiEntries = this.collectMissileTTIInfo()
    if (ttiEntries.length === 0) return

    const panelW = 146
    const panelH = 20 + MAX_HUD_TTI_LINES * 14

    ctx.save()
    ctx.strokeStyle = '#00ff44'
    ctx.fillStyle = '#00ff44'
    ctx.lineWidth = 1.2
    ctx.font = '11px monospace'
    ctx.strokeRect(x, y, panelW, panelH)
    ctx.fillText('MSL TTI', x + 6, y + 12)

    const visible = ttiEntries.slice(0, MAX_HUD_TTI_LINES)
    for (let i = 0; i < visible.length; i++) {
      const entry = visible[i]!
      const sym = entry.pitbull ? 'A' : 'M'
      const mode = entry.pitbull ? 'PB' : entry.missile.guidanceMode === 'COAST' ? 'MEM' : 'TRK'
      const ttiTxt = entry.timeToImpactSec === null || entry.timeToImpactSec === undefined
        ? '--.-'
        : Math.max(0, Math.min(99.9, entry.timeToImpactSec)).toFixed(1)
      ctx.fillStyle = entry.pitbull ? '#ffe66d' : '#00ff44'
      ctx.fillText(`${sym}${i + 1} ${ttiTxt}s ${mode}`, x + 6, y + 26 + i * 14)
    }

    ctx.restore()
  }

  private collectMissileTTIInfo(): MissileTTIInfo[] {
    const enemies = this.entityManager.getEnemies()
    const ownMissiles = this.player.missiles.getMissiles().filter(m => m.active)
    const entries = ownMissiles.map(missile => {
      const target = enemies.find(e => e.entityId === missile.targetEntityId)
      const targetPos = target?.state.positionNED ?? missile.lastKnownTargetPos
      const targetVel = target?.state.velocityNED ?? missile.lastKnownTargetVel
      return {
        missile,
        pitbull: missile.spec.category === 'ARH_MISSILE' && missile.guidanceMode === 'ACTIVE',
        timeToImpactSec: this.estimateMissileTTI(missile, targetPos, targetVel),
      }
    })

    entries.sort((a, b) => {
      if (a.timeToImpactSec === null || a.timeToImpactSec === undefined) {
        if (b.timeToImpactSec === null || b.timeToImpactSec === undefined) return 0
        return 1
      }
      if (b.timeToImpactSec === null || b.timeToImpactSec === undefined) return -1
      return a.timeToImpactSec - b.timeToImpactSec
    })
    return entries
  }

  private estimateMissileTTI(
    missile: MissileState,
    targetPos: readonly [number, number, number],
    targetVel: readonly [number, number, number]
  ): number | null {
    const relPos: [number, number, number] = [
      targetPos[0] - missile.positionNED[0],
      targetPos[1] - missile.positionNED[1],
      targetPos[2] - missile.positionNED[2],
    ]
    const relVel: [number, number, number] = [
      targetVel[0] - missile.velocityNED[0],
      targetVel[1] - missile.velocityNED[1],
      targetVel[2] - missile.velocityNED[2],
    ]
    const rangeM = Math.hypot(relPos[0], relPos[1], relPos[2])
    if (rangeM < 1) return 0

    const rangeRate = (
      relPos[0] * relVel[0] +
      relPos[1] * relVel[1] +
      relPos[2] * relVel[2]
    ) / rangeM
    const closingMS = -rangeRate
    if (closingMS > 5) return rangeM / closingMS

    const missileSpeed = Math.hypot(
      missile.velocityNED[0],
      missile.velocityNED[1],
      missile.velocityNED[2]
    )
    if (missileSpeed > 10) return rangeM / missileSpeed
    return null
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

    if (t === null || t === undefined) {
      const rangeM = Math.sqrt(rDotR)
      if (projectileSpeedMS > eps) t = rangeM / projectileSpeedMS
    }
    if (t === null || t === undefined) return null
    return THREE.MathUtils.clamp(t, MIN_INTERCEPT_TIME_S, MAX_INTERCEPT_TIME_S)
  }

  private computeMissileLeadSolution(
    missileSpec: MissileSpec,
    target: Aircraft
  ): MissileLeadSolution | null {
    const ownPos = this.player.state.positionNED
    const ownVel = this.player.state.velocityNED
    const tgtPos = target.state.positionNED
    const tgtVel = target.state.velocityNED

    const relPos: [number, number, number] = [
      tgtPos[0] - ownPos[0],
      tgtPos[1] - ownPos[1],
      tgtPos[2] - ownPos[2],
    ]
    const rangeM = Math.hypot(relPos[0], relPos[1], relPos[2])
    if (!Number.isFinite(rangeM) || rangeM < 25) return null

    const ownSpeed = v3len(ownVel)
    const altM = Math.max(0, -ownPos[2])
    const speedOfSoundMS = computeAtmosphere(altM, ownSpeed).speedOfSoundMS
    const maxSpeedMS = Math.max(300, missileSpec.maxSpeedMach * speedOfSoundMS)
    const accelMS2 = missileSpec.maxThrustN / Math.max(1, missileSpec.massKg)

    // Iterate a short time-of-flight solve using boost + coast speed profile.
    let t = THREE.MathUtils.clamp(rangeM / Math.max(1, ownSpeed + 350), 0.2, 25)
    for (let i = 0; i < 6; i++) {
      const predPos: [number, number, number] = [
        tgtPos[0] + tgtVel[0] * t,
        tgtPos[1] + tgtVel[1] * t,
        tgtPos[2] + tgtVel[2] * t,
      ]
      const dx = predPos[0] - ownPos[0]
      const dy = predPos[1] - ownPos[1]
      const dz = predPos[2] - ownPos[2]
      const dist = Math.hypot(dx, dy, dz)

      const boostTime = Math.min(t, missileSpec.burnTimeSec)
      const coastTime = Math.max(0, t - boostTime)
      const boostEndSpeed = Math.min(maxSpeedMS, ownSpeed + accelMS2 * boostTime * 0.7)
      const avgBoostSpeed = 0.5 * (ownSpeed + boostEndSpeed)
      const avgCoastSpeed = Math.max(ownSpeed + 120, boostEndSpeed * 0.72)
      const coveredDist = avgBoostSpeed * boostTime + avgCoastSpeed * coastTime
      if (coveredDist < 1) break
      t *= dist / coveredDist
      t = THREE.MathUtils.clamp(t, 0.2, 25)
    }

    const interceptTimeSec = t
    const aimPointNED: [number, number, number] = [
      tgtPos[0] + tgtVel[0] * interceptTimeSec,
      tgtPos[1] + tgtVel[1] * interceptTimeSec,
      tgtPos[2] + tgtVel[2] * interceptTimeSec,
    ]

    const boresightNED = quatRotateVec(this.player.state.attitudeQuat, [1, 0, 0] as [number, number, number])
    const losVec: [number, number, number] = [
      aimPointNED[0] - ownPos[0],
      aimPointNED[1] - ownPos[1],
      aimPointNED[2] - ownPos[2],
    ]
    const losLen = Math.hypot(losVec[0], losVec[1], losVec[2])
    if (losLen < 1e-3) return null
    const losUnit: [number, number, number] = [losVec[0] / losLen, losVec[1] / losLen, losVec[2] / losLen]
    const boreLen = Math.max(1e-6, v3len(boresightNED))
    const boreUnit: [number, number, number] = [boresightNED[0] / boreLen, boresightNED[1] / boreLen, boresightNED[2] / boreLen]
    const dot = THREE.MathUtils.clamp(
      boreUnit[0] * losUnit[0] + boreUnit[1] * losUnit[1] + boreUnit[2] * losUnit[2],
      -1,
      1
    )
    const offBoresightDeg = THREE.MathUtils.radToDeg(Math.acos(dot))

    return {
      interceptTimeSec,
      aimPointNED,
      offBoresightDeg,
      targetRangeM: rangeM,
    }
  }

  private getMissileSeekerLimitDeg(spec: MissileSpec): number {
    if (spec.category === 'IR_MISSILE') {
      return spec.irSeeker?.gimbalLimitDeg ?? 30
    }
    return 30
  }

  private computeMissileOptimalLaunchAngleDeg(spec: MissileSpec, rangeM: number): number {
    const rangeNorm = THREE.MathUtils.clamp(rangeM / Math.max(1000, spec.maxRangeM), 0, 1)
    // Far targets prefer tighter lead cones; close targets allow wider off-boresight launches.
    const closeInFraction = 0.62
    const longRangeFraction = 0.24
    const baseLimit = this.getMissileSeekerLimitDeg(spec)
    const optimalFraction = THREE.MathUtils.lerp(closeInFraction, longRangeFraction, rangeNorm)
    return THREE.MathUtils.clamp(baseLimit * optimalFraction, 4, Math.max(8, baseLimit * 0.85))
  }

  resize(w: number, h: number): void {
    this.canvas.width  = w
    this.canvas.height = h
  }

  dispose(): void { /* canvas managed externally */ }
}
