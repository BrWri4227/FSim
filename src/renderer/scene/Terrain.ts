import * as THREE from 'three'

const TERRAIN_SIZE = 300000  // 300 km

/**
 * Simple procedural terrain with stylised colour zones.
 * No grid lines — uses colour variation and faint texture noise to read as
 * countryside rather than a debug floor.
 */
export class Terrain {
  private mesh: THREE.Mesh
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 64, 64)
    geo.rotateX(-Math.PI / 2)

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
    this.mesh.position.y = 0
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

  // Base countryside green
  ctx.fillStyle = '#3c5828'
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Subtle farmland patches — irregular rectangles in slightly different greens/tans
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
    [210, 130, 80,  60,  '#c8b46a'],  // tan/sandy patch
    [380, 140, 70,  55,  '#b8a855'],
    [100, 260, 80,  50,  '#c4b060'],
  ]
  for (const [x, y, w, h, color] of patches) {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }

  // Faint noise grain for texture variation
  const imgData = ctx.getImageData(0, 0, SIZE, SIZE)
  const data = imgData.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18
    data[i]!     = Math.max(0, Math.min(255, data[i]!     + n))
    data[i + 1]! = Math.max(0, Math.min(255, data[i + 1]! + n))
    data[i + 2]! = Math.max(0, Math.min(255, data[i + 2]! + n))
  }
  ctx.putImageData(imgData, 0, 0)

  // Faint track / unpaved-road lines
  ctx.strokeStyle = 'rgba(160,140,90,0.30)'
  ctx.lineWidth = 2
  // Diagonal track
  ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(512, 300); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(350, 512); ctx.stroke()

  // Subtle hedge/treeline strips
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
