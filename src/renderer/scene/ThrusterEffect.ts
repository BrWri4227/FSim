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

// Shared GPU assets for missile thrusters (baseScale ≤ 1.5) — avoids per-launch
// texture/material creation and the ~60 ms shader-compile hitch on first render.
const MISSILE_THRUSTER_SCALE = 1.4
let missileCoreTex: THREE.Texture | undefined
let missileGlowTex: THREE.Texture | undefined
let missileCoreMat: THREE.SpriteMaterial | undefined
let missileGlowMat: THREE.SpriteMaterial | undefined
let missilePlumeMat: THREE.MeshBasicMaterial | undefined
let missileDiamondMat: THREE.MeshBasicMaterial | undefined
let missilePlumeGeo: THREE.ConeGeometry | undefined
let missileDiamondGeo: THREE.OctahedronGeometry | undefined

function ensureMissileThrusterAssets(): void {
  if (missileCoreTex) return
  missileCoreTex = makeGlowTexture('rgba(255,255,255,1)', 'rgba(160,210,255,0.7)')
  missileGlowTex = makeGlowTexture('rgba(255,160,40,0.9)', 'rgba(255,80,10,0.4)')
  missileCoreMat = new THREE.SpriteMaterial({
    map: missileCoreTex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  missileGlowMat = new THREE.SpriteMaterial({
    map: missileGlowTex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  missilePlumeMat = new THREE.MeshBasicMaterial({
    color: 0x77aaff,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  missileDiamondMat = new THREE.MeshBasicMaterial({
    color: 0x9dd7ff,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  missilePlumeGeo = new THREE.ConeGeometry(
    MISSILE_THRUSTER_SCALE * 0.42,
    MISSILE_THRUSTER_SCALE * 4.2,
    16, 1, true,
  )
  missileDiamondGeo = new THREE.OctahedronGeometry(MISSILE_THRUSTER_SCALE * 0.22, 0)
}

let sharedTrailMat: THREE.PointsMaterial | undefined

function getSharedTrailMat(): THREE.PointsMaterial {
  if (!sharedTrailMat) {
    sharedTrailMat = new THREE.PointsMaterial({
      size: 6,
      vertexColors: false,
      color: 0xffaa44,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
  }
  return sharedTrailMat
}

/**
 * Glow-sprite + point-light thruster effect.
 * Attach to any Object3D (e.g. nozzle or a rear-mount group on a missile).
 * Call update(intensity) each frame with a 0-1 throttle/burn value.
 */
export class ThrusterEffect {
  private core: THREE.Sprite
  private glow: THREE.Sprite
  private plume: THREE.Mesh
  private abDiamond: THREE.Mesh
  private light: THREE.PointLight | null = null
  private baseScale: number
  private time = 0
  private readonly usesSharedAssets: boolean

  constructor(parent: THREE.Object3D, baseScale = 1.0, phaseOffset = 0) {
    this.baseScale = baseScale
    this.time = phaseOffset
    this.usesSharedAssets = baseScale <= 1.5

    if (this.usesSharedAssets) {
      ensureMissileThrusterAssets()
      this.core = new THREE.Sprite(missileCoreMat!)
      this.core.scale.setScalar(baseScale * 2)
      parent.add(this.core)

      this.glow = new THREE.Sprite(missileGlowMat!)
      this.glow.scale.setScalar(baseScale * 5)
      parent.add(this.glow)

      this.plume = new THREE.Mesh(missilePlumeGeo!, missilePlumeMat!)
      this.plume.rotation.z = Math.PI / 2
      this.plume.position.x = -baseScale * 2.1
      parent.add(this.plume)

      this.abDiamond = new THREE.Mesh(missileDiamondGeo!, missileDiamondMat!)
      this.abDiamond.position.x = -baseScale * 3.3
      this.abDiamond.visible = false
      parent.add(this.abDiamond)
    } else {
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

      const plumeMat = new THREE.MeshBasicMaterial({
        color: 0x77aaff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      this.plume = new THREE.Mesh(new THREE.ConeGeometry(baseScale * 0.42, baseScale * 4.2, 16, 1, true), plumeMat)
      this.plume.rotation.z = Math.PI / 2
      this.plume.position.x = -baseScale * 2.1
      parent.add(this.plume)

      const diamondMat = new THREE.MeshBasicMaterial({
        color: 0x9dd7ff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      this.abDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(baseScale * 0.22, 0), diamondMat)
      this.abDiamond.position.x = -baseScale * 3.3
      this.abDiamond.visible = false
      parent.add(this.abDiamond)
    }

    // Missiles use sprite/plume glow only — a PointLight per missile forces Three.js to
    // recompile every MeshStandardMaterial shader when the scene light count changes.
    if (!this.usesSharedAssets) {
      this.light = new THREE.PointLight(0x88aaff, 0, baseScale * 40)
      parent.add(this.light)
    }
  }

  update(intensity: number, isAfterburner = false, dt = 0.016): void {
    this.time += dt
    const i = Math.max(0, Math.min(1, intensity))
    // Slight flicker — ±8 % random variation
    const flicker = 1 + (Math.sin(this.time * 47) * 0.05 + Math.sin(this.time * 83) * 0.03)
    const eff = i * flicker

    const active = i > 0.02
    this.core.visible = active
    this.glow.visible = active
    this.plume.visible = active
    this.abDiamond.visible = active && isAfterburner

    this.core.scale.setScalar(this.baseScale * (0.95 + eff * 1.35))
    this.glow.scale.setScalar(this.baseScale * (2.2 + eff * 3.1))

    const plumeMat = this.plume.material as THREE.MeshBasicMaterial
    const plumeLen = this.baseScale * (isAfterburner ? (4.8 + eff * 3.1) : (2.7 + eff * 1.6))
    const plumeRadius = this.baseScale * (isAfterburner ? (0.32 + eff * 0.18) : (0.20 + eff * 0.1))
    this.plume.scale.set(
      plumeRadius / (this.baseScale * 0.42),
      plumeLen / (this.baseScale * 4.2),
      plumeRadius / (this.baseScale * 0.42),
    )
    this.plume.position.x = -plumeLen * 0.5
    plumeMat.color.set(isAfterburner ? 0x83cbff : 0xffa25a)
    plumeMat.opacity = isAfterburner ? 0.5 : 0.28

    const diamondMat = this.abDiamond.material as THREE.MeshBasicMaterial
    if (isAfterburner) {
      const pulse = 0.8 + 0.2 * Math.sin(this.time * 28)
      const dScale = this.baseScale * (0.7 + eff * 0.8) * pulse
      this.abDiamond.scale.setScalar(dScale)
      this.abDiamond.position.x = -plumeLen * 0.72
      diamondMat.opacity = 0.45 + 0.25 * pulse
    }

    if (this.light) {
      this.light.color.set(isAfterburner ? 0x9bcfff : 0xffa060)
      this.light.intensity = eff * (isAfterburner ? 8 : 3.8)
      this.light.distance = this.baseScale * (isAfterburner ? 68 : 40)
    }
  }

  dispose(): void {
    if (this.usesSharedAssets) return
    ;(this.core.material as THREE.SpriteMaterial).map?.dispose()
    ;(this.core.material as THREE.SpriteMaterial).dispose()
    ;(this.glow.material as THREE.SpriteMaterial).map?.dispose()
    ;(this.glow.material as THREE.SpriteMaterial).dispose()
    ;(this.plume.material as THREE.MeshBasicMaterial).dispose()
    this.plume.geometry.dispose()
    ;(this.abDiamond.material as THREE.MeshBasicMaterial).dispose()
    this.abDiamond.geometry.dispose()
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
  private readonly usesSharedMat: boolean

  constructor(scene: THREE.Scene, maxPts = 48, lifetime = 0.8) {
    this.scene = scene
    this.maxPts = maxPts
    this.lifetime = lifetime
    this.buf = new Float32Array(maxPts * 3)
    this.ages = new Float32Array(maxPts).fill(lifetime) // start all expired

    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.buf, 3))
    this.usesSharedMat = true
    this.pts = new THREE.Points(this.geo, getSharedTrailMat())
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

  getPointsObject(): THREE.Points {
    return this.pts
  }

  dispose(): void {
    this.scene.remove(this.pts)
    this.geo.dispose()
    if (!this.usesSharedMat) {
      ;(this.pts.material as THREE.PointsMaterial).dispose()
    }
  }
}
