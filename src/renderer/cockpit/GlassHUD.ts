import * as THREE from 'three'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import type { EntityManager } from '../entities/EntityManager'
import type { Aircraft } from '../entities/Aircraft'
import type { AircraftState } from '../types/aircraft'
import { mToFt } from '../utils/Units'
import { getAGLM } from '../scene/Terrain'
import { drawHeadingTape } from '../ui/HUDElements/HeadingTape'
import { drawAttitudeIndicator } from '../ui/HUDElements/AttitudeIndicator'
import { boresightAngles, HudProjection } from '../ui/HUDElements/angleProject'
import {
  computeRelativeKinematics,
  resolveShootCue,
  formatAspect,
  isShootCue,
  type ShootCue,
} from '../ui/HUDElements/TargetGeometry'
import {
  computeLARInfo,
  computeMissileLeadSolution,
  getMissileSeekerLimitDeg,
  collectMissileTTI,
  selectedAAMissileSpec,
} from '../ui/HUDElements/TargetingComputer'

const HUD_W = 512
const HUD_H = 256
/** Angular extent of the visible combiner glass. */
const FOV_H_DEG = 13
const FOV_V_DEG = 9

const GREEN = '#00ff44'
const AMBER = '#ffb000'
const RED = '#ff2020'
const PITBULL = '#ffe66d'

