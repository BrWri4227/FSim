import * as THREE from 'three'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import type { EntityManager } from '../entities/EntityManager'
import type { Aircraft } from '../entities/Aircraft'
import { drawAttitudeIndicator } from './HUDElements/AttitudeIndicator'
import { drawAirspeed }          from './HUDElements/Airspeed'
import { drawAltimeter }         from './HUDElements/Altimeter'
import { drawGMeter }            from './HUDElements/GMeter'
import { drawHeadingTape }       from './HUDElements/HeadingTape'
import { drawRadarScope, type RadarDLZ } from './HUDElements/RadarScope'
import { drawWeaponsStatus }     from './HUDElements/WeaponsStatus'
import { drawThrottleBar }       from './HUDElements/ThrottleBar'
import { drawFuelGauge }         from './HUDElements/FuelGauge'
import { drawThreatDisplay, createRWRDisplayState, type RWRDisplayState } from './HUDElements/ThreatDisplay'
import { drawLandingAids } from './HUDElements/LandingAids'
import { getAGLM } from '../scene/Terrain'
import {
  computeRelativeKinematics,
  resolveShootCue,
  isShootCue,
  formatAspect,
  type ShootCue,
} from './HUDElements/TargetGeometry'
import type { CameraMode } from '../camera/CameraManager'
import { drawFLIRPage } from '../cockpit/MFDPages/FLIRPage'
import type { LoadedStore } from '../types/weapons'
import { MISSILE_SPECS } from '../data/weapons/catalog'
import { computeAtmosphere } from '../physics/Atmosphere'
import { quatRotateVec, v3len } from '../utils/MathUtils'
import {
  computeLARInfo,
  computeMissileLeadSolution,
  computeMissileOptimalLaunchAngleDeg,
  getMissileSeekerLimitDeg,
  solveInterceptTime,
  collectMissileTTI,
  type MissileTTIEntry,
} from './HUDElements/TargetingComputer'

/**
 * HUD colour language (F/A-18/F-16 style):
 *   HUD_GREEN  primary symbology, in-parameters / valid
 *   HUD_AMBER  caution / advisory / marginal geometry
 *   HUD_RED    warning / hostile hard lock / defensive
 *   HUD_BLUE   friendly / own missile in mid-course
 *   HUD_PITBULL own ARH missile gone active
 */
const HUD_GREEN = '#00ff44'
const HUD_AMBER = '#ffb000'
const HUD_RED = '#ff2020'
const HUD_BLUE = '#66ccff'
const HUD_PITBULL = '#ffe66d'

