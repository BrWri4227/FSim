import * as THREE from 'three'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import { nedToThree, nedQuatToThree } from '../utils/MathUtils'
import { clamp } from '../utils/MathUtils'

export class CockpitCamera {
  private yaw = 0    // head look yaw, radians
  private pitch = 0  // head look pitch, radians
  private mouseSensitivity = 0.002

  private readonly MAX_YAW   = Math.PI / 2.2   // ±80°
  private readonly MAX_PITCH = 0.7              // ±40°

  constructor() {
    window.addEventListener('mousemove', this.onMouse)
    // Lock pointer on click
    document.getElementById('three-canvas')?.addEventListener('click', () => {
      document.getElementById('three-canvas')?.requestPointerLock()
    })
  }

  private onMouse = (e: MouseEvent) => {
    if (document.pointerLockElement) {
      this.yaw   = clamp(this.yaw   - e.movementX * this.mouseSensitivity, -this.MAX_YAW, this.MAX_YAW)
      this.pitch = clamp(this.pitch - e.movementY * this.mouseSensitivity, -this.MAX_PITCH, this.MAX_PITCH)
    }
  }

  update(camera: THREE.PerspectiveCamera, player: PlayerAircraft): void {
    const { spec, state } = player

    // Aircraft position in Three.js world
    const aircraftPos = nedToThree(state.positionNED)
    const aircraftQuat = nedQuatToThree(state.attitudeQuat)

    // Pilot eye point in body frame → world
    const [ex, ey, ez] = spec.pilotEyePointM
    const eyeBody = new THREE.Vector3(ex, ey, ez)
    eyeBody.applyQuaternion(aircraftQuat)
    const eyeWorld = aircraftPos.clone().add(eyeBody)

    // Slight G-effect head shake
    const gShake = Math.max(0, state.gCurrent - 4) * 0.008
    eyeWorld.y += (Math.random() - 0.5) * gShake

    camera.position.copy(eyeWorld)

    // Build look quaternion: aircraft attitude + head look
    const headYaw   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), -this.yaw)
    const headPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), this.pitch)
    camera.quaternion.copy(aircraftQuat).multiply(headYaw).multiply(headPitch)

    camera.fov = spec.cockpitFovDeg
    camera.updateProjectionMatrix()
  }

  getHeadAzDeg(): number { return this.yaw * (180 / Math.PI) }
  getHeadElDeg(): number { return this.pitch * (180 / Math.PI) }

  dispose(): void {
    window.removeEventListener('mousemove', this.onMouse)
  }
}
