import * as THREE from 'three'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import { nedToThree } from '../utils/MathUtils'
import { clamp } from '../utils/MathUtils'

export class ExternalCamera {
  private distance = 30
  private azimuth = Math.PI    // behind aircraft
  private elevation = 0.3
  private isDragging = false
  private lastMouse = { x: 0, y: 0 }

  constructor() {
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup',   this.onMouseUp)
    window.addEventListener('wheel',     this.onWheel, { passive: true })
  }

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 2) { this.isDragging = true; this.lastMouse = { x: e.clientX, y: e.clientY } }
  }
  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return
    const dx = e.clientX - this.lastMouse.x
    const dy = e.clientY - this.lastMouse.y
    this.azimuth   += dx * 0.006
    this.elevation = clamp(this.elevation - dy * 0.006, -0.5, 1.2)
    this.lastMouse = { x: e.clientX, y: e.clientY }
  }
  private onMouseUp = (e: MouseEvent) => { if (e.button === 2) this.isDragging = false }
  private onWheel = (e: WheelEvent) => {
    this.distance = clamp(this.distance + e.deltaY * 0.05, 8, 200)
  }

  update(camera: THREE.PerspectiveCamera, player: PlayerAircraft): void {
    const target = nedToThree(player.state.positionNED)
    const offset = new THREE.Vector3(
      Math.sin(this.azimuth) * Math.cos(this.elevation),
      Math.sin(this.elevation),
      Math.cos(this.azimuth) * Math.cos(this.elevation)
    ).multiplyScalar(this.distance)

    camera.position.copy(target).add(offset)
    camera.lookAt(target)
    camera.fov = 60
    camera.updateProjectionMatrix()
  }

  dispose(): void {
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup',   this.onMouseUp)
    window.removeEventListener('wheel',     this.onWheel)
  }
}