const G0 = 9.80665
const MAX_HUD_TTI_LINES = 3

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
  private lastDrawMs = 0
  /** Minimum interval between full HUD repaints (~30 Hz). */
  private static readonly MIN_DRAW_INTERVAL_MS = 1000 / 30
  private forceRedraw = true
  /** True while the active camera is the external/chase view. */
  private isExternal = false
  /** Tracks the current STT lock so the acquisition animation plays once. */
  private sttAcquire: { id: string | null; startMs: number } = { id: null, startMs: 0 }
  private rwrDisplayState: RWRDisplayState = createRWRDisplayState()
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
    this.forceRedraw = true
  }

  render(camera?: THREE.PerspectiveCamera, cameraMode: CameraMode = 'COCKPIT'): void {
    this.isExternal = cameraMode === 'EXTERNAL'
    const nowMs = performance.now()
    const needsFlash = this.decoyFlashRemainSec > 0 || this.wmCmdFlashRemainSec > 0
    if (
      !this.forceRedraw &&
      !needsFlash &&
      nowMs - this.lastDrawMs < HUD.MIN_DRAW_INTERVAL_MS
    ) {
      return
    }
    this.forceRedraw = false
    this.lastDrawMs = nowMs

    const { canvas: c, ctx, player } = this
    const state = player.state
    const radar = player.radar.state
    const rwr   = player.rwr.state
    const stores = state.loadedStores
    const selectedWeapon = player.getSelectedWeaponName()
    const gunRounds = player.gun.getRoundsRemaining()

    // Advance decoy flash timer using wall-clock delta
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

    const fuelFrac = state.fuelKg / Math.max(player.spec.mass.fuelCapacityKg, 1)

    // First-person reads its information off the modelled cockpit displays
    // (glass HUD combiner + MFDs). The flat canvas only carries the can't-miss
    // safety cues that have no natural home on glass.
    if (!this.isExternal) {
      this.drawCockpitSafetyNet(ctx, cx, edgePadY, headingBandH, fuelFrac, selectedWeapon, gunRounds)
      return
    }

    // ── Primary flight/status overlay (external / chase view) ────────────────
    // Heading tape — top center
    drawHeadingTape(ctx, cx, edgePadY, state.headingDeg)

    // Attitude indicator — center
    drawAttitudeIndicator(ctx, cx, cy, state.pitchDeg, state.rollDeg)

    // IAS tape — left (iasKts → convert to m/s for drawAirspeed which shows knots internally)
    drawAirspeed(ctx, airspeedX, cy, state.iasKts * 0.51444)

    // Altimeter tape — right
    drawAltimeter(ctx, altimeterX, cy, state.altitudeM)

    // G-meter — lower left
    drawGMeter(ctx, gMeterX, cy + 80 * uiScale, state.gCurrent, state.gMax, {
      reserveFraction: player.gloc.state.reserveFraction,
      agsmStrain: player.gloc.state.agsmStrain,
      incapacitated: player.gloc.state.incapacitated,
    })

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

    // Mach — lower right
    ctx.fillStyle = HUD_GREEN
    ctx.fillText(`M ${state.mach.toFixed(2)}`, altimeterX + 2, cy + 80 * uiScale)

    // VVI
    const vvi = Math.round(state.vviMps * 196.85)
    ctx.fillText(`VVI ${vvi >= 0 ? '+' : ''}${vvi}`, vviX, cy - 80 * uiScale)

    // Flight path marker — screen-fixed from alpha/beta, matches the fixed ladder.
    const betaPx  = (state.betaDeg  / 60) * (W / 2)
    const alphaPx = (state.alphaDeg / 40) * (H / 2)
    this.drawFpmGlyph(ctx, cx + betaPx, cy - alphaPx)

    // Chase view only: a world-anchored nose reticle so the airframe's true
    // pointing is readable against the screen-fixed ladder.
    if (camera && this.isExternal) this.drawNoseReticle(ctx, camera, W, H)

    // Master caution / warning — consolidated advisory line under the heading tape.
    this.drawMasterCaution(ctx, cx, edgePadY + headingBandH + 4, fuelFrac)

    // Weapons status — bottom left
    drawWeaponsStatus(ctx, edgePadX, weaponsY, stores, selectedWeapon, gunRounds)

    // Radar B-scope — bottom center (with DLZ staple for the selected missile)
    drawRadarScope(ctx, radarX, radarY, radarW, radarH, radar, state.positionNED, state.attitudeQuat, state.velocityNED, this.computeRadarDLZ())

    // RWR threat ring — bottom right
    drawThreatDisplay(ctx, threatCx, threatCy, rwr, performance.now() / 1000, this.rwrDisplayState)
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

    // ── Bottom-center status strip (gear / flaps / brakes) ──────────────────
    {
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
    } // end status strip

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
      // Play the lock-acquisition animation once when a new STT lock is taken.
      if (radar.sttTargetId !== this.sttAcquire.id) {
        this.sttAcquire = { id: radar.sttTargetId, startMs: performance.now() }
      }
      if (target) {
        this.drawGunFunnel(ctx, camera, target, W, H)
        this.drawTargetDesignator(ctx, camera, target, W, H)
        this.drawMissileLeadIndicator(ctx, camera, target, W, H)
      }
    } else if (this.sttAcquire.id !== null) {
      this.sttAcquire = { id: null, startMs: 0 }
    }

    if (camera) this.drawSituationalMarkers(ctx, camera, W, H)

    // Landing aids — AoA indexer (gear down) + radar altitude (low)
    drawLandingAids(ctx, cx, cy, uiScale, state, getAGLM(state.positionNED))
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

    const interceptT = solveInterceptTime(relPos, relVel, gunSpec.muzzleVelocityMS)
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

  /** Standard "winged circle" flight-path-marker glyph at a screen point. */
  private drawFpmGlyph(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save()
    ctx.strokeStyle = HUD_GREEN
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - 14, y); ctx.lineTo(x - 5, y)
    ctx.moveTo(x + 5, y);  ctx.lineTo(x + 14, y)
    ctx.moveTo(x, y - 5);  ctx.lineTo(x, y - 12)
    ctx.stroke()
    ctx.restore()
  }

  /** Where the nose is pointing — the key reference in the orbit camera. */
  private drawNoseReticle(
    ctx: CanvasRenderingContext2D,
    camera: THREE.PerspectiveCamera,
    W: number,
    H: number,
  ): void {
    const s = this.player.state
    const nose = quatRotateVec(s.attitudeQuat, [1000, 0, 0])
    const p = this.projectNEDToScreen(camera, [
      s.positionNED[0] + nose[0],
      s.positionNED[1] + nose[1],
      s.positionNED[2] + nose[2],
    ], W, H)
    if (!p) return
    ctx.save()
    ctx.strokeStyle = HUD_GREEN
    ctx.fillStyle = HUD_GREEN
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(p.x, p.y - 11); ctx.lineTo(p.x, p.y - 7)
    ctx.moveTo(p.x - 11, p.y); ctx.lineTo(p.x - 7, p.y)
    ctx.moveTo(p.x + 7, p.y);  ctx.lineTo(p.x + 11, p.y)
    ctx.stroke()
    ctx.font = '9px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('NOSE', p.x + 10, p.y - 8)
    ctx.restore()
  }

  /** Single consolidated caution/warning line — highest severity wins. */
  private drawMasterCaution(
    ctx: CanvasRenderingContext2D,
    cx: number,
    topY: number,
    fuelFrac: number,
  ): void {
    const rwr = this.player.rwr.state
    const s = this.player.state
    const cues: Array<{ text: string; warn: boolean; flash: boolean }> = []

    const inboundMsl = rwr.threats.filter(t => t.type === 'MISSILE')
    if (inboundMsl.length > 0) {
      const closest = Math.min(...inboundMsl.map(t => t.distanceM ?? Infinity))
      if (closest < 6000) cues.push({ text: 'BREAK', warn: true, flash: true })
      else cues.push({ text: 'MISSILE', warn: true, flash: true })
    }
    if (fuelFrac < 0.1) cues.push({ text: 'FUEL EMERG', warn: true, flash: true })
    else if (fuelFrac < 0.2) cues.push({ text: 'BINGO FUEL', warn: false, flash: true })
    if (s.alphaDeg > 25) cues.push({ text: 'AOA', warn: false, flash: false })
    if (s.gearDown && s.iasKts > 300) cues.push({ text: 'GEAR', warn: false, flash: false })

    if (cues.length === 0) return
    cues.sort((a, b) => Number(b.warn) - Number(a.warn))
    const top = cues[0]!
    const flashOn = (Math.floor(performance.now() / 250) & 1) === 0
    if (top.flash && !flashOn) return

    ctx.save()
    ctx.font = 'bold 15px monospace'
    ctx.fillStyle = top.warn ? HUD_RED : HUD_AMBER
    ctx.textAlign = 'center'
    ctx.fillText(top.text, cx, topY + 12)
    ctx.restore()
  }

  /**
   * First-person flat-canvas layer: everything else lives on the glass HUD and
   * the MFDs, so this only draws the cues a pilot must not miss even when not
   * looking through the combiner.
   */
  private drawCockpitSafetyNet(
    ctx: CanvasRenderingContext2D,
    cx: number,
    edgePadY: number,
    headingBandH: number,
    fuelFrac: number,
    selectedWeapon: string,
    gunRounds: number,
  ): void {
    // Consolidated caution / warning (includes the MISSILE / BREAK launch cue).
    this.drawMasterCaution(ctx, cx, edgePadY + headingBandH + 4, fuelFrac)

    // Big can't-miss missile-launch banner, independent of the caution priority.
    const rwr = this.player.rwr.state
    const inbound = rwr.threats.filter(t => t.type === 'MISSILE')
    if (inbound.length > 0 && (Math.floor(performance.now() / 200) & 1) === 0) {
      const brg = Math.round(((inbound[0]!.azimuthDeg % 360) + 360) % 360).toString().padStart(3, '0')
      ctx.save()
      ctx.font = 'bold 20px monospace'
      ctx.fillStyle = HUD_RED
      ctx.textAlign = 'center'
      ctx.fillText(`◄ MISSILE ${brg} ►`, cx, edgePadY + headingBandH + 34)
      ctx.restore()
    }

    // Selected weapon + rounds, bottom-centre.
    const stores = this.player.state.loadedStores
    const sel = selectedWeapon.toLowerCase()
    let label: string
    if (sel === 'gun' || sel === 'm61a1' || sel === 'gsh301') {
      label = `GUN ${gunRounds}`
    } else {
      const rounds = stores
        .filter(s => s.weaponId === sel)
        .reduce((n, s) => n + s.remainingRounds, 0)
      label = `${selectedWeapon.toUpperCase()}  x${rounds}`
    }
    ctx.save()
    ctx.font = 'bold 13px monospace'
    ctx.fillStyle = HUD_GREEN
    ctx.textAlign = 'center'
    ctx.fillText(label, cx, ctx.canvas.height - Math.max(10, edgePadY))
    ctx.restore()
  }

  /**
   * Target-designator box for the STT lock: a range-scaled corner-bracket box
   * that frames the bandit, a lock-acquisition animation, a kinematics data
   * block, the staged shoot cue, and an off-boresight locator when the bandit
   * leaves the HUD field of view.
   */
  private drawTargetDesignator(
    ctx: CanvasRenderingContext2D,
    camera: THREE.PerspectiveCamera,
    target: Aircraft,
    W: number,
    H: number,
  ): void {
    const own = this.player.state
    const k = computeRelativeKinematics(
      own.positionNED, own.velocityNED,
      target.state.positionNED, target.state.velocityNED,
    )
    const cue = this.computeShootCue(target)
    const screen = this.projectNEDToScreen(camera, target.state.positionNED, W, H)

    const margin = 56
    const offscreen = !screen ||
      screen.x < margin || screen.x > W - margin ||
      screen.y < margin || screen.y > H - margin
    if (offscreen) this.drawOffBoresightLocator(ctx, camera, target, W, H, k.rangeM)
    if (!screen) return

    const horizontalFovRad = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * camera.aspect)
    const pxPerRad = W / horizontalFovRad
    const wingspanM = Math.max(4, target.spec.mass.wingspanM)
    const halfBox = THREE.MathUtils.clamp(Math.atan2(wingspanM, Math.max(60, k.rangeM)) * pxPerRad, 8, 46)

    // Acquisition animation — brackets converge over ~0.45 s once per new lock.
    const acqT = THREE.MathUtils.clamp((performance.now() - this.sttAcquire.startMs) / 450, 0, 1)
    const b = halfBox + (1 - acqT) * Math.min(W, H) * 0.13
    const corner = Math.max(5, b * 0.42)
    const sx = screen.x, sy = screen.y

    ctx.save()
    ctx.strokeStyle = HUD_RED
    ctx.lineWidth = 2
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      ctx.beginPath()
      ctx.moveTo(sx + dx * b, sy + dy * (b - corner))
      ctx.lineTo(sx + dx * b, sy + dy * b)
      ctx.lineTo(sx + dx * (b - corner), sy + dy * b)
      ctx.stroke()
    }
    if (acqT >= 1) {
      ctx.fillStyle = HUD_RED
      ctx.beginPath()
      ctx.arc(sx, sy, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── Kinematics data block, right of the box ────────────────────────────────
    const tgtAltM = -target.state.positionNED[2]
    const sosMS = computeAtmosphere(Math.max(0, tgtAltM), k.targetSpeedMps).speedOfSoundMS
    const vcKts = Math.round(k.closureMps * 1.94384)
    const altDeltaKft = (k.altDeltaM * 3.28084) / 1000
    const lines = [
      `${(k.rangeM / 1852).toFixed(1)}NM`,
      `VC ${vcKts >= 0 ? '+' : ''}${vcKts}`,
      `ASP ${formatAspect(k)}`,
      `${altDeltaKft >= 0 ? '+' : ''}${altDeltaKft.toFixed(1)}K M${(k.targetSpeedMps / Math.max(1, sosMS)).toFixed(2)}`,
    ]
    ctx.font = '11px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = HUD_GREEN
    const blockX = sx + b + 8
    let blockY = sy - 16
    for (const line of lines) {
      ctx.fillText(line, blockX, blockY)
      blockY += 13
    }

    // ── Staged shoot cue, below the box ──────────────────────────────────────
    const cueSpec: Record<Exclude<ShootCue, 'NONE'>, { text: string; color: string; flash: boolean }> = {
      TOO_CLOSE: { text: 'TOO CLOSE', color: HUD_AMBER, flash: false },
      IN_RNG:    { text: 'IN RNG',    color: HUD_GREEN, flash: false },
      SHOOT:     { text: 'SHOOT',     color: HUD_GREEN, flash: false },
      SHOOT_NEZ: { text: 'SHOOT',     color: HUD_GREEN, flash: true  },
    }
    if (cue !== 'NONE') {
      const spec = cueSpec[cue]
      const flashOn = (Math.floor(performance.now() / 125) & 1) === 0
      if (!spec.flash || flashOn) {
        ctx.font = 'bold 13px monospace'
        ctx.fillStyle = spec.color
        ctx.textAlign = 'center'
        ctx.fillText(spec.text, sx, sy + b + 16)
      }
    }
    ctx.restore()
  }

  /** Dashed steering line + arrow toward a locked bandit outside the HUD FOV. */
  private drawOffBoresightLocator(
    ctx: CanvasRenderingContext2D,
    camera: THREE.PerspectiveCamera,
    target: Aircraft,
    W: number,
    H: number,
    rangeM: number,
  ): void {
    const p = target.state.positionNED
    const local = new THREE.Vector3(p[1], -p[2], -p[0]).project(camera)
    let dx = local.x, dy = -local.y
    if (local.z > 1) { dx = -dx; dy = -dy } // behind the camera
    if (dx === 0 && dy === 0) return
    const ang = Math.atan2(dy, dx)
    const cx = W / 2, cy = H / 2
    const rad = Math.min(W, H) * 0.3
    const ex = cx + Math.cos(ang) * rad
    const ey = cy + Math.sin(ang) * rad

    // Off-boresight angle relative to own nose.
    const bore = quatRotateVec(this.player.state.attitudeQuat, [1, 0, 0])
    const own = this.player.state.positionNED
    const los: [number, number, number] = [p[0] - own[0], p[1] - own[1], p[2] - own[2]]
    const losLen = Math.max(1e-6, v3len(los))
    const dot = THREE.MathUtils.clamp(
      (bore[0] * los[0] + bore[1] * los[1] + bore[2] * los[2]) / losLen,
      -1, 1,
    )
    const offDeg = Math.round(THREE.MathUtils.radToDeg(Math.acos(dot)))

    ctx.save()
    ctx.strokeStyle = HUD_RED
    ctx.fillStyle = HUD_RED
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(ang) * 38, cy + Math.sin(ang) * 38)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - Math.cos(ang - 0.4) * 12, ey - Math.sin(ang - 0.4) * 12)
    ctx.lineTo(ex - Math.cos(ang + 0.4) * 12, ey - Math.sin(ang + 0.4) * 12)
    ctx.closePath()
    ctx.fill()
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${offDeg}°  ${(rangeM / 1852).toFixed(0)}NM`, ex, ey + (Math.sin(ang) > 0 ? 16 : -10))
    ctx.restore()
  }

  /** DLZ (Rmin/Rne/Rmax + current range) for the selected missile vs the current target. */
  private computeRadarDLZ(): RadarDLZ | undefined {
    const store = this.getSelectedMissileStore()
    const target = this.getCurrentTargetForLAR()
    if (!store || !target) return undefined
    const spec = MISSILE_SPECS[store.weaponId]
    if (!spec) return undefined
    const lar = computeLARInfo(spec, this.player.state, target.state)
    if (!lar) return undefined
    return { rMinM: lar.rMinM, rNeM: lar.rNeM, rMaxM: lar.rMaxM, rangeM: lar.rangeM }
  }

  /** Resolve the staged air-to-air shoot cue for a candidate target. */
  private computeShootCue(target: Aircraft): ShootCue {
    const store = this.getSelectedMissileStore()
    if (!store) return 'NONE'
    const spec = MISSILE_SPECS[store.weaponId]
    if (!spec) return 'NONE'
    const lar = computeLARInfo(spec, this.player.state, target.state)
    const solution = computeMissileLeadSolution(spec, this.player.state, target.state)
    return resolveShootCue({
      hasMissileSelected: true,
      lar: lar
        ? { rangeM: lar.rangeM, rMinM: lar.rMinM, rMaxM: lar.rMaxM, inRange: lar.inRange, inNoEscapeZone: lar.inNoEscapeZone }
        : null,
      offBoresightDeg: solution ? solution.offBoresightDeg : null,
      seekerLimitDeg: getMissileSeekerLimitDeg(spec),
    })
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

    const solution = computeMissileLeadSolution(missileSpec, this.player.state, target.state)
    if (!solution) return

    const leadScreen = this.projectNEDToScreen(camera, solution.aimPointNED, W, H)
    if (!leadScreen) return

    const targetScreen = this.projectNEDToScreen(camera, target.state.positionNED, W, H)
    if (!targetScreen) return

    const seekerLimitDeg = getMissileSeekerLimitDeg(missileSpec)
    const optimalLaunchDeg = computeMissileOptimalLaunchAngleDeg(missileSpec, solution.targetRangeM)
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

  /** True while a valid launch solution exists on the STT target (drives the SHOOT callout). */
  isRadarShootCueActive(): boolean {
    const radar = this.player.radar.state
    if (radar.mode !== 'STT' || !radar.sttTargetId) return false
    const target = this.entityManager.getEnemies().find(e => e.entityId === radar.sttTargetId)
    if (!target) return false
    return isShootCue(this.computeShootCue(target))
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

    const lar = computeLARInfo(missileSpec, this.player.state, target.state)
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
      ctx.strokeStyle = pitbull ? HUD_PITBULL : HUD_BLUE
      ctx.fillStyle = pitbull ? HUD_PITBULL : HUD_BLUE
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
      ctx.fillStyle = entry.pitbull ? HUD_PITBULL : HUD_GREEN
      ctx.fillText(`${sym}${i + 1} ${ttiTxt}s ${mode}`, x + 6, y + 26 + i * 14)
    }

    ctx.restore()
  }

  private collectMissileTTIInfo(): MissileTTIEntry[] {
    const enemies = this.entityManager.getEnemies()
    return collectMissileTTI(
      this.player.missiles.getMissiles(),
      id => enemies.find(e => e.entityId === id)?.state ?? null,
    )
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

  resize(w: number, h: number): void {
    this.canvas.width  = w
    this.canvas.height = h
    this.forceRedraw = true
  }

  dispose(): void { /* canvas managed externally */ }
}
