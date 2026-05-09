import * as THREE from 'three'
import type { Vec3 } from '../types/common'
import type { GroundTarget } from '../entities/GroundTarget'
import { computeAtmosphere } from '../physics/Atmosphere'
import { ExplosionManager } from '../scene/ExplosionEffect'
import { nedToThree, v3add, v3scale, v3norm, v3len, quatRotateVec } from '../utils/MathUtils'

export interface BombSpec {
  id: string
  displayName: string
  /** Empty mass (kg). */
  massKg: number
  /** Body diameter (m) for drag calculation. */
  bodyDiameterM: number
  /** Drag coefficient at subsonic. */
  dragCd: number
  /** Lethal blast radius (m). */
  lethalRadiusM: number
  /** Damage applied at point-blank to a ground target. */
  damageAtCenter: number
  /** Optional laser-guided behavior — biases acceleration toward designated point. */
  laserGuided?: boolean
}

export const MK82: BombSpec = {
  id: 'mk82',
  displayName: 'Mk-82 (500 lb)',
  massKg: 227,
  bodyDiameterM: 0.273,
  dragCd: 0.18,
  lethalRadiusM: 50,
  damageAtCenter: 200,
}

export const GBU12: BombSpec = {
  id: 'gbu12',
  displayName: 'GBU-12 Paveway II',
  massKg: 230,
  bodyDiameterM: 0.273,
  dragCd: 0.16,
  lethalRadiusM: 55,
  damageAtCenter: 220,
  laserGuided: true,
}

export const BOMB_SPECS: Record<string, BombSpec> = {
  [MK82.id]: MK82,
  [GBU12.id]: GBU12,
}

interface BombInstance {
  spec: BombSpec
  positionNED: Vec3
  velocityNED: Vec3
  ageSec: number
  /** Optional designated impact point (for LGB), updated each frame by the targeting pod. */
  designatedNED: Vec3 | null
  mesh: THREE.Mesh
  active: boolean
}

const G0 = 9.80665

