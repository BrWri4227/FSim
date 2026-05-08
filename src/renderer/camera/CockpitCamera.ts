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

  private onCanvasClick = (): void => {
    document.getElementById('three-canvas')?.requestPointerLock()
  }

  constructor() {
    window.addEventListener('mousemove', this.onMouse)
    document.getElementById('three-canvas')?.addEventListener('click', this.onCanvasClick)
  }

  private onMouse = (e: MouseEvent) => {
    if (document.pointerLockElement) {
      this.yaw   = clamp(this.yaw   - e.movementX * this.mouseSensitivity, -this.MAX_YAW, this.MAX_YAW)
      this.pitch = clamp(this.pitch - e.movementY * this.mouseSensitivity, -this.MAX_PITCH, this.MAX_PITCH)
    }
  }

  update(camera: THREE.PerspectiveCamera, player: PlayerAircraft): void {
    const { spec, state } = player

    // Aircraft position / attitude in Three.js world
    const aircraftPos  = nedToThree(state.positionNED)
    const aircraftQuat = nedQuatToThree(state.attitudeQuat)

    // pilotEyePointM is in NED body frame: [forward, right, down]
    // Convert to Three.js body frame: right=+X, up=+Y, -forward=-Z
    //   Three.x = NED.right (ey)
    //   Three.y = -NED.down  (-ez)
    //   Three.z = -NED.fwd   (-ex)
    const [ex, ey, ez] = spec.pilotEyePointM
    const eyeThreeBody = new THREE.Vector3(ey, -ez, -ex)
    eyeThreeBody.applyQuaternion(aircraftQuat)
    const eyeWorld = aircraftPos.clone().add(eyeThreeBody)

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
    document.getElementById('three-canvas')?.removeEventListener('click', this.onCanvasClick)
  }
}
