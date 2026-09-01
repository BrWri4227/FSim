import * as THREE from 'three'
import { buildMissileMesh, getSharedMissileMaterials } from './MissileSystem'
import { ThrusterEffect, RocketTrail } from '../scene/ThrusterEffect'
import type { ExplosionManager } from '../scene/ExplosionEffect'
import { nedToThree } from '../utils/MathUtils'

// Module-level scratch — no per-frame allocation.
const _pos = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _lookAt = new THREE.Vector3()

/** Approximate rocket-motor burn used to fade the exhaust plume (net state has no burn flag). */
const ASSUMED_BURN_SEC = 5

/**
 * Client-side visual for a missile owned by a remote player.
 *
 * The network only carries `{ position, velocity }` at the snapshot rate, so
 * without help a remote missile is a dim 2 m dart that teleports ~50 m per
 * packet and vanishes silently on impact. This class gives it:
 *   - velocity extrapolation between packets (smooth motion, no stutter)
 *   - a smoke trail + exhaust plume so an incoming shot is actually readable
 *   - a detonation flash when it leaves the peer's active-missile set
 */
export class RemoteMissileVisual {
  private readonly group: THREE.Group
  private readonly rearMount: THREE.Object3D
  private readonly thruster: ThrusterEffect
  private readonly trail: RocketTrail
  private readonly scene: THREE.Scene

  private netPosNED: [number, number, number]
  private netVelNED: [number, number, number]
  private msSinceNetUpdate = 0
  private ageSec = 0

  constructor(scene: THREE.Scene, posNED: [number, number, number], velNED: [number, number, number]) {
    this.scene = scene
    this.netPosNED = [...posNED]
    this.netVelNED = [...velNED]

    const [bodyMat, finMat] = getSharedMissileMaterials()
    this.group = buildMissileMesh(bodyMat, finMat)
    this.group.position.copy(nedToThree(posNED))
    scene.add(this.group)

    this.rearMount = new THREE.Object3D()
    this.rearMount.position.set(0, 0, -1.35)
    this.group.add(this.rearMount)
    this.thruster = new ThrusterEffect(this.rearMount, 1.4)

    this.trail = new RocketTrail(scene, 80, 1.4)
  }

  /** Fresh network sample for this missile. */
  onNetUpdate(posNED: [number, number, number], velNED: [number, number, number]): void {
    this.netPosNED = [...posNED]
    this.netVelNED = [...velNED]
    this.msSinceNetUpdate = 0
  }

  update(dtSec: number): void {
    this.ageSec += dtSec
    this.msSinceNetUpdate += dtSec * 1000

    // Dead-reckon from the last sample. Clamp so a dropped peer doesn't send
    // the mesh flying off — matches NetworkAircraft's extrapolation budget.
    const extrapSec = Math.min(this.msSinceNetUpdate / 1000, 0.3)
    _pos.set(
      this.netPosNED[1] + this.netVelNED[1] * extrapSec,
      -(this.netPosNED[2] + this.netVelNED[2] * extrapSec),
      -(this.netPosNED[0] + this.netVelNED[0] * extrapSec),
    )
    this.group.position.copy(_pos)

    const speed = Math.hypot(this.netVelNED[0], this.netVelNED[1], this.netVelNED[2])
    if (speed > 1) {
      _dir.set(this.netVelNED[1], -this.netVelNED[2], -this.netVelNED[0]).normalize()
      _lookAt.addVectors(this.group.position, _dir)
      this.group.lookAt(_lookAt)
    }

    const burnIntensity = Math.max(0, 1 - this.ageSec / ASSUMED_BURN_SEC)
    this.thruster.update(burnIntensity, false, dtSec)
    if (burnIntensity > 0.05) this.trail.addPoint(this.group.position)
    this.trail.update(dtSec)
  }

  /** Detonation flash at the missile's current position. */
  explode(explosions: ExplosionManager): void {
    explosions.spawn(this.group.position.clone())
  }

  dispose(): void {
    this.scene.remove(this.group)
    this.thruster.dispose()
    this.trail.dispose()
  }
}
