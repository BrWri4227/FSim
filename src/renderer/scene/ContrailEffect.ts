import * as THREE from 'three'

const CONTRAIL_ALTITUDE_M = 7500
const SEGMENT_LIFETIME    = 10.0
const SPAWN_INTERVAL      = 0.06  // seconds between spawns

// Shared geometry — created once, never disposed individually
const _contrailGeo = new THREE.PlaneGeometry(1.0, 1.0)

interface PoolSlot {
  mesh: THREE.Mesh
  mat:  THREE.MeshBasicMaterial
  age:  number
  live: boolean
}

/**
 * Pooled contrail effect.  All geometry and materials are pre-allocated at
 * construction — no per-spawn allocations during flight.
 */
export class ContrailEffect {
  private readonly pool: PoolSlot[] = []
  private readonly scene: THREE.Scene
  private readonly freeStack: number[] = []   // indices of inactive pool slots
  private readonly liveStack: number[] = []   // indices of active  pool slots
  private timeSinceLast = 0

  constructor(scene: THREE.Scene, maxSegments = 80) {
    this.scene = scene
    for (let i = 0; i < maxSegments; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xddeeff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(_contrailGeo, mat)
      mesh.visible = false
      this.pool.push({ mesh, mat, age: 0, live: false })
      this.freeStack.push(i)
    }
  }

  update(worldPos: THREE.Vector3, altitudeM: number, isActive: boolean, dt: number): void {
    this.timeSinceLast += dt

    // Spawn a new segment from the pool
    if (isActive && altitudeM > CONTRAIL_ALTITUDE_M && this.timeSinceLast >= SPAWN_INTERVAL) {
      this.timeSinceLast = 0
      const idx = this.freeStack.pop()
      if (idx !== undefined) {
        const seg = this.pool[idx]!
        seg.live = true
        seg.age  = 0
        seg.mat.opacity = 0
        seg.mesh.position.copy(worldPos)
        seg.mesh.scale.setScalar(0.8)
        seg.mesh.visible = true
        this.scene.add(seg.mesh)
        this.liveStack.push(idx)
      }
    }

    // Age all live segments
    for (let i = this.liveStack.length - 1; i >= 0; i--) {
      const idx = this.liveStack[i]!
      const seg = this.pool[idx]!
      seg.age += dt

      if (seg.age >= SEGMENT_LIFETIME) {
        seg.live = false
        seg.mesh.visible = false
        this.scene.remove(seg.mesh)
        this.liveStack.splice(i, 1)
        this.freeStack.push(idx)
      } else {
        const t = seg.age / SEGMENT_LIFETIME
        // Fade in quickly, fade out slowly
        const fadeIn  = Math.min(1, seg.age * 4)
        const fadeOut = 1 - t
        seg.mat.opacity = fadeIn * fadeOut * 0.55
        // Expand as it disperses
        const s = 0.8 + t * 3.5
        seg.mesh.scale.set(s, s, 1)
      }
    }
  }

  dispose(): void {
    for (const seg of this.pool) {
      if (seg.live) this.scene.remove(seg.mesh)
      seg.mat.dispose()
    }
    this.pool.length = 0
    this.freeStack.length = 0
    this.liveStack.length = 0
  }
}
