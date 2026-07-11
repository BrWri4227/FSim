import * as THREE from 'three'

const TERRAIN_SIZE = 300000  // 300 km
const GRID_SEGMENTS = 64
const RUNWAY_ELEV_M = 50
const RUNWAY_HALF_LEN_M = 2500
const RUNWAY_HALF_WIDTH_M = 45

/** Deterministic procedural height (m MSL) at NED north/east coordinates. */
export function sampleTerrainHeightM(northM: number, eastM: number): number {
  const n = northM * 0.00008
  const e = eastM * 0.00006
  const hills =
    Math.sin(n) * Math.cos(e) * 320 +
    Math.sin(n * 2.4 + 1.1) * Math.sin(e * 1.9 + 0.7) * 110 +
    Math.cos(n * 0.55 + 2.3) * Math.sin(e * 0.75) * 60

  let h = RUNWAY_ELEV_M + Math.max(0, hills)

  // Flatten runway / airbase pad near origin
  const along = northM
  const cross = Math.abs(eastM)
  if (Math.abs(along) < RUNWAY_HALF_LEN_M && cross < RUNWAY_HALF_WIDTH_M * 4) {
    const alongT = Math.abs(along) / RUNWAY_HALF_LEN_M
    const crossT = cross / (RUNWAY_HALF_WIDTH_M * 4)
    const flatBlend = Math.max(alongT, crossT)
    h = RUNWAY_ELEV_M + (h - RUNWAY_ELEV_M) * flatBlend * flatBlend
  }

  return Math.max(0, h)
}

/**
 * Terrain elevation (m MSL) at an NED position.
 */
export function getTerrainHeightAtNED(positionNED: readonly [number, number, number]): number {
  return sampleTerrainHeightM(positionNED[0], positionNED[1])
}

/**
 * Height above terrain (m) — positive when airborne.
 */
export function getAGLM(positionNED: readonly [number, number, number]): number {
  return getTerrainHeightAtNED(positionNED) - positionNED[2]
}

/**
 * Simple procedural terrain with stylised colour zones and a heightfield mesh.
 */
export class Terrain {
  private mesh: THREE.Mesh
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID_SEGMENTS, GRID_SEGMENTS)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      // Plane local x → world east, z → world north (after rotateX)
      const elev = sampleTerrainHeightM(z, x)
      pos.setY(i, elev)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()

    const tex = new THREE.CanvasTexture(buildTerrainCanvas())
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(120, 120)

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.95,
      metalness: 0.0,
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.receiveShadow = true
    scene.add(this.mesh)
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.map?.dispose()
    mat.dispose()
    this.mesh.geometry.dispose()
  }
}

// ── Canvas texture builder ──────────────────────────────────────────────────

function buildTerrainCanvas(): HTMLCanvasElement {
  const SIZE = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#3c5828'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const patches: Array<[number, number, number, number, string]> = [
    [30,  40,  120, 80,  '#4a6530'],
    [200, 20,  100, 110, '#55703a'],
    [320, 60,  90,  70,  '#3f5b24'],
    [80,  180, 140, 90,  '#506a2f'],
    [240, 200, 110, 80,  '#4d6830'],
    [30,  300, 130, 100, '#5a7038'],
    [360, 260, 110, 120, '#496227'],
    [160, 360, 150, 100, '#536c2e'],
    [10,  420, 100, 70,  '#4b642a'],
    [300, 380, 130, 90,  '#5a7035'],
    [420, 420, 80,  80,  '#415c20'],
    [210, 130, 80,  60,  '#c8b46a'],
    [380, 140, 70,  55,  '#b8a855'],
    [100, 260, 80,  50,  '#c4b060'],
  ]
  for (const [x, y, w, h, color] of patches) {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }

  const imgData = ctx.getImageData(0, 0, SIZE, SIZE)
  const data = imgData.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18
    data[i]!     = Math.max(0, Math.min(255, data[i]!     + n))
    data[i + 1]! = Math.max(0, Math.min(255, data[i + 1]! + n))
    data[i + 2]! = Math.max(0, Math.min(255, data[i + 2]! + n))
  }
  ctx.putImageData(imgData, 0, 0)

  ctx.strokeStyle = 'rgba(160,140,90,0.30)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(512, 300); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(350, 512); ctx.stroke()

  ctx.fillStyle = 'rgba(28,48,18,0.50)'
  for (let i = 0; i < 6; i++) {
    const x = (i * 89 + 20) % (SIZE - 10)
    const y = (i * 73 + 30) % (SIZE - 6)
    const w = 4 + Math.floor((i * 37) % 22)
    const h = 80 + Math.floor((i * 53) % 60)
    ctx.fillRect(x, y, w, h)
  }

  return canvas
}
