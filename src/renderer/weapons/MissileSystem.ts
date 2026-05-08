import * as THREE from 'three'
import type { MissileState } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import type { Aircraft } from '../entities/Aircraft'
import { guideMissile } from './MissileGuidance'
import { checkProximityFuse, computeLethality, hitZoneFromMissileApproach } from './Warhead'
import { v3add, v3scale, v3norm, v3dist, nedToThree, v3len, quatRotateVec } from '../utils/MathUtils'
import { AIM9M }   from '../data/weapons/aim9m'
import { AIM120B } from '../data/weapons/aim120b'
import { R73 }     from '../data/weapons/r73'
import { R77 }     from '../data/weapons/r77'
import type { MissileSpec } from '../types/weapons'
import { applyHit } from '../systems/DamageModel'
import { ExplosionManager } from '../scene/ExplosionEffect'

const MISSILE_SPECS: Record<string, MissileSpec> = { aim9m: AIM9M, aim120b: AIM120B, r73: R73, r77: R77 }
const G0 = 9.80665

export class MissileSystem {
  private missiles: MissileState[] = []
  private meshes: THREE.Mesh[] = []
  private scene: THREE.Scene
  private explosions: ExplosionManager
  private missileMat = new THREE.MeshPhongMaterial({ color: 0xdddddd })
  private missileGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5, 6)

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.explosions = new ExplosionManager(scene)
  }

  launch(weaponId: string, shooterState: AircraftState, targetId: string, shooterEntityId: string): void {
    const spec = MISSILE_SPECS[weaponId]
    if (!spec) return

    // Initial velocity: shooter velocity + muzzle impulse
    const bodyForward: [number,number,number] = [1, 0, 0]
    const forwardNED = quatRotateVec(shooterState.attitudeQuat, bodyForward)
    const initVel = v3add(shooterState.velocityNED, v3scale(forwardNED, 50))

    const missile: MissileState = {
      id: `missile_${Date.now()}_${Math.random()}`,
      spec,
      positionNED: [...shooterState.positionNED],
      velocityNED: initVel,
      attitudeQuat: [...shooterState.attitudeQuat],
      ageSec: 0,
      burnActive: true,
      targetEntityId: targetId,
      guidanceMode: spec.category === 'IR_MISSILE' ? 'IR_TRACK' : 'INERTIAL',
      seekerAzDeg: 0,
      seekerElDeg: 0,
      locked: true,
      prevLOSUnit: v3norm(forwardNED),
      active: true,
      shooterEntityId,
    }
    this.missiles.push(missile)

    // Mesh
    const mesh = new THREE.Mesh(this.missileGeo, this.missileMat)
    this.scene.add(mesh)
    this.meshes.push(mesh)
  }

  update(dt: number, shooterState: AircraftState, enemies: Aircraft[]): void {
    this.explosions.update(dt)

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i]!
      m.ageSec += dt

      // Engine
      if (m.burnActive && m.ageSec > m.spec.burnTimeSec) m.burnActive = false
      const thrustAccel = m.burnActive ? m.spec.maxThrustN / m.spec.massKg : 0

      // Find target
      const target = enemies.find(e => e.entityId === m.targetEntityId)
        ?? (m.targetEntityId === 'player' ? null : null)

      // Guidance
      let guidanceAccel: [number,number,number] = [0, 0, 0]
      if (target && m.locked) {
        guidanceAccel = guideMissile(m, target.state, dt)

        // Proximity fuse
        if (checkProximityFuse(m, target.state)) {
          const lethality = computeLethality(m.positionNED, target.state.positionNED, m.spec.lethalRadiusM)
          if (lethality > 0.3) {
            const zone = hitZoneFromMissileApproach(m.velocityNED, target.state.attitudeQuat)
            applyHit(target.damage, zone, lethality * 0.6)
          }
          this.explode(i, m)
          continue
        }
      }

      // Integrate: simple Euler for missile (fast and cheap)
      const speed = v3len(m.velocityNED)
      const rho = 0.9  // approx
      const A = Math.PI * (m.spec.bodyDiameterM / 2) ** 2
      const dragAccel = (0.5 * rho * m.spec.dragCd * A * speed * speed) / m.spec.massKg
      const dragDir = speed > 0.1 ? v3scale(v3norm(m.velocityNED), -dragAccel) : [0,0,0] as [number,number,number]

      const gravity: [number,number,number] = [0, 0, G0]
      const forward = v3norm(m.velocityNED) as [number,number,number]
      const thrustVec = v3scale(forward, thrustAccel)

      const totalAccel = v3add(v3add(v3add(thrustVec, dragDir), gravity), guidanceAccel)
      m.velocityNED = v3add(m.velocityNED, v3scale(totalAccel, dt)) as [number,number,number]
      m.positionNED = v3add(m.positionNED, v3scale(m.velocityNED, dt)) as [number,number,number]

      // Max range / ground hit
      if (m.ageSec > m.spec.maxRangeM / 400 || m.positionNED[2] > 0) {
        this.explode(i, m)
        continue
      }

      // Update mesh
      const mesh = this.meshes[i]!
      mesh.position.copy(nedToThree(m.positionNED))
      if (speed > 1) {
        const dir = nedToThree(m.velocityNED).normalize()
        mesh.lookAt(mesh.position.clone().add(dir))
      }
    }
  }

  private explode(i: number, m: MissileState): void {
    this.explosions.spawn(nedToThree(m.positionNED))
    this.scene.remove(this.meshes[i]!)
    this.missiles.splice(i, 1)
    this.meshes.splice(i, 1)
  }

  getMissiles(): MissileState[] { return this.missiles }

  dispose(): void {
    for (const m of this.meshes) this.scene.remove(m)
    this.missileMat.dispose()
    this.missileGeo.dispose()
    this.explosions.dispose()
  }
}
