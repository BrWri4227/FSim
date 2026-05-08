import * as THREE from 'three'
import type { GunSpec, AircraftState } from '../types/aircraft'
import type { GunRoundState } from '../types/weapons'
import type { Aircraft } from '../entities/Aircraft'
import { updateGunRound } from './GunRound'
import { v3add, v3scale, quatRotateVec, nedToThree, v3dist } from '../utils/MathUtils'
import { applyHit } from '../systems/DamageModel'

const HIT_RADIUS = 5  // meters for gun kill

export class GunSystem {
  private spec: GunSpec | null
  private rounds: GunRoundState[] = []
  private remainingRounds: number
  private fireTimer = 0
  private roundMeshes: THREE.Mesh[] = []
  private scene: THREE.Scene

  private roundMat = new THREE.MeshBasicMaterial({ color: 0xffff00 })
  private roundGeo = new THREE.SphereGeometry(0.15, 4, 4)

  constructor(spec: GunSpec | null, scene: THREE.Scene) {
    this.spec = spec
    this.scene = scene
    this.remainingRounds = spec?.totalRounds ?? 0
  }

  fire(state: AircraftState, _spec: import('../types/aircraft').AircraftSpec): void {
    if (!this.spec || this.remainingRounds <= 0) return
    const interval = 60 / this.spec.rateOfFireRPM
    if (this.fireTimer > 0) return

    this.fireTimer = interval

    // Spawn round at aircraft nose, along body +x direction
    const bodyForward: [number,number,number] = [1, 0, 0]
    const forwardNED = quatRotateVec(state.attitudeQuat, bodyForward)
    const vel = v3add(state.velocityNED, v3scale(forwardNED, this.spec.muzzleVelocityMS))

    const round: GunRoundState = {
      positionNED: [...state.positionNED],
      velocityNED: vel,
      ageSec: 0,
      active: true,
      shooterEntityId: 'player',
      spec: this.spec
    }
    this.rounds.push(round)

    // Mesh
    const mesh = new THREE.Mesh(this.roundGeo, this.roundMat)
    mesh.position.copy(nedToThree(round.positionNED))
    this.scene.add(mesh)
    this.roundMeshes.push(mesh)

    this.remainingRounds--
  }

  update(dt: number, enemies: Aircraft[]): void {
    if (this.fireTimer > 0) this.fireTimer -= dt

    for (let i = this.rounds.length - 1; i >= 0; i--) {
      const round = this.rounds[i]!
      updateGunRound(round, dt)

      // Hit check
      for (const enemy of enemies) {
        if (v3dist(round.positionNED, enemy.state.positionNED) < HIT_RADIUS) {
          round.active = false
          // Vary hit zone by proximity position relative to target
          const dx = round.positionNED[0] - enemy.state.positionNED[0]
          const dz = round.positionNED[2] - enemy.state.positionNED[2]
          const dy = round.positionNED[1] - enemy.state.positionNED[1]
          let zone: import('../types/damage').DamageZone = 'FUSELAGE'
          if (Math.abs(dy) > 2.5 && dy < 0) zone = 'ENGINE'      // from below
          else if (Math.abs(dz) > 2.0) zone = Math.random() < 0.5 ? 'WING_LEFT' : 'WING_RIGHT'
          else if (dx > 3.0) zone = 'COCKPIT'                     // nose-on
          else if (dx < -3.0) zone = 'TAIL'
          applyHit(enemy.damage, zone, 0.22, enemy.state.invincible)
        }
      }

      // Update mesh
      const mesh = this.roundMeshes[i]!
      if (round.active) {
        mesh.position.copy(nedToThree(round.positionNED))
      } else {
        this.scene.remove(mesh)
        this.rounds.splice(i, 1)
        this.roundMeshes.splice(i, 1)
      }
    }
  }

  getRoundsRemaining(): number { return this.remainingRounds }
  refill(): void { this.remainingRounds = this.spec?.totalRounds ?? 0 }

  dispose(): void {
    for (const m of this.roundMeshes) this.scene.remove(m)
    this.roundGeo.dispose()
    this.roundMat.dispose()
  }
}
