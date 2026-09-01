import * as THREE from 'three'
import { sampleTerrainHeightM } from './Terrain'

/**
 * Basic airbase scenery near the origin: a north–south runway (aligned with the
 * terrain-flattened strip and the runway-start spawn), edge / threshold lights,
 * a PAPI box on the south (landing) approach, a taxiway and a few structures.
 *
 * three.js axes here: +x = East, +y = up, +z = South (so North is −z).
 * The runway therefore runs along z, from z=+2500 (south threshold, RWY 36) to
 * z=−2500 (north threshold). Takeoff is toward −z / North.
 */

const RWY_HALF_LEN = 2500
const RWY_HALF_WIDTH = 30

export class Scenery {
  private group: THREE.Group
  private scene: THREE.Scene
  /** Emissive materials for night visibility — reused across many light meshes. */
  private lightMats: THREE.MeshBasicMaterial[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'scenery'
    this.buildRunway()
    this.buildLighting()
    this.buildStructures()
    scene.add(this.group)
  }

  private buildRunway(): void {
    // Physics ground contact = the analytic terrain height (flat over the pad),
    // so aircraft wheels roll at exactly `elev`. The runway top must therefore
    // sit ~flush with `elev`, not raised; polygonOffset keeps it (and the paint)
    // drawing over the coplanar terrain instead of z-fighting.
    const elev = sampleTerrainHeightM(0, 0)
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x33343a, roughness: 0.9, metalness: 0.04,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    })
    const markingMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8, roughness: 0.9,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    })

    // Thin slab: top ~2 cm proud of the pad, body buried so no side wall shows.
    const slab = (w: number, len: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, 0.5, len)
    const runway = new THREE.Mesh(slab(RWY_HALF_WIDTH * 2, RWY_HALF_LEN * 2), runwayMat)
    runway.position.set(0, elev - 0.23, 0)
    runway.receiveShadow = true
    this.group.add(runway)

    const centerline = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, RWY_HALF_LEN * 2 - 200), markingMat)
    centerline.position.set(0, elev + 0.03, 0)
    this.group.add(centerline)

    // Piano-key thresholds at each end
    for (const z of [RWY_HALF_LEN - 60, -(RWY_HALF_LEN - 60)]) {
      for (let i = -2; i <= 2; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.04, 26), markingMat)
        bar.position.set(i * 9, elev + 0.03, z)
        this.group.add(bar)
      }
    }

    // Taxiway to the east apron
    const taxi = new THREE.Mesh(slab(360, 22), runwayMat)
    taxi.position.set(200, elev - 0.25, -600)
    this.group.add(taxi)
  }

  private mkLightMat(color: number): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: false })
    this.lightMats.push(m)
    return m
  }

  private buildLighting(): void {
    const elev = sampleTerrainHeightM(0, 0)
    const edgeGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2)
    const white = this.mkLightMat(0xfff2d0)
    const red = this.mkLightMat(0xff3020)
    const green = this.mkLightMat(0x30ff50)
    const lightY = elev + 0.3

    // Runway edge lights — both sides, every 120 m
    for (let z = -RWY_HALF_LEN; z <= RWY_HALF_LEN; z += 120) {
      for (const x of [-RWY_HALF_WIDTH - 2, RWY_HALF_WIDTH + 2]) {
        const l = new THREE.Mesh(edgeGeo, white)
        l.position.set(x, lightY, z)
        this.group.add(l)
      }
    }

    // Threshold lights: green at the departure end (north), red at the approach end (south)
    for (let x = -RWY_HALF_WIDTH; x <= RWY_HALF_WIDTH; x += 10) {
      const g = new THREE.Mesh(edgeGeo, green)
      g.position.set(x, lightY, -RWY_HALF_LEN)
      this.group.add(g)
      const r = new THREE.Mesh(edgeGeo, red)
      r.position.set(x, lightY, RWY_HALF_LEN)
      this.group.add(r)
    }

    // PAPI — four lights left of the south approach end. Static 2-red / 2-white
    // ("slightly high"); a live glideslope readout is a follow-up.
    const papiGeo = new THREE.BoxGeometry(3, 1.4, 3)
    for (let i = 0; i < 4; i++) {
      const mat = i < 2 ? white : red
      const p = new THREE.Mesh(papiGeo, mat)
      p.position.set(-RWY_HALF_WIDTH - 18, elev + 0.5, RWY_HALF_LEN - 60 - i * 9)
      this.group.add(p)
    }

    // Approach lights: a centreline lead-in extending south from the approach end
    for (let i = 1; i <= 12; i++) {
      const a = new THREE.Mesh(edgeGeo, white)
      a.position.set(0, lightY, RWY_HALF_LEN + i * 60)
      this.group.add(a)
    }
  }

  private buildStructures(): void {
    const elev = sampleTerrainHeightM(400, 300)
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.7, metalness: 0.2 })
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.6, metalness: 0.15 })

    const hangar = new THREE.Mesh(new THREE.BoxGeometry(50, 18, 80), hangarMat)
    hangar.position.set(340, elev + 9, -700)
    hangar.castShadow = true
    hangar.receiveShadow = true
    this.group.add(hangar)

    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 35, 8), towerMat)
    tower.position.set(260, elev + 17.5, -350)
    tower.castShadow = true
    this.group.add(tower)

    const radarDish = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1.2, 16), towerMat)
    radarDish.rotation.z = Math.PI / 2
    radarDish.position.set(260, elev + 36, -350)
    this.group.add(radarDish)
  }

  dispose(): void {
    this.scene.remove(this.group)
    this.group.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material
      if (mat && !Array.isArray(mat)) mat.dispose()
    })
    for (const m of this.lightMats) m.dispose()
  }
}
