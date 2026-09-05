import * as THREE from 'three'
import { CockpitCamera } from './CockpitCamera'
import { ExternalCamera } from './ExternalCamera'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import { nedToThree, quatConjugate, quatRotateVec } from '../utils/MathUtils'

export type CameraMode = 'COCKPIT' | 'EXTERNAL'

import { COCKPIT_VIEW_LAYER, PLAYER_EXTERNAL_LAYER } from './CameraLayers'

export class CameraManager {
  private mode: CameraMode = 'COCKPIT'
  private cockpit: CockpitCamera
  private external: ExternalCamera
  private padlockEnabled = false
  readonly camera: THREE.PerspectiveCamera

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.cockpit = new CockpitCamera()
    this.external = new ExternalCamera()
    this.applyLayerMask()
    this.applyActiveCamera()
    window.addEventListener('keydown', this.onKey)
  }

  private applyActiveCamera(): void {
    this.cockpit.setActive(this.mode === 'COCKPIT')
    this.external.setActive(this.mode === 'EXTERNAL')
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
      this.toggleMode()
    }
  }

  /** Swap cockpit / external view. Shared by the Tab key and the controller. */
  toggleMode(): void {
    this.mode = this.mode === 'COCKPIT' ? 'EXTERNAL' : 'COCKPIT'
    this.applyLayerMask()
    this.applyActiveCamera()
  }

  update(player: PlayerAircraft, dt = 0.016): void {
    player.setCockpitViewActive(this.mode === 'COCKPIT')
    if (this.mode === 'COCKPIT') {
      this.cockpit.update(this.camera, player, dt)
    } else {
      this.external.update(this.camera, player)
    }
  }

  /** Hold-to-check-six, applied to whichever view is active. */
  setLookBack(held: boolean): void {
    this.cockpit.setLookBack(held)
    this.external.setLookBack(held)
  }

  /** Flip padlock on/off. The session supplies the target each frame. */
  togglePadlock(): void {
    this.padlockEnabled = !this.padlockEnabled
    if (!this.padlockEnabled) this.setPadlockTarget(null)
  }

  isPadlockEnabled(): boolean { return this.padlockEnabled }

  /**
   * Point the padlock at a bandit. Ignored while padlock is switched off, and
   * `null` releases it — so losing the lock releases the view rather than
   * leaving the head stuck where the bandit used to be.
   */
  setPadlockTarget(targetNED: readonly [number, number, number] | null, ownState?: PlayerAircraft['state']): void {
    if (!this.padlockEnabled || !targetNED || !ownState) {
      this.cockpit.setPadlockDirBody(null)
      this.external.setPadlockTarget(null)
      return
    }
    const toTargetNED: [number, number, number] = [
      targetNED[0] - ownState.positionNED[0],
      targetNED[1] - ownState.positionNED[1],
      targetNED[2] - ownState.positionNED[2],
    ]
    // The cockpit head works in body axes; the chase camera works in world space.
    this.cockpit.setPadlockDirBody(quatRotateVec(quatConjugate(ownState.attitudeQuat), toTargetNED))
    this.external.setPadlockTarget(nedToThree(targetNED as [number, number, number]))
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
