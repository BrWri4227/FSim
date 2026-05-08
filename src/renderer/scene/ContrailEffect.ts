import * as THREE from 'three'

const CONTRAIL_ALTITUDE_M = 8000
const MAX_SEGMENTS = 200
const SEGMENT_LIFETIME = 8.0

interface ContrailSegment {
  mesh: THREE.Mesh
  age: number
}

export class ContrailEffect {
  private segments: ContrailSegment[] = []
  private scene: THREE.Scene
  private timeSinceLast = 0
  private readonly spawnInterval = 0.05  // seconds between spawns

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  update(worldPos: THREE.Vector3, altitudeM: number, isActive: boolean, dt: number): void {
    this.timeSinceLast += dt

    // Spawn new segments at high altitude
    if (isActive && altitudeM > CONTRAIL_ALTITUDE_M && this.timeSinceLast >= this.spawnInterval) {
      this.timeSinceLast = 0
      if (this.segments.length < MAX_SEGMENTS) {
        const geo = new THREE.PlaneGeometry(0.6, 0.6)
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.6,
          depthWrite: false, side: THREE.DoubleSide
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.copy(worldPos)
        mesh.lookAt(worldPos.x, worldPos.y + 1, worldPos.z)
        this.scene.add(mesh)
        this.segments.push({ mesh, age: 0 })
      }
    }

    // Age and fade segments
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i]!
      seg.age += dt
      const alpha = Math.max(0, 1 - seg.age / SEGMENT_LIFETIME) * 0.5
      ;(seg.mesh.material as THREE.MeshBasicMaterial).opacity = alpha
      const s = 1 + seg.age * 0.8
      seg.mesh.scale.set(s, s, 1)

      if (seg.age >= SEGMENT_LIFETIME) {
        this.scene.remove(seg.mesh)
        seg.mesh.geometry.dispose()
        ;(seg.mesh.material as THREE.MeshBasicMaterial).dispose()
        this.segments.splice(i, 1)
      }
    }
  }

  dispose(): void {
    for (const seg of this.segments) {
      this.scene.remove(seg.mesh)
      seg.mesh.geometry.dispose()
    }
    this.segments = []
  }
}
