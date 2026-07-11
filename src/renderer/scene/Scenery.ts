import * as THREE from 'three'
import { sampleTerrainHeightM } from './Terrain'

/**
 * Basic airbase scenery: runway strip, taxiway, and a few structures near origin.
 */
export class Scenery {
  private group: THREE.Group
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'scenery'
    this.buildRunway()
    this.buildStructures()
    scene.add(this.group)
  }

  private buildRunway(): void {
    const elev = sampleTerrainHeightM(0, 0)
    const runwayMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85, metalness: 0.05 })
    const markingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })

    const runway = new THREE.Mesh(new THREE.BoxGeometry(5000, 0.3, 60), runwayMat)
    runway.position.set(0, elev + 0.15, 0)
    runway.receiveShadow = true
    this.group.add(runway)

    const centerline = new THREE.Mesh(new THREE.BoxGeometry(4800, 0.05, 0.8), markingMat)
    centerline.position.set(0, elev + 0.32, 0)
    this.group.add(centerline)

    const threshold = new THREE.Mesh(new THREE.BoxGeometry(60, 0.05, 8), markingMat)
    threshold.position.set(-2400, elev + 0.32, 0)
    this.group.add(threshold.clone())
    threshold.position.set(2400, elev + 0.32, 0)
    this.group.add(threshold)

    const taxi = new THREE.Mesh(new THREE.BoxGeometry(800, 0.25, 20), runwayMat)
    taxi.position.set(600, elev + 0.12, 120)
    this.group.add(taxi)
  }

  private buildStructures(): void {
    const elev = sampleTerrainHeightM(800, -400)
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.7, metalness: 0.2 })
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.6, metalness: 0.15 })

    const hangar = new THREE.Mesh(new THREE.BoxGeometry(80, 18, 50), hangarMat)
    hangar.position.set(800, elev + 9, -400)
    hangar.castShadow = true
    hangar.receiveShadow = true
    this.group.add(hangar)

    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 35, 8), towerMat)
    tower.position.set(400, elev + 17.5, -250)
    tower.castShadow = true
    this.group.add(tower)

    const radarDish = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1.2, 16), towerMat)
    radarDish.rotation.z = Math.PI / 2
    radarDish.position.set(400, elev + 36, -250)
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
  }
}
