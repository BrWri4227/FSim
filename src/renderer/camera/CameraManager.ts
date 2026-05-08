import * as THREE from 'three'
import { CockpitCamera } from './CockpitCamera'
import { ExternalCamera } from './ExternalCamera'
import type { PlayerAircraft } from '../entities/PlayerAircraft'

export type CameraMode = 'COCKPIT' | 'EXTERNAL'

export class CameraManager {
  private mode: CameraMode = 'COCKPIT'
  private cockpit: CockpitCamera
  private external: ExternalCamera
  readonly camera: THREE.PerspectiveCamera

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.cockpit = new CockpitCamera()
    this.external = new ExternalCamera()
    window.addEventListener('keydown', this.onKey)
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'Tab') {
      e.preventDefault()
      this.mode = this.mode === 'COCKPIT' ? 'EXTERNAL' : 'COCKPIT'
      // Exit pointer lock when switching to external
      if (this.mode === 'EXTERNAL') document.exitPointerLock()
    }
  }

  update(player: PlayerAircraft): void {
    if (this.mode === 'COCKPIT') {
      this.cockpit.update(this.camera, player)
    } else {
      this.external.update(this.camera, player)
    }
  }

  getMode(): CameraMode { return this.mode }
  getHeadAzDeg(): number { return this.cockpit.getHeadAzDeg() }
  getHeadElDeg(): number { return this.cockpit.getHeadElDeg() }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey)
    this.cockpit.dispose()
    this.external.dispose()
  }
}