export class GlassHUD {
  private canvas: HTMLCanvasElement
  private ctx2d: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private proj = new HudProjection(HUD_W, HUD_H, FOV_H_DEG, FOV_V_DEG)
  /** STT id currently locked, for the acquisition animation. */
  private sttLockId: string | null = null
  private sttLockStartMs = 0
  readonly mesh: THREE.Mesh

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width  = HUD_W
    this.canvas.height = HUD_H
    this.ctx2d = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)

    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), mat)
    this.mesh.name = 'glass_hud'
    this.mesh.position.set(0, -0.14, -0.58)
    this.mesh.rotation.set(THREE.MathUtils.degToRad(26), 0, 0)
  }

  update(player: PlayerAircraft, entityManager: EntityManager): void {
    const c = this.ctx2d
    const s = player.state
    const radar = player.radar.state
    const rwr = player.rwr.state
    const P = this.proj

    c.clearRect(0, 0, HUD_W, HUD_H)
    c.strokeStyle = GREEN
    c.fillStyle = GREEN
    c.lineWidth = 1.5
    c.font = '13px monospace'
    c.textAlign = 'left'

    // ── Airspeed / altitude / Mach / G boxes ────────────────────────────────
    const boxY = P.cy
    c.strokeRect(10, boxY - 12, 62, 22)
    c.fillText(`${Math.round(s.iasKts)}`, 16, boxY + 4)
    c.fillText(`M ${s.mach.toFixed(2)}`, 12, boxY + 30)
    c.fillText(`${s.gCurrent.toFixed(1)}G`, 12, boxY + 46)

    // Radar altitude (height above terrain, less ~5 ft gear height) while in
    // range, else barometric.
    const baroFt = Math.round(mToFt(-s.positionNED[2]))
    const aglFt = mToFt(getAGLM(s.positionNED)) - 5
    const radarFt = Math.max(0, Math.round(aglFt))
    const onRadar = aglFt <= 5000 && getAGLM(s.positionNED) > -3
    c.strokeRect(HUD_W - 82, boxY - 12, 72, 22)
    c.textAlign = 'right'
    c.fillText(`${onRadar ? 'R' : 'B'}${onRadar ? radarFt : baroFt}`, HUD_W - 16, boxY + 4)
    const vsFpm = Math.round(s.vviMps * 196.85)
    c.fillText(`${vsFpm >= 0 ? '+' : ''}${vsFpm}`, HUD_W - 16, boxY + 30)
    c.textAlign = 'left'

    // ── Heading tape (top) ─────────────────────────────────────────────────
    drawHeadingTape(c, P.cx, 6, s.headingDeg)

    // ── Pitch ladder + horizon (world-referenced) ──────────────────────────
    c.save()
    c.beginPath()
    c.rect(70, 34, HUD_W - 140, HUD_H - 68)
    c.clip()
    drawAttitudeIndicator(c, P.cx, P.cy, s.pitchDeg, s.rollDeg, P.pxPerDegV)
    c.restore()

    // ── Flight path marker ─────────────────────────────────────────────────
    this.drawFpm(c, s)

    // Fixed boresight / gun cross, 1.5° above the datum.
    const gcY = P.cy - 1.5 * P.pxPerDegV
    c.beginPath()
    c.moveTo(P.cx - 8, gcY); c.lineTo(P.cx - 2, gcY)
    c.moveTo(P.cx + 2, gcY); c.lineTo(P.cx + 8, gcY)
    c.moveTo(P.cx, gcY - 6); c.lineTo(P.cx, gcY - 1)
    c.stroke()

    // ── STT target designator ──────────────────────────────────────────────
    const target = radar.mode === 'STT' && radar.sttTargetId
      ? entityManager.getEnemies().find(e => e.entityId === radar.sttTargetId) ?? null
      : null
    if (radar.sttTargetId !== this.sttLockId) {
      this.sttLockId = radar.sttTargetId
      this.sttLockStartMs = performance.now()
    }
    if (target) this.drawTargetDesignator(c, player, target)

    // ── DLZ column (right inner edge) ──────────────────────────────────────
    this.drawDLZ(c, player, entityManager)

    // ── Own-missile time-to-impact (lower-left) ────────────────────────────
    const tti = collectMissileTTI(
      player.missiles.getMissiles(),
      id => entityManager.getEnemies().find(e => e.entityId === id)?.state ?? null,
    ).slice(0, 3)
    c.font = '10px monospace'
    for (let i = 0; i < tti.length; i++) {
      const e = tti[i]!
      const t = e.timeToImpactSec === null ? '--.-' : Math.min(99.9, Math.max(0, e.timeToImpactSec)).toFixed(1)
      c.fillStyle = e.pitbull ? PITBULL : GREEN
      c.fillText(`${e.pitbull ? 'A' : 'M'}${i + 1} ${t}s`, 12, HUD_H - 40 + i * 12)
    }

    // ── RWR missile-launch banner ──────────────────────────────────────────
    if (rwr.threats.some(t => t.type === 'MISSILE') && (Math.floor(performance.now() / 250) & 1) === 0) {
      c.fillStyle = RED
      c.font = 'bold 12px monospace'
      c.textAlign = 'center'
      c.fillText('MSL', P.cx, 34)
      c.textAlign = 'left'
    }

    // ── Selected weapon (bottom centre) ────────────────────────────────────
    c.fillStyle = GREEN
    c.font = '12px monospace'
    c.textAlign = 'center'
    c.fillText(this.weaponLabel(player), P.cx, HUD_H - 8)
    c.textAlign = 'left'

    this.texture.needsUpdate = true
  }

  private drawFpm(c: CanvasRenderingContext2D, s: AircraftState): void {
    const spd = Math.hypot(s.velocityNED[0], s.velocityNED[1], s.velocityNED[2])
    if (spd < 5) return
    const ahead: [number, number, number] = [
      s.positionNED[0] + (s.velocityNED[0] / spd) * 1000,
      s.positionNED[1] + (s.velocityNED[1] / spd) * 1000,
      s.positionNED[2] + (s.velocityNED[2] / spd) * 1000,
    ]
    const a = boresightAngles(s.positionNED, s.attitudeQuat, ahead)
    const P = this.proj
    c.save()
    c.strokeStyle = GREEN
    c.lineWidth = 1.5
    if (a.ahead && P.inFov(a.azDeg, a.elDeg, 0.5)) {
      const { x, y } = P.toPx(a.azDeg, a.elDeg)
      c.beginPath()
      c.arc(x, y, 5, 0, Math.PI * 2)
      c.moveTo(x - 13, y); c.lineTo(x - 5, y)
      c.moveTo(x + 5, y);  c.lineTo(x + 13, y)
      c.moveTo(x, y - 5);  c.lineTo(x, y - 11)
      c.stroke()
    } else {
      // Ghost at the glass edge, flashing.
      if ((Math.floor(performance.now() / 200) & 1) === 0) {
        const e = P.clampToEdge(a.ahead ? a.azDeg : a.azDeg * 6, a.elDeg)
        c.beginPath()
        c.arc(e.x, e.y, 4, 0, Math.PI * 2)
        c.stroke()
      }
    }
    c.restore()
  }

  private drawTargetDesignator(
    c: CanvasRenderingContext2D,
    player: PlayerAircraft,
    target: Aircraft,
  ): void {
    const s = player.state
    const P = this.proj
    const a = boresightAngles(s.positionNED, s.attitudeQuat, target.state.positionNED)
    const k = computeRelativeKinematics(
      s.positionNED, s.velocityNED, target.state.positionNED, target.state.velocityNED,
    )
    const cue = this.shootCue(player, target)

    if (!a.ahead || !P.inFov(a.azDeg, a.elDeg, 0.5)) {
      // Off-combiner locator caret + bearing.
      const e = P.clampToEdge(a.ahead ? a.azDeg : a.azDeg * 6, a.elDeg)
      c.save()
      c.strokeStyle = RED
      c.fillStyle = RED
      c.lineWidth = 2
      c.beginPath()
      c.arc(e.x, e.y, 5, 0, Math.PI * 2)
      c.moveTo(P.cx + Math.cos(e.angleRad) * 20, P.cy + Math.sin(e.angleRad) * 20)
      c.lineTo(e.x - Math.cos(e.angleRad) * 8, e.y - Math.sin(e.angleRad) * 8)
      c.stroke()
      c.font = '10px monospace'
      c.fillText(`${(k.rangeM / 1852).toFixed(0)}NM`, e.x - 14, e.y + (Math.sin(e.angleRad) > 0 ? 16 : -8))
      c.restore()
      return
    }

    const { x: sx, y: sy } = P.toPx(a.azDeg, a.elDeg)
    const wingspanM = Math.max(4, target.spec.mass.wingspanM)
    const halfBox = THREE.MathUtils.clamp(
      Math.atan2(wingspanM, Math.max(60, k.rangeM)) * (180 / Math.PI) * P.pxPerDegH, 7, 34,
    )
    const acqT = THREE.MathUtils.clamp((performance.now() - this.sttLockStartMs) / 450, 0, 1)
    const b = halfBox + (1 - acqT) * 60
    const corner = Math.max(4, b * 0.4)

    c.save()
    c.strokeStyle = RED
    c.lineWidth = 2
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      c.beginPath()
      c.moveTo(sx + dx * b, sy + dy * (b - corner))
      c.lineTo(sx + dx * b, sy + dy * b)
      c.lineTo(sx + dx * (b - corner), sy + dy * b)
      c.stroke()
    }
    if (acqT >= 1) {
      c.fillStyle = RED
      c.beginPath(); c.arc(sx, sy, 2, 0, Math.PI * 2); c.fill()
    }

    // Data block.
    const vcKts = Math.round(k.closureMps * 1.94384)
    const dAltK = (k.altDeltaM * 3.28084) / 1000
    const lines = [
      `${(k.rangeM / 1852).toFixed(1)}NM`,
      `VC${vcKts >= 0 ? '+' : ''}${vcKts}`,
      `A${formatAspect(k)}`,
      `${dAltK >= 0 ? '+' : ''}${dAltK.toFixed(1)}K`,
    ]
    c.font = '10px monospace'
    c.fillStyle = GREEN
    c.textAlign = 'left'
    let ly = sy - 14
    for (const l of lines) { c.fillText(l, sx + b + 6, ly); ly += 11 }

    // Staged shoot cue.
    if (cue !== 'NONE') {
      const spec = CUE_STYLE[cue]
      if (!spec.flash || (Math.floor(performance.now() / 125) & 1) === 0) {
        c.font = 'bold 12px monospace'
        c.fillStyle = spec.color
        c.textAlign = 'center'
        c.fillText(spec.text, sx, sy + b + 14)
      }
    }
    c.restore()
  }

  private drawDLZ(c: CanvasRenderingContext2D, player: PlayerAircraft, entityManager: EntityManager): void {
    const spec = selectedAAMissileSpec(player.state.loadedStores, player.getSelectedWeaponName())
    if (!spec) return
    const target = this.currentTarget(player, entityManager)
    if (!target) return
    const lar = computeLARInfo(spec, player.state, target.state)
    if (!lar) return

    const x = HUD_W - 92
    const y0 = this.proj.cy - 46
    const h = 92
    const rTop = lar.rMaxM * 1.05
    const yFor = (r: number) => y0 + h - THREE.MathUtils.clamp(r / rTop, 0, 1) * h

    c.save()
    c.strokeStyle = GREEN
    c.lineWidth = 1
    const yMax = yFor(lar.rMaxM), yMin = yFor(lar.rMinM), yNe = yFor(lar.rNeM)
    c.beginPath()
    c.moveTo(x, yMax); c.lineTo(x, yMin)
    c.moveTo(x - 3, yMax); c.lineTo(x + 1, yMax)
    c.moveTo(x - 3, yMin); c.lineTo(x + 1, yMin)
    c.stroke()
    c.lineWidth = 3
    c.beginPath(); c.moveTo(x, yMin); c.lineTo(x, yNe); c.stroke()
    const yr = yFor(lar.rangeM)
    c.fillStyle = lar.inRange ? GREEN : AMBER
    c.beginPath()
    c.moveTo(x + 2, yr); c.lineTo(x + 8, yr - 3); c.lineTo(x + 8, yr + 3)
    c.closePath(); c.fill()
    c.restore()
  }

  private shootCue(player: PlayerAircraft, target: Aircraft): ShootCue {
    const spec = selectedAAMissileSpec(player.state.loadedStores, player.getSelectedWeaponName())
    if (!spec) return 'NONE'
    const lar = computeLARInfo(spec, player.state, target.state)
    const sol = computeMissileLeadSolution(spec, player.state, target.state)
    return resolveShootCue({
      hasMissileSelected: true,
      lar: lar
        ? { rangeM: lar.rangeM, rMinM: lar.rMinM, rMaxM: lar.rMaxM, inRange: lar.inRange, inNoEscapeZone: lar.inNoEscapeZone }
        : null,
      offBoresightDeg: sol ? sol.offBoresightDeg : null,
      seekerLimitDeg: getMissileSeekerLimitDeg(spec),
    })
  }

  /** True while a valid launch solution exists (for an external SHOOT audio hook). */
  hasShootSolution(player: PlayerAircraft, entityManager: EntityManager): boolean {
    const t = this.currentTarget(player, entityManager)
    return t ? isShootCue(this.shootCue(player, t)) : false
  }

  private currentTarget(player: PlayerAircraft, entityManager: EntityManager): Aircraft | null {
    const id = player.radar.state.sttTargetId ?? player.hms.state.lockedEntityId
    if (!id) return null
    return entityManager.getEnemies().find(e => e.entityId === id) ?? null
  }

  private weaponLabel(player: PlayerAircraft): string {
    const sel = player.getSelectedWeaponName()
    const key = sel.toLowerCase()
    if (key === 'gun' || key === 'm61a1' || key === 'gsh301') {
      return `GUN ${player.gun.getRoundsRemaining()}`
    }
    const rounds = player.state.loadedStores
      .filter(s => s.weaponId === key)
      .reduce((n, s) => n + s.remainingRounds, 0)
    return `${sel.toUpperCase()}  x${rounds}`
  }

  dispose(): void {
    this.texture.dispose()
  }
}

const CUE_STYLE: Record<Exclude<ShootCue, 'NONE'>, { text: string; color: string; flash: boolean }> = {
  TOO_CLOSE: { text: 'TOO CLOSE', color: AMBER, flash: false },
  IN_RNG:    { text: 'IN RNG',    color: GREEN, flash: false },
  SHOOT:     { text: 'SHOOT',     color: GREEN, flash: false },
  SHOOT_NEZ: { text: 'SHOOT',     color: GREEN, flash: true  },
}