export class BombSystem {
  private bombs: BombInstance[] = []
  private scene: THREE.Scene
  private explosions: ExplosionManager
  private bombMat = new THREE.MeshPhongMaterial({ color: 0x303a30, shininess: 30 })
  private bombGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8)

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.explosions = new ExplosionManager(scene)
    this.bombGeo.rotateX(Math.PI / 2)  // long axis along +Z
  }

  /** Drop a bomb — initial velocity equals shooter velocity, no separation impulse. */
  drop(
    spec: BombSpec,
    shooterPos: Vec3,
    shooterVel: Vec3,
    shooterQuat: [number, number, number, number],
    hardpointBodyOffset?: Vec3,
    designatedNED: Vec3 | null = null,
  ): void {
    const hpNED = hardpointBodyOffset
      ? quatRotateVec(shooterQuat, hardpointBodyOffset)
      : ([0, 0, 0] as Vec3)
    const initPos: Vec3 = [
      shooterPos[0] + hpNED[0],
      shooterPos[1] + hpNED[1],
      shooterPos[2] + hpNED[2],
    ]
    const mesh = new THREE.Mesh(this.bombGeo, this.bombMat)
    this.scene.add(mesh)
    this.bombs.push({
      spec,
      positionNED: initPos,
      velocityNED: [...shooterVel] as Vec3,
      ageSec: 0,
      designatedNED: designatedNED ? [...designatedNED] as Vec3 : null,
      mesh,
      active: true,
    })
  }

  setDesignation(bombId: number, designatedNED: Vec3 | null): void {
    const b = this.bombs[bombId]
    if (b) b.designatedNED = designatedNED
  }

  update(dt: number, groundTargets: GroundTarget[]): void {
    this.explosions.update(dt)
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i]!
      if (!b.active) continue
      b.ageSec += dt

      const speed = v3len(b.velocityNED)
      const altM = Math.max(0, -b.positionNED[2])
      const rho = computeAtmosphere(altM, speed).densityKgM3
      const A = Math.PI * (b.spec.bodyDiameterM / 2) ** 2
      const dragAccel = (0.5 * rho * b.spec.dragCd * A * speed * speed) / b.spec.massKg
      const dragDir: Vec3 = speed > 0.1
        ? v3scale(v3norm(b.velocityNED), -dragAccel) as Vec3
        : [0, 0, 0]
      const gravity: Vec3 = [0, 0, G0]

      // LGB: bias toward designated point with bounded lateral acceleration.
      let guideAccel: Vec3 = [0, 0, 0]
      if (b.spec.laserGuided && b.designatedNED) {
        const dx = b.designatedNED[0] - b.positionNED[0]
        const dy = b.designatedNED[1] - b.positionNED[1]
        const dz = b.designatedNED[2] - b.positionNED[2]
        const dist = Math.max(1, Math.hypot(dx, dy, dz))
        // Modest correction acceleration — 6g cap, scaled by closure
        const cap = 60
        const k = 0.6
        guideAccel = [
          Math.max(-cap, Math.min(cap, k * dx / dist * speed)),
          Math.max(-cap, Math.min(cap, k * dy / dist * speed)),
          Math.max(-cap, Math.min(cap, k * dz / dist * speed * 0.4)),  // less vertical bias
        ]
      }

      const totalAccel = v3add(v3add(dragDir, gravity), guideAccel)
      b.velocityNED = v3add(b.velocityNED, v3scale(totalAccel, dt)) as Vec3
      b.positionNED = v3add(b.positionNED, v3scale(b.velocityNED, dt)) as Vec3

      // Ground impact OR ground-target proximity
      let detonated = false
      for (const gt of groundTargets) {
        if (gt.state.destroyed) continue
        const dx = b.positionNED[0] - gt.state.positionNED[0]
        const dy = b.positionNED[1] - gt.state.positionNED[1]
        const dz = b.positionNED[2] - gt.state.positionNED[2]
        const d2 = dx*dx + dy*dy + dz*dz
        if (d2 < b.spec.lethalRadiusM * b.spec.lethalRadiusM) {
          const d = Math.sqrt(d2)
          const falloff = 1 - d / b.spec.lethalRadiusM
          gt.applyDamage(b.spec.damageAtCenter * falloff)
          detonated = true
          break
        }
      }
      if (!detonated && b.positionNED[2] >= -0.5) {
        // Ground impact at sea level
        // Apply splash damage to nearby ground targets too
        for (const gt of groundTargets) {
          if (gt.state.destroyed) continue
          const dx = b.positionNED[0] - gt.state.positionNED[0]
          const dy = b.positionNED[1] - gt.state.positionNED[1]
          const d = Math.hypot(dx, dy)
          if (d < b.spec.lethalRadiusM) {
            const falloff = 1 - d / b.spec.lethalRadiusM
            gt.applyDamage(b.spec.damageAtCenter * falloff * 0.85)
          }
        }
        detonated = true
      }
      if (detonated) {
        this.explosions.spawn(nedToThree(b.positionNED))
        this.scene.remove(b.mesh)
        b.active = false
        this.bombs.splice(i, 1)
        continue
      }

      // Update mesh
      b.mesh.position.copy(nedToThree(b.positionNED))
      if (speed > 1) {
        const vDir = nedToThree(b.velocityNED).normalize()
        b.mesh.lookAt(b.mesh.position.clone().add(vDir))
      }

      // Safety timeout
      if (b.ageSec > 60) {
        this.scene.remove(b.mesh)
        b.active = false
        this.bombs.splice(i, 1)
      }
    }
  }

  getBombs(): ReadonlyArray<{ positionNED: Vec3; velocityNED: Vec3 }> {
    return this.bombs
  }

  dispose(): void {
    for (const b of this.bombs) this.scene.remove(b.mesh)
    this.bombs.length = 0
    this.bombGeo.dispose()
    this.bombMat.dispose()
    this.explosions.dispose()
  }
}
