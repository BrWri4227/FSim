import * as THREE from 'three'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import { nedToThree } from '../utils/MathUtils'
import { clamp } from '../utils/MathUtils'

export class ExternalCamera {
  private distance = 30
  // azimuth=0 → offset is in +Z direction (Three.js South), which is behind an
  // aircraft heading North (-Z). camera.lookAt() then faces the tail. π would
  // place the camera in front of the aircraft (head-on view).
  private azimuth = 0
  private elevation = 0.3
  private isDragging = false
  private lastMouse = { x: 0, y: 0 }
  private active = true
  /** World position of the padlocked bandit, or null when nothing is designated. */
  private padlockTarget: THREE.Vector3 | null = null
  private lookBack = false

  /** Keep this world point in frame with our own aircraft. Null releases it. */
  setPadlockTarget(worldPos: THREE.Vector3 | null): void {
    this.padlockTarget = worldPos
  }

  setLookBack(held: boolean): void { this.lookBack = held }

  constructor() {
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup',   this.onMouseUp)
    window.addEventListener('wheel',     this.onWheel, { passive: true })
  }

  /** Called by CameraManager so the inactive camera ignores mouse input. */
  setActive(active: boolean): void {
    this.active = active
    if (!active) this.isDragging = false
  }

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 2 && this.active) { this.isDragging = true; this.lastMouse = { x: e.clientX, y: e.clientY } }
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

    // Padlock: sit on the far side of our own aircraft from the bandit, so both
    // are in frame with the bandit beyond the nose. This is the answer to "I
    // lost him" — the chase view has no idea where the fight went otherwise.
    if (this.padlockTarget) {
      const toBandit = this.padlockTarget.clone().sub(target)
      if (toBandit.lengthSq() > 1) {
        toBandit.normalize()
        camera.position
          .copy(target)
          .addScaledVector(toBandit, -this.distance)
          .addScaledVector(new THREE.Vector3(0, 1, 0), this.distance * 0.22)
        camera.lookAt(target)
        camera.near = 0.5
        camera.fov = 60
        camera.updateProjectionMatrix()
        return
      }
    }

    // Look-back swings the orbit round the nose without disturbing the pilot's
    // chosen azimuth, so releasing the key puts the view back where it was.
    const azimuth = this.lookBack ? this.azimuth + Math.PI : this.azimuth
    const offset = new THREE.Vector3(
      Math.sin(azimuth) * Math.cos(this.elevation),
      Math.sin(this.elevation),
      Math.cos(azimuth) * Math.cos(this.elevation)
    ).multiplyScalar(this.distance)

    camera.position.copy(target).add(offset)
    camera.lookAt(target)
    camera.near = 0.5
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
