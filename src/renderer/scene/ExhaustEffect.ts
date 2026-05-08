import * as THREE from 'three'

export class ExhaustEffect {
  private dryFlame: THREE.Points
  private abCone: THREE.Mesh
  private particles: Float32Array
  private geo: THREE.BufferGeometry

  constructor(scene: THREE.Scene) {
    const count = 60
    this.particles = new Float32Array(count * 3)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.particles, 3))

    this.dryFlame = new THREE.Points(this.geo, new THREE.PointsMaterial({
      color: 0xff8800, size: 0.6, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    }))
    scene.add(this.dryFlame)

    // Afterburner cone
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xaaddff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
    this.abCone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 5, 8, 1, true), coneMat)
    this.abCone.visible = false
    scene.add(this.abCone)
  }

  update(nozzleWorldPos: THREE.Vector3, nozzleWorldDir: THREE.Vector3, throttle: number, dt: number): void {
    const isAB = throttle >= 0.75
    const baseLen = isAB ? 5 : 1.5

    for (let i = 0; i < this.particles.length / 3; i++) {
      const t = (i / (this.particles.length / 3)) * baseLen
      const spread = isAB ? 0.4 : 0.2
      this.particles[i * 3]     = nozzleWorldPos.x - nozzleWorldDir.x * t + (Math.random() - 0.5) * spread
      this.particles[i * 3 + 1] = nozzleWorldPos.y - nozzleWorldDir.y * t + (Math.random() - 0.5) * spread
      this.particles[i * 3 + 2] = nozzleWorldPos.z - nozzleWorldDir.z * t + (Math.random() - 0.5) * spread
    }
    this.geo.attributes['position']!.needsUpdate = true

    const mat = this.dryFlame.material as THREE.PointsMaterial
    mat.color.set(isAB ? 0x88ccff : 0xff8800)
    mat.size = isAB ? 1.0 : 0.5

    // Afterburner cone
    this.abCone.visible = isAB
    if (isAB) {
      this.abCone.position.copy(nozzleWorldPos).addScaledVector(nozzleWorldDir.clone().negate(), 2.5)
      this.abCone.lookAt(nozzleWorldPos)
      const scale = 0.8 + throttle * 0.5
      this.abCone.scale.set(scale, scale, scale)
    }
  }

  dispose(): void {
    this.geo.dispose()
  }
}
