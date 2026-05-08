import * as THREE from 'three'
import type { ChaffCloud } from '../avionics/CMDS'
import { nedToThree } from '../utils/MathUtils'

const POOL_SIZE = 8
const POINTS_PER_CLOUD = 80
const SPREAD_M = 4

function makeCloudGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(POINTS_PER_CLOUD * 3)
  for (let i = 0; i < POINTS_PER_CLOUD; i++) {
    const r = Math.random() * SPREAD_M
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geom
}

export class ChaffEffect {
  private clouds: THREE.Points[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.PointsMaterial({
        color: 0xccddee,
        size: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      })
      const pts = new THREE.Points(makeCloudGeometry(), mat)
      pts.visible = false
      scene.add(pts)
      this.clouds.push(pts)
    }
  }

  update(clouds: readonly ChaffCloud[]): void {
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = clouds[i]
      const pts = this.clouds[i]!
      if (!cloud) { pts.visible = false; continue }
      const opacity = Math.min(1, cloud.rcsM2 / 25)
      pts.visible = opacity > 0.01
      pts.position.copy(nedToThree(cloud.positionNED))
      ;(pts.material as THREE.PointsMaterial).opacity = opacity
    }
  }

  dispose(): void {
    for (const c of this.clouds) this.scene.remove(c)
  }
}
