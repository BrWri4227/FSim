import * as THREE from 'three'

const TERRAIN_SIZE = 300000  // 300 km
const GRID_SEGMENTS = 384
const RUNWAY_ELEV_M = 50
const SHORE_ELEV_M = 8
const WATER_LEVEL_M = 3
const SNOWLINE_M = 1650
const RUNWAY_HALF_LEN_M = 2500
const HOME_BASIN_INNER_M = 6000
const HOME_BASIN_OUTER_M = 20000

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Sharp ridge basis: 1 at the crest, 0 in the troughs. */
function ridge(x: number): number {
  return 1 - Math.abs(Math.sin(x))
}

/**
 * Deterministic procedural surface elevation (m, MSL) at NED north/east.
 * May return values below zero over ocean basins — gameplay helpers clamp to
 * the waterline, the render mesh draws the true sea floor.
 */
export function sampleTerrainHeightM(northM: number, eastM: number): number {
  const N = northM
  const E = eastM

  // ── Continental field: > 0 is land, < 0 is open ocean ──────────────────────
  const cn = N * 0.0000105
  const ce = E * 0.0000123
  const continent =
    Math.sin(cn + 1.7) * Math.cos(ce - 0.6) +
    0.55 * Math.sin(cn * 1.9 + 0.3) * Math.sin(ce * 1.6 + 1.2) +
    0.32

  // ── Wide rolling hills ────────────────────────────────────────────────────
  const n = N * 0.00008
  const e = E * 0.00006
  const hills =
    Math.sin(n) * Math.cos(e) * 220 +
    Math.sin(n * 2.4 + 1.1) * Math.sin(e * 1.9 + 0.7) * 90 +
    Math.cos(n * 0.55 + 2.3) * Math.sin(e * 0.75) * 55

  // ── Regional mountain massifs (ridged, masked to a few belts) ──────────────
  const mn = N * 0.000019
  const me = E * 0.000023
  let massif =
    Math.sin(mn + 0.5) * Math.cos(me - 0.8) +
    0.4 * Math.sin(mn * 2.1 + 1.0) * Math.sin(me * 1.7 - 0.5)
  massif = smoothstep(0.05, 1.15, massif)

  const ranges =
    ridge(N * 0.000145 + 1.3) * ridge(E * 0.000118 - 0.4) * 2100 +
    ridge(N * 0.00032 + 0.2) * ridge(E * 0.00029 + 2.0) * 720 +
    ridge(N * 0.00061 - 1.1) * ridge(E * 0.00055 + 0.7) * 240
  const mountains = massif * ranges

  // ── Mid-scale relief ──────────────────────────────────────────────────────
  const detail =
    Math.sin(N * 0.00052 + 0.4) * Math.sin(E * 0.00061 - 0.2) * 42 +
    Math.cos(N * 0.00113 - 1.0) * Math.sin(E * 0.00097 + 0.6) * 17

  const landElev = SHORE_ELEV_M + Math.max(0, hills) + mountains + detail

  // Ocean floor when the continental field goes negative; blend across the coast.
  const seaMix = smoothstep(0.0, 0.2, continent)
  const oceanFloor = -160 + continent * 80
  let h = oceanFloor + (landElev - oceanFloor) * seaMix

  // ── Home basin: keep the airbase dry, gentle and predictable ───────────────
  const distHome = Math.hypot(N, E)
  if (distHome < HOME_BASIN_OUTER_M) {
    const t = smoothstep(HOME_BASIN_INNER_M, HOME_BASIN_OUTER_M, distHome)
    const homeElev = RUNWAY_ELEV_M + Math.max(0, hills) * 0.3 + detail * 0.4
    h = homeElev + (h - homeElev) * t
  }

  // ── Flatten a generous apron around the runway ────────────────────────────
  // The render mesh has ~780 m grid spacing, so the flat zone has to be wide
  // enough that real vertices fall inside it — otherwise the rendered surface
  // interpolates the surrounding hills and the runway (and parked aircraft)
  // clip through it. Physics ground contact reads this same function, so the
  // analytic value and the rendered mesh must agree over the airfield.
  const PAD_HALF_N = RUNWAY_HALF_LEN_M + 900   // fully level out to here (N)
  const PAD_HALF_E = 1500                      // fully level out to here (E)
  const PAD_FEATHER_N = 2800
  const PAD_FEATHER_E = 1800
  const flatN = 1 - smoothstep(PAD_HALF_N, PAD_HALF_N + PAD_FEATHER_N, Math.abs(N))
  const flatE = 1 - smoothstep(PAD_HALF_E, PAD_HALF_E + PAD_FEATHER_E, Math.abs(E))
  const flat = flatN * flatE
  if (flat > 0) {
    h = RUNWAY_ELEV_M + (h - RUNWAY_ELEV_M) * (1 - flat)
  }

  return h
}

/**
 * Terrain elevation (m MSL) at an NED position, clamped to the waterline so
 * gameplay treats the sea surface as the floor.
 */
export function getTerrainHeightAtNED(positionNED: readonly [number, number, number]): number {
  return Math.max(WATER_LEVEL_M, sampleTerrainHeightM(positionNED[0], positionNED[1]))
}

/**
 * Height above terrain (m) — positive when airborne.
 */
export function getAGLM(positionNED: readonly [number, number, number]): number {
  return getTerrainHeightAtNED(positionNED) - positionNED[2]
}

