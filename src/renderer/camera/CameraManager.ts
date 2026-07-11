import * as THREE from 'three'
import { CockpitCamera } from './CockpitCamera'
import { ExternalCamera } from './ExternalCamera'
import type { PlayerAircraft } from '../entities/PlayerAircraft'

export type CameraMode = 'COCKPIT' | 'EXTERNAL'

import { COCKPIT_VIEW_LAYER, PLAYER_EXTERNAL_LAYER } from './CameraLayers'

export class CameraManager {
  private mode: CameraMode = 'COCKPIT'
  private cockpit: CockpitCamera
  private external: ExternalCamera
  readonly camera: THREE.PerspectiveCamera

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.cockpit = new CockpitCamera()
    this.external = new ExternalCamera()
    this.applyLayerMask()
    window.addEventListener('keydown', this.onKey)
  }

  private applyLayerMask(): void {
    if (this.mode === 'COCKPIT') {
      this.camera.layers.set(COCKPIT_VIEW_LAYER)
    } else {
      this.camera.layers.enable(COCKPIT_VIEW_LAYER)
      this.camera.layers.enable(PLAYER_EXTERNAL_LAYER)
    }
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'Tab') {
      e.preventDefault()
      this.mode = this.mode === 'COCKPIT' ? 'EXTERNAL' : 'COCKPIT'
      this.applyLayerMask()
      // Exit pointer lock when switching to external
      if (this.mode === 'EXTERNAL') document.exitPointerLock()
    }
  }

  update(player: PlayerAircraft): void {
    player.setCockpitViewActive(this.mode === 'COCKPIT')
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
