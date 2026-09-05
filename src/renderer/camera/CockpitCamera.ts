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
  /**
   * Wider limits for the assisted looks (look-back, padlock). A pilot craning
   * over the shoulder reaches much further than a comfortable mouse-drag, and
   * "check six" is unreachable inside MAX_YAW by definition.
   */
  private readonly MAX_YAW_ASSISTED   = 2.79    // ±160°
  private readonly MAX_PITCH_ASSISTED = 1.05    // ±60°
  /** Per-second fraction by which head recenters when freelook is released. */
  private readonly RETURN_RATE = 12

  private lookBack = false
  /** Direction to the padlocked bandit in NED body frame [fwd, right, down], or null. */
  private padlockDirBody: [number, number, number] | null = null

  /** Hold to crane over the shoulder; releasing eases back to boresight. */
  setLookBack(held: boolean): void { this.lookBack = held }

  /** Keep the head on this bandit. Null releases it. */
  setPadlockDirBody(dirBody: [number, number, number] | null): void {
    this.padlockDirBody = dirBody
  }

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

    // Mouse drag always wins. Otherwise the head is either being held somewhere
    // by an assisted look, or easing back to boresight.
    const assisted = this.resolveAssistedLook()
    if (this.looking) {
      // yaw/pitch were already set by onMouseMove.
    } else if (assisted) {
      const k = 1 - Math.exp(-this.RETURN_RATE * dt)
      this.yaw   += (assisted.yaw   - this.yaw)   * k
      this.pitch += (assisted.pitch - this.pitch) * k
    } else {
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

  /**
   * Where the head wants to be this frame, or null to fall back to the
   * boresight ease. Padlock outranks look-back: if the pilot has designated a
   * bandit, that is the thing they are trying to keep in sight.
   *
   * Sign conventions follow the mouse: dragging right decreases yaw, so
   * negative yaw looks right; dragging down decreases pitch, so negative pitch
   * looks down.
   */
  private resolveAssistedLook(): { yaw: number; pitch: number } | null {
    const dir = this.padlockDirBody
    if (dir) {
      const [fwd, right, down] = dir
      const horizontal = Math.hypot(fwd, right)
      return {
        yaw: clamp(-Math.atan2(right, fwd), -this.MAX_YAW_ASSISTED, this.MAX_YAW_ASSISTED),
        pitch: clamp(-Math.atan2(down, horizontal), -this.MAX_PITCH_ASSISTED, this.MAX_PITCH_ASSISTED),
      }
    }
    if (this.lookBack) {
      // Go over whichever shoulder the head is already nearer, so a check-six
      // from a right-hand freelook does not whip across the nose to get there.
      const side = this.yaw < -0.05 ? -1 : 1
      return { yaw: side * this.MAX_YAW_ASSISTED, pitch: 0 }
    }
    return null
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
