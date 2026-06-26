import * as THREE from 'three'

interface Explosion {
  particles: THREE.Points
  geo: THREE.BufferGeometry
  velocities: Float32Array
  age: number
  lifetime: number
}

interface FlashLight {
  light: THREE.PointLight
  age: number
  lifetime: number
}

export class ExplosionManager {
  private scene: THREE.Scene
  private explosions: Explosion[] = []
  private flashLights: FlashLight[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  spawn(worldPos: THREE.Vector3): void {
    const count = 100
    const positions  = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = worldPos.x
      positions[i * 3 + 1] = worldPos.y
      positions[i * 3 + 2] = worldPos.z
      const speed = 20 + Math.random() * 50
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.random() * Math.PI
      velocities[i * 3]     = speed * Math.sin(phi) * Math.cos(theta)
      velocities[i * 3 + 1] = speed * Math.cos(phi) + 12
      velocities[i * 3 + 2] = speed * Math.sin(phi) * Math.sin(theta)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xff7700, size: 4, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.scene.add(pts)
    this.explosions.push({ particles: pts, geo, velocities, age: 0, lifetime: 2.2 })

    // Brief bright flash that illuminates nearby aircraft/terrain
    const flash = new THREE.PointLight(0xff8833, 30, 800)
    flash.position.copy(worldPos)
    this.scene.add(flash)
    this.flashLights.push({ light: flash, age: 0, lifetime: 0.35 })
  }

  update(dt: number): void {
    // Particle systems
    for (let e = this.explosions.length - 1; e >= 0; e--) {
      const exp = this.explosions[e]!
      exp.age += dt
      const t = exp.age / exp.lifetime
      const pos = exp.geo.attributes['position']!.array as Float32Array
      for (let i = 0; i < pos.length / 3; i++) {
        const vi = i * 3
        pos[vi]!     += (exp.velocities[vi]     ?? 0) * dt
        pos[vi + 1]! += (exp.velocities[vi + 1] ?? 0) * dt - 9.8 * dt * exp.age
        pos[vi + 2]! += (exp.velocities[vi + 2] ?? 0) * dt
      }
      exp.geo.attributes['position']!.needsUpdate = true
      ;(exp.particles.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - t)
      // Colour shifts from bright orange → dark red as it fades
      ;(exp.particles.material as THREE.PointsMaterial).color.setHSL(0.08 - t * 0.06, 1.0, 0.55 - t * 0.2)

      if (exp.age >= exp.lifetime) {
        this.scene.remove(exp.particles)
        exp.geo.dispose()
        this.explosions.splice(e, 1)
      }
    }

    // Flash lights — fade intensity over lifetime
    for (let i = this.flashLights.length - 1; i >= 0; i--) {
      const fl = this.flashLights[i]!
      fl.age += dt
      if (fl.age >= fl.lifetime) {
        this.scene.remove(fl.light)
        this.flashLights.splice(i, 1)
      } else {
        const t = fl.age / fl.lifetime
        fl.light.intensity = 30 * (1 - t * t)
      }
    }
  }

  dispose(): void {
    for (const e of this.explosions) { this.scene.remove(e.particles); e.geo.dispose() }
    for (const f of this.flashLights) this.scene.remove(f.light)
  }
}
