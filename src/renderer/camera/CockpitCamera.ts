import * as THREE from 'three'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import { nedToThree, nedQuatToThree } from '../utils/MathUtils'
import { clamp } from '../utils/MathUtils'

export class CockpitCamera {
  private yaw = 0    // head look yaw, radians
  private pitch = 0  // head look pitch, radians
  private dragSensitivity = 0.005

  private active = true
  private looking = false
  private lastMouse = { x: 0, y: 0 }

  private readonly MAX_YAW   = Math.PI / 2.2   // ±80°
  private readonly MAX_PITCH = 0.7              // ±40°
  /** Per-second fraction by which head recenters when freelook is released. */
  private readonly RETURN_RATE = 12

  constructor() {
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('blur', this.onBlur)
  }

  /** Called by CameraManager so the inactive camera ignores mouse input. */
  setActive(active: boolean): void {
    this.active = active
    if (!active) this.looking = false
  }

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 2 || !this.active) return
    this.looking = true
    this.lastMouse = { x: e.clientX, y: e.clientY }
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.looking) return
    const dx = e.clientX - this.lastMouse.x
    const dy = e.clientY - this.lastMouse.y
    this.lastMouse = { x: e.clientX, y: e.clientY }
    this.yaw   = clamp(this.yaw   - dx * this.dragSensitivity, -this.MAX_YAW, this.MAX_YAW)
    this.pitch = clamp(this.pitch - dy * this.dragSensitivity, -this.MAX_PITCH, this.MAX_PITCH)
  }

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 2) this.looking = false
  }

  private onBlur = () => { this.looking = false }

  update(camera: THREE.PerspectiveCamera, player: PlayerAircraft, dt = 0.016): void {
    const { spec, state } = player

    // Ease the head back to boresight once the pilot releases freelook.
    if (!this.looking) {
      const k = Math.exp(-this.RETURN_RATE * dt)
      this.yaw   *= k
      this.pitch *= k
      if (Math.abs(this.yaw)   < 1e-4) this.yaw = 0
      if (Math.abs(this.pitch) < 1e-4) this.pitch = 0
    }

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

    camera.near = 0.05
    camera.fov = spec.cockpitFovDeg
    camera.updateProjectionMatrix()
  }

  getHeadAzDeg(): number { return this.yaw * (180 / Math.PI) }
  getHeadElDeg(): number { return this.pitch * (180 / Math.PI) }

  dispose(): void {
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('blur', this.onBlur)
  }
}
