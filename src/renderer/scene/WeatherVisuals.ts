import * as THREE from 'three'
import { getWeather, type CloudCover } from '../physics/WeatherState'

const CLOUD_LAYERS: Record<CloudCover, number> = {
  CLEAR: 0,
  SCATTERED: 12,
  BROKEN: 28,
  OVERCAST: 48,
}

/**
 * Cloud billboards and precipitation particles driven by WeatherState.
 */
export class WeatherVisuals {
  private group: THREE.Group
  private scene: THREE.Scene
  private clouds: THREE.Mesh[] = []
  private precip: THREE.Points | null = null
  private precipVel: Float32Array | null = null
  private cloudGeo: THREE.PlaneGeometry
  private cloudMat: THREE.MeshBasicMaterial

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'weather_visuals'
    this.cloudGeo = new THREE.PlaneGeometry(800, 400)
    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.rebuildClouds()
    this.rebuildPrecip()
    scene.add(this.group)
  }

  private rebuildClouds(): void {
    for (const c of this.clouds) {
      this.group.remove(c)
      c.geometry.dispose()
    }
    this.clouds = []

    const cover = getWeather().cloudCover
    const count = CLOUD_LAYERS[cover]
    const rng = mulberry32(42)

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.cloudGeo, this.cloudMat.clone())
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = cover === 'OVERCAST' ? 0.65 : 0.45 + rng() * 0.2
      mesh.position.set(
        (rng() - 0.5) * 12000,
        2500 + rng() * 3500,
        (rng() - 0.5) * 12000,
      )
      mesh.rotation.y = rng() * Math.PI
      mesh.scale.setScalar(0.8 + rng() * 1.4)
      this.group.add(mesh)
      this.clouds.push(mesh)
    }
  }

  private rebuildPrecip(): void {
    if (this.precip) {
      this.group.remove(this.precip)
      this.precip.geometry.dispose()
      ;(this.precip.material as THREE.Material).dispose()
      this.precip = null
      this.precipVel = null
    }

    const turb = getWeather().turbulence
    const isPrecip = turb === 'MODERATE' || turb === 'SEVERE'
    if (!isPrecip) return

    const count = turb === 'SEVERE' ? 4000 : 1800
    const positions = new Float32Array(count * 3)
    const rng = mulberry32(99)
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (rng() - 0.5) * 400
      positions[i * 3 + 1] = rng() * 120 + 20
      positions[i * 3 + 2] = (rng() - 0.5) * 400
    }
    this.precipVel = new Float32Array(count)
    for (let i = 0; i < count; i++) this.precipVel[i] = 25 + rng() * 35

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xccccff,
      size: turb === 'SEVERE' ? 1.2 : 0.8,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
    this.precip = new THREE.Points(geo, mat)
    this.group.add(this.precip)
  }

  update(cameraPos: THREE.Vector3, dt: number): void {
    // Parallax-scroll clouds with the camera
    for (const cloud of this.clouds) {
      cloud.position.x += (cameraPos.x - cloud.position.x) * 0.002
      cloud.position.z += (cameraPos.z - cloud.position.z) * 0.002
    }

    if (!this.precip || !this.precipVel) return
    const pos = this.precip.geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    this.precip.position.copy(cameraPos)

    const vel = this.precipVel
    for (let i = 0; i < vel.length; i++) {
      const dropSpeed = vel[i]!
      const yIdx = i * 3 + 1
      arr[yIdx] = (arr[yIdx] ?? 0) - dropSpeed * dt
      if ((arr[yIdx] ?? 0) < -20) arr[yIdx] = 120 + Math.random() * 40
    }
    pos.needsUpdate = true
  }

  /** Rebuild when weather config changes mid-session. */
  refresh(): void {
    this.rebuildClouds()
    this.rebuildPrecip()
  }

  dispose(): void {
    this.scene.remove(this.group)
    this.cloudGeo.dispose()
    this.cloudMat.dispose()
    for (const c of this.clouds) (c.material as THREE.Material).dispose()
    if (this.precip) {
      this.precip.geometry.dispose()
      ;(this.precip.material as THREE.Material).dispose()
    }
  }
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
