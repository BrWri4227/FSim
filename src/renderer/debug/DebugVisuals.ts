import * as THREE from 'three'
import type { AircraftState } from '../types/aircraft'
import type { RadarState } from '../types/radar'
import type { MissileState } from '../types/weapons'
import { nedToThree } from '../utils/MathUtils'

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

    // Velocity arrow
    if (showVelocity) {
      if (!this.velocityArrow) {
        this.velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 1, 0x00ffff)
        this.scene.add(this.velocityArrow)
      }
      const vel3 = nedToThree(state.velocityNED)
      const speed = vel3.length()
      this.velocityArrow.setDirection(vel3.clone().normalize())
      this.velocityArrow.setLength(speed * 0.04)
      this.velocityArrow.position.copy(nedToThree(state.positionNED))
    } else {
      this.removeVelocityArrow()
    }

    // Radar cone
    if (showRadarCone && radar.mode !== 'OFF') {
      if (!this.radarCone) {
        const geo = new THREE.ConeGeometry(1, 1, 12, 1, true)
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.3 })
        this.radarCone = new THREE.Mesh(geo, mat)
        this.scene.add(this.radarCone)
      }
      const rangeM = radar.rangeModeM
      const halfAngle = Math.PI / 3  // 60°
      const r = rangeM * Math.tan(halfAngle)
      this.radarCone.scale.set(r, rangeM, r)
      this.radarCone.position.copy(nedToThree(state.positionNED))
      // Orient along aircraft forward (Three.js -Z = forward after model rotation)
    } else {
      this.removeRadarCone()
    }

    // Seeker cones
    if (showSeekerCone) {
      const activeIds = new Set(missiles.map(m => m.id))
      for (const [id, cone] of this.seekerCones) {
        if (!activeIds.has(id)) {
          this.scene.remove(cone)
          this.seekerCones.delete(id)
        }
      }
      for (const m of missiles) {
        if (!this.seekerCones.has(m.id)) {
          const geo = new THREE.ConeGeometry(0.3, 1, 8, 1, true)
          const mat = new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true, transparent: true, opacity: 0.5 })
          const cone = new THREE.Mesh(geo, mat)
          this.scene.add(cone)
          this.seekerCones.set(m.id, cone)
        }
        const cone = this.seekerCones.get(m.id)!
        const gimbalDeg = m.spec.irSeeker?.gimbalLimitDeg ?? 30
        cone.scale.setScalar(gimbalDeg * 0.5)
        cone.position.copy(nedToThree(m.positionNED))
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
