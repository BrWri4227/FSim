import * as THREE from 'three'
import type { AircraftState } from '../types/aircraft'
import type { RadarState } from '../types/radar'
import type { MissileState } from '../types/weapons'
import { nedToThree } from '../utils/MathUtils'

// Unit cone geometry: tip at origin, opens along +Z, radius = 1 at Z = 1.
// Reused for both the radar and seeker cones.  We bake the transforms once
// so each mesh only needs position / quaternion / scale updates per frame.
function makeUnitConeTipAtOrigin(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(1, 1, 16, 1, true)
  // Default: tip at Y = +0.5, base at Y = -0.5.
  // Step 1 — move tip to origin.
  geo.translate(0, -0.5, 0)    // tip → (0,0,0), base → (0,-1,0)
  // Step 2 — rotate X by -90° so the -Y axis becomes +Z.
  geo.rotateX(-Math.PI / 2)    // tip stays at origin, base → (0,0,1)
  return geo
}

const UNIT_CONE_GEO = makeUnitConeTipAtOrigin()
const FWD_AXIS = new THREE.Vector3(0, 0, 1)

// Reusable quaternion that orients the +Z axis of a mesh toward an arbitrary direction.
function quatToward(dir: THREE.Vector3, out = new THREE.Quaternion()): THREE.Quaternion {
  const len = dir.length()
  if (len < 1e-6) { out.identity(); return out }
  return out.setFromUnitVectors(FWD_AXIS, dir.clone().divideScalar(len))
}

export class DebugVisuals {
  private velocityArrow: THREE.ArrowHelper | null = null
  private radarCone: THREE.Mesh | null = null
  private seekerCones: Map<string, THREE.Mesh> = new Map()
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  update(state: AircraftState, radar: RadarState, missiles: MissileState[]): void {
    const showVelocity   = !!(window as any)['showVelocity']
    const showRadarCone  = !!(window as any)['showRadarCone']
    const showSeekerCone = !!(window as any)['showSeekerCone']

    // ── Velocity vector ───────────────────────────────────────────────────────
    if (showVelocity) {
      const vel3  = nedToThree(state.velocityNED)
      const speed = vel3.length()
      if (!this.velocityArrow) {
        this.velocityArrow = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(),
          10,
          0x00ffff,
          speed * 0.01,    // head length
          speed * 0.005    // head width
        )
        this.scene.add(this.velocityArrow)
      }
      this.velocityArrow.position.copy(nedToThree(state.positionNED))
      this.velocityArrow.setDirection(vel3.normalize())
      this.velocityArrow.setLength(speed * 0.05, speed * 0.012, speed * 0.006)
    } else {
      this.removeVelocityArrow()
    }

    // ── Radar scan cone ───────────────────────────────────────────────────────
    // Shows the forward scan volume.  The cone apex sits at the aircraft;
    // the base disc represents the maximum detection range.
    if (showRadarCone && radar.mode !== 'OFF') {
      if (!this.radarCone) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x00ff44,
          wireframe: true,
          transparent: true,
          opacity: 0.25,
        })
        this.radarCone = new THREE.Mesh(UNIT_CONE_GEO, mat)
        this.scene.add(this.radarCone)
      }

      // Radar covers ±60° azimuth → 60° half-angle on each side
      const rangeM     = radar.rangeModeM
      const halfAngle  = 60 * (Math.PI / 180)
      const baseRadius = rangeM * Math.tan(halfAngle)

      // Scale: XY = base radius, Z = length
      this.radarCone.scale.set(baseRadius, baseRadius, rangeM)
      this.radarCone.position.copy(nedToThree(state.positionNED))

      // Orient the cone along the aircraft's velocity vector (best forward proxy)
      const vel3 = nedToThree(state.velocityNED)
      if (vel3.length() > 1) {
        this.radarCone.quaternion.copy(quatToward(vel3))
      }
    } else {
      this.removeRadarCone()
    }

    // ── Missile seeker cones ──────────────────────────────────────────────────
    // One translucent orange cone per in-flight missile; oriented along the
    // missile's velocity (= body axis approximation) and sized to its gimbal limit.
    if (showSeekerCone) {
      // Remove stale entries
      const activeIds = new Set(missiles.map(m => m.id))
      for (const [id, cone] of this.seekerCones) {
        if (!activeIds.has(id)) {
          this.scene.remove(cone)
          this.seekerCones.delete(id)
        }
      }

      for (const m of missiles) {
        if (!this.seekerCones.has(m.id)) {
          const color = m.spec.category === 'IR_MISSILE' ? 0xff6600 : 0x4466ff
          const mat = new THREE.MeshBasicMaterial({
            color,
            wireframe: true,
            transparent: true,
            opacity: 0.45,
          })
          const cone = new THREE.Mesh(UNIT_CONE_GEO, mat)
          this.scene.add(cone)
          this.seekerCones.set(m.id, cone)
        }

        const cone = this.seekerCones.get(m.id)!
        const gimbalDeg = m.spec.irSeeker?.gimbalLimitDeg ?? 30
        const seekerRangeM = 8000  // nominal visual depth of the seeker cone

        const halfG    = gimbalDeg * (Math.PI / 180)
        const coneR    = seekerRangeM * Math.tan(halfG)

        cone.scale.set(coneR, coneR, seekerRangeM)
        cone.position.copy(nedToThree(m.positionNED))

        const dir = nedToThree(m.velocityNED)
        if (dir.length() > 1) {
          cone.quaternion.copy(quatToward(dir))
        }
      }
    } else {
      for (const cone of this.seekerCones.values()) this.scene.remove(cone)
      this.seekerCones.clear()
    }
  }

  private removeVelocityArrow(): void {
    if (this.velocityArrow) {
      this.scene.remove(this.velocityArrow)
      this.velocityArrow = null
    }
  }

  private removeRadarCone(): void {
    if (this.radarCone) {
      this.scene.remove(this.radarCone)
      this.radarCone = null
    }
  }

  dispose(): void {
    this.removeVelocityArrow()
    this.removeRadarCone()
    for (const cone of this.seekerCones.values()) this.scene.remove(cone)
    this.seekerCones.clear()
  }
}
