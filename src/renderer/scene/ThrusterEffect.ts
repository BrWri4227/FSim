import * as THREE from 'three'

function makeGlowTexture(innerRgba: string, outerRgba: string): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0,   innerRgba)
  g.addColorStop(0.35, outerRgba)
  g.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/**
 * Glow-sprite + point-light thruster effect.
 * Attach to any Object3D (e.g. nozzle or a rear-mount group on a missile).
 * Call update(intensity) each frame with a 0-1 throttle/burn value.
 */
export class ThrusterEffect {
  private core: THREE.Sprite
  private glow: THREE.Sprite
  readonly light: THREE.PointLight
  private baseScale: number
  private time = 0

  constructor(parent: THREE.Object3D, baseScale = 1.0) {
    this.baseScale = baseScale

    const coreTex = makeGlowTexture('rgba(255,255,255,1)', 'rgba(160,210,255,0.7)')
    this.core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }))
    this.core.scale.setScalar(baseScale * 2)
    parent.add(this.core)

    const glowTex = makeGlowTexture('rgba(255,160,40,0.9)', 'rgba(255,80,10,0.4)')
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }))
    this.glow.scale.setScalar(baseScale * 5)
    parent.add(this.glow)

    this.light = new THREE.PointLight(0x88aaff, 0, baseScale * 40)
    parent.add(this.light)
  }

  update(intensity: number, dt = 0.016): void {
    this.time += dt
    const i = Math.max(0, Math.min(1, intensity))
    // Slight flicker — ±8 % random variation
    const flicker = 1 + (Math.sin(this.time * 47) * 0.05 + Math.sin(this.time * 83) * 0.03)
    const eff = i * flicker

    this.core.visible = i > 0.02
    this.glow.visible = i > 0.02
    this.core.scale.setScalar(this.baseScale * (1 + eff * 1.5))
    this.glow.scale.setScalar(this.baseScale * (2.5 + eff * 3.5))
    this.light.intensity = eff * 4
  }

  dispose(): void {
    ;(this.core.material as THREE.SpriteMaterial).map?.dispose()
    ;(this.core.material as THREE.SpriteMaterial).dispose()
    ;(this.glow.material as THREE.SpriteMaterial).map?.dispose()
    ;(this.glow.material as THREE.SpriteMaterial).dispose()
  }
}

/**
 * Rolling-buffer rocket trail.  Each frame (while burning) call addPoint()
 * with the missile's world position.  Points fade from tip to tail.
 */
export class RocketTrail {
  private scene: THREE.Scene
  private pts: THREE.Points
  private geo: THREE.BufferGeometry
  private buf: Float32Array       // ring buffer: world positions
  private ages: Float32Array      // age of each slot in seconds
  private head = 0
  private readonly maxPts: number
  private readonly lifetime: number

  constructor(scene: THREE.Scene, maxPts = 48, lifetime = 0.8) {
    this.scene = scene
    this.maxPts = maxPts
    this.lifetime = lifetime
    this.buf = new Float32Array(maxPts * 3)
    this.ages = new Float32Array(maxPts).fill(lifetime) // start all expired

    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.buf, 3))
    this.pts = new THREE.Points(this.geo, new THREE.PointsMaterial({
      size: 6,
      vertexColors: false,
      color: 0xffaa44,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }))
    this.pts.frustumCulled = false
    scene.add(this.pts)
  }

  addPoint(worldPos: THREE.Vector3): void {
    const i = (this.head % this.maxPts)
    this.buf[i * 3]     = worldPos.x
    this.buf[i * 3 + 1] = worldPos.y
    this.buf[i * 3 + 2] = worldPos.z
    this.ages[i] = 0
    this.head++
    this.geo.attributes['position']!.needsUpdate = true
  }

  update(dt: number): void {
    for (let i = 0; i < this.maxPts; i++) {
      this.ages[i] = Math.min(this.ages[i]! + dt, this.lifetime)
    }
    // Compute mean opacity from active (non-expired) points
    let active = 0
    for (let i = 0; i < this.maxPts; i++) if (this.ages[i]! < this.lifetime) active++
    this.pts.visible = active > 0
  }

  dispose(): void {
    this.scene.remove(this.pts)
    this.geo.dispose()
    ;(this.pts.material as THREE.PointsMaterial).dispose()
  }
}
