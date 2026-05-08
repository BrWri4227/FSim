import * as THREE from 'three'
import type { AircraftState } from '../types/aircraft'
import type { AircraftSpec } from '../types/aircraft'
import type { RadarState } from '../types/radar'
import type { RWRState } from '../types/radar'
import { mToFt } from '../utils/Units'

const HUD_W = 512
const HUD_H = 256

export class GlassHUD {
  private canvas: HTMLCanvasElement
  private ctx2d: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
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
      side: THREE.DoubleSide
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.28), mat)
    this.mesh.name = 'glass_hud'
    // Positioned at HUD combiner: ~0.68m forward of pilot eye, tilted
    this.mesh.position.set(0.68, 0, -0.05)
    this.mesh.rotation.x = THREE.MathUtils.degToRad(30)
  }

  update(state: AircraftState, spec: AircraftSpec, radar: RadarState, rwr: RWRState, _hmsCursorAz: number, _hmsCursorEl: number): void {
    const c = this.ctx2d
    c.clearRect(0, 0, HUD_W, HUD_H)
    c.strokeStyle = '#00ff44'
    c.fillStyle   = '#00ff44'
    c.lineWidth   = 1.5
    c.font        = '13px monospace'

    const ias   = Math.round(state.iasKts)
    const alt   = Math.round(mToFt(-state.positionNED[2]))
    const mach  = state.mach.toFixed(2)
    const gLoad = state.gCurrent.toFixed(1)
    const hdg   = ((state.headingDeg % 360) + 360) % 360

    // IAS
    c.fillText(`${ias} kt`, 8, 20)
    // ALT
    c.fillText(`${alt} ft`, HUD_W - 80, 20)
    // Mach
    c.fillText(`M ${mach}`, HUD_W - 80, 36)
    // G-meter
    c.fillText(`${gLoad}G`, 8, 36)
    // Heading
    c.fillText(`HDG ${Math.round(hdg).toString().padStart(3,'0')}`, HUD_W / 2 - 24, 20)

    // Horizon line (simplified: pitch offset)
    const pitchOffsetPx = (state.pitchDeg / 40) * (HUD_H / 2)
    const cx = HUD_W / 2, cy = HUD_H / 2 - pitchOffsetPx
    c.beginPath()
    c.moveTo(cx - 80, cy)
    c.lineTo(cx - 20, cy)
    c.moveTo(cx + 20, cy)
    c.lineTo(cx + 80, cy)
    c.stroke()

    // Flight path marker (velocity vector dot)
    const alphaPx = (state.alphaDeg / 40) * (HUD_H / 2)
    const betaPx  = (state.betaDeg  / 40) * (HUD_W / 2)
    c.beginPath()
    c.arc(cx + betaPx, cy + alphaPx, 5, 0, Math.PI * 2)
    c.stroke()

    // Radar target caret
    const stt = radar.sttTargetId
    if (stt && radar.mode === 'STT') {
      const track = radar.tracks.find(t => t.entityId === stt)
      if (track) {
        const dx = track.positionNED[1] - spec.pilotEyePointM[1]
        const dy = track.positionNED[0] - spec.pilotEyePointM[0]
        const azRel = Math.atan2(dx, dy) * (180 / Math.PI)
        const rangeM = Math.sqrt(dx * dx + dy * dy)
        const ax = cx + (azRel / 60) * (HUD_W / 2)
        const ay = cy
        c.beginPath()
        c.rect(ax - 8, ay - 8, 16, 16)
        c.stroke()
        c.fillText(`${Math.round(rangeM / 1852)} nm`, ax + 10, ay)
      }
    }

    // RWR threats top-right corner
    let rwrY = 50
    for (const t of rwr.threats.slice(0, 4)) {
      c.fillStyle = t.type === 'TRACK' ? '#ff4444' : '#ffaa00'
      c.fillText(`${t.type[0]} ${Math.round(t.azimuthDeg).toString().padStart(3,'0')}`, HUD_W - 80, rwrY)
      rwrY += 14
    }
    c.fillStyle = '#00ff44'

    // Pitch ladder marks every 5°
    for (let p = -30; p <= 30; p += 5) {
      if (p === 0) continue
      const py = cy - ((p - state.pitchDeg) / 40) * (HUD_H / 2)
      const len = p % 10 === 0 ? 30 : 15
      c.globalAlpha = 0.6
      c.beginPath()
      c.moveTo(cx - len, py)
      c.lineTo(cx - 5,  py)
      c.moveTo(cx + 5,  py)
      c.lineTo(cx + len, py)
      c.stroke()
      if (p % 10 === 0) c.fillText(`${p}`, cx + len + 2, py + 4)
      c.globalAlpha = 1
    }

    this.texture.needsUpdate = true
    void spec
    void _hmsCursorAz
    void _hmsCursorEl
  }

  dispose(): void {
    this.texture.dispose()
  }
}