/**
 * NED start point on the south threshold of the runway (which runs north along
 * the flattened pad). `clearanceM` lifts the CG so the wheels sit on the pad.
 */
export function getRunwaySpawnNED(clearanceM = 0): { positionNED: [number, number, number] } {
  const northM = -(RUNWAY_HALF_LEN_M - 150)
  const eastM = 0
  const padElevM = sampleTerrainHeightM(northM, eastM)
  return { positionNED: [northM, eastM, -(padElevM + clearanceM)] }
}

/**
 * Procedural terrain: ridged heightfield mesh with elevation/slope vertex
 * shading (shoreline sand → meadow → forest → rock → snow) and a sea plane.
 */
export class Terrain {
  private mesh: THREE.Mesh
  private water: THREE.Mesh
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene

    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID_SEGMENTS, GRID_SEGMENTS)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      // three.js world here: +x = east, +z = south (see nedToThree), so the NED
      // north of this vertex is -z. Must match getTerrainHeightAtNED.
      pos.setY(i, sampleTerrainHeightM(-z, x))
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()

    applyTerrainVertexColors(geo)

    const tex = new THREE.CanvasTexture(buildDetailCanvas())
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(240, 240)
    tex.colorSpace = THREE.SRGBColorSpace

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0,
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.receiveShadow = true
    scene.add(this.mesh)

    // ── Sea plane ────────────────────────────────────────────────────────────
    const waterGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE)
    waterGeo.rotateX(-Math.PI / 2)
    // Matte sea — a little sheen for the sun, but not a mirror.
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2a5c72,
      roughness: 0.62,
      metalness: 0.0,
    })
    this.water = new THREE.Mesh(waterGeo, waterMat)
    this.water.position.y = WATER_LEVEL_M
    this.water.receiveShadow = false
    scene.add(this.water)
  }

  /** Keep the finite sea plane centred under the camera. */
  update(cameraPos: THREE.Vector3): void {
    this.water.position.x = cameraPos.x
    this.water.position.z = cameraPos.z
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.scene.remove(this.water)
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.map?.dispose()
    mat.dispose()
    this.mesh.geometry.dispose()
    ;(this.water.material as THREE.Material).dispose()
    this.water.geometry.dispose()
  }
}

// ── Vertex shading ──────────────────────────────────────────────────────────

function applyTerrainVertexColors(geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nrm = geo.attributes.normal as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)

  const sand = new THREE.Color(0xb6a271).convertSRGBToLinear()
  const meadow = new THREE.Color(0x6b8a42).convertSRGBToLinear()
  const grass = new THREE.Color(0x53753a).convertSRGBToLinear()
  const forest = new THREE.Color(0x37522a).convertSRGBToLinear()
  const rock = new THREE.Color(0x6d6559).convertSRGBToLinear()
  const highRock = new THREE.Color(0x8b8378).convertSRGBToLinear()
  const snow = new THREE.Color(0xeef2f6).convertSRGBToLinear()

  const c = new THREE.Color()
  const tmp = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const elev = pos.getY(i)
    const slope = 1 - Math.max(0, Math.min(1, nrm.getY(i)))  // 0 flat → 1 cliff

    // Deterministic per-vertex jitter so bands don't read as hard contours.
    const hash = Math.sin(x * 0.0131 + z * 0.0177) * 0.5 + Math.sin(x * 0.043 - z * 0.037) * 0.5
    const jitter = hash * 90

    // Base by elevation band
    if (elev < SHORE_ELEV_M + 22 + jitter * 0.3) {
      c.copy(sand)
    } else {
      const e = elev + jitter
      c.copy(meadow)
      c.lerp(grass, smoothstep(120, 520, e))
      c.lerp(forest, smoothstep(430, 950, e))
      c.lerp(rock, smoothstep(1000, 1500, e))
      c.lerp(highRock, smoothstep(1550, 2100, e))
    }

    // Steep faces are bare rock regardless of height
    c.lerp(rock, smoothstep(0.35, 0.72, slope) * 0.85)

    // Snow above the snowline, only where it can settle (gentle slopes)
    const snowAmt =
      smoothstep(SNOWLINE_M - 150, SNOWLINE_M + 450, elev + jitter) *
      (1 - smoothstep(0.4, 0.75, slope))
    c.lerp(snow, snowAmt)

    // Subtle brightness noise for texture
    const shade = 1 + hash * 0.06
    tmp.copy(c).multiplyScalar(shade)

    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

// ── Detail texture ─────────────────────────────────────────────────────────

function buildDetailCanvas(): HTMLCanvasElement {
  const SIZE = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#8f8f8f'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const imgData = ctx.getImageData(0, 0, SIZE, SIZE)
  const data = imgData.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 60
    const v = Math.max(150, Math.min(230, 190 + n))
    data[i] = data[i + 1] = data[i + 2] = v
  }
  ctx.putImageData(imgData, 0, 0)

  // Faint speckle to catch the eye up close
  ctx.fillStyle = 'rgba(90,90,90,0.18)'
  for (let i = 0; i < 400; i++) {
    const x = (i * 97 + 13) % SIZE
    const y = (i * 61 + 7) % SIZE
    ctx.fillRect(x, y, 1, 1 + ((i * 7) % 2))
  }

  return canvas
}
