import * as THREE from 'three'

const EXPLOSION_PARTICLE_COUNT = 100
const EXPLOSION_POOL_SIZE = 20

interface ExplosionSlot {
  particles: THREE.Points
  geo: THREE.BufferGeometry
  positions: Float32Array
  velocities: Float32Array
  mat: THREE.PointsMaterial
  age: number
  lifetime: number
  active: boolean
}

const explosionPools = new WeakMap<THREE.Scene, ExplosionSlot[]>()

function ensureExplosionPool(scene: THREE.Scene): ExplosionSlot[] {
  let pool = explosionPools.get(scene)
  if (pool) return pool

  pool = []
  for (let s = 0; s < EXPLOSION_POOL_SIZE; s++) {
    const positions = new Float32Array(EXPLOSION_PARTICLE_COUNT * 3)
    const velocities = new Float32Array(EXPLOSION_PARTICLE_COUNT * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xff7700,
      size: 4,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const pts = new THREE.Points(geo, mat)
    pts.visible = false
    pts.frustumCulled = false
    scene.add(pts)
    pool.push({
      particles: pts,
      geo,
      positions,
      velocities,
      mat,
      age: 0,
      lifetime: 2.2,
      active: false,
    })
  }
  explosionPools.set(scene, pool)
  return pool
}

/** Pre-compile explosion particle shaders at session start. */
export function warmupExplosionVisuals(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): void {
  const pool = ensureExplosionPool(scene)
  for (const slot of pool) {
    slot.particles.visible = true
    slot.mat.opacity = 1
    renderer.compile(slot.particles, camera)
    slot.particles.visible = false
    slot.mat.opacity = 0
  }
}

export class ExplosionManager {
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    ensureExplosionPool(scene)
  }

  spawn(worldPos: THREE.Vector3): void {
    const pool = ensureExplosionPool(this.scene)
    let slot = pool.find(s => !s.active)
    if (!slot) {
      slot = pool[0]!
      for (const s of pool) {
        if (s.age / s.lifetime > slot.age / slot.lifetime) slot = s
      }
    }

    for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
      const vi = i * 3
      slot.positions[vi]     = worldPos.x
      slot.positions[vi + 1] = worldPos.y
      slot.positions[vi + 2] = worldPos.z
      const speed = 20 + Math.random() * 50
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.random() * Math.PI
      slot.velocities[vi]     = speed * Math.sin(phi) * Math.cos(theta)
      slot.velocities[vi + 1] = speed * Math.cos(phi) + 12
      slot.velocities[vi + 2] = speed * Math.sin(phi) * Math.sin(theta)
    }

    slot.geo.attributes['position']!.needsUpdate = true
    slot.mat.opacity = 1
    slot.mat.color.setHex(0xff7700)
    slot.age = 0
    slot.active = true
    slot.particles.position.set(0, 0, 0)
    slot.particles.visible = true

    // No PointLight — adding one per detonation recompiles every lit MeshStandardMaterial.
  }

  update(dt: number): void {
    const pool = explosionPools.get(this.scene)
    if (!pool) return

    for (const exp of pool) {
      if (!exp.active) continue
      exp.age += dt
      const t = exp.age / exp.lifetime
      const pos = exp.positions
      for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
        const vi = i * 3
        pos[vi]!     += (exp.velocities[vi]     ?? 0) * dt
        pos[vi + 1]! += (exp.velocities[vi + 1] ?? 0) * dt - 9.8 * dt * exp.age
        pos[vi + 2]! += (exp.velocities[vi + 2] ?? 0) * dt
      }
      exp.geo.attributes['position']!.needsUpdate = true
      exp.mat.opacity = Math.max(0, 1 - t)
      exp.mat.color.setHSL(0.08 - t * 0.06, 1.0, 0.55 - t * 0.2)

      if (exp.age >= exp.lifetime) {
        exp.active = false
        exp.particles.visible = false
        exp.mat.opacity = 0
      }
    }
  }

  dispose(): void {
    const pool = explosionPools.get(this.scene)
    if (!pool) return
    for (const slot of pool) {
      slot.active = false
      slot.particles.visible = false
    }
  }
}
