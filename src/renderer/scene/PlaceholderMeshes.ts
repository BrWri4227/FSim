import * as THREE from 'three'

// Placeholder aircraft geometry: fuselage + wings + tail
// Built from simple BoxGeometry primitives. Replace with GLTF later.

export function createPlaceholderAircraftMesh(aircraftId: string, nation: 'USA' | 'RUS'): THREE.Group {
  const group = new THREE.Group()
  const color = nation === 'USA' ? 0x6688aa : 0x885544

  const mat = new THREE.MeshPhongMaterial({ color })

  // Fuselage
  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(8, 1.0, 1.2), mat)
  group.add(fuselage)

  // Wings
  const wingMat = new THREE.MeshPhongMaterial({ color: color - 0x111111 })
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 6), wingMat)
  wing.position.set(1.5, -0.2, 0)
  group.add(wing)

  // Horizontal stabilizer
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 3.2), wingMat)
  hstab.position.set(-3.5, 0, 0)
  group.add(hstab)

  // Vertical stabilizer
  const vstab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.15), wingMat)
  vstab.position.set(-3.5, 0.6, 0)
  group.add(vstab)

  // Cockpit canopy
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI*2, 0, Math.PI/2),
    new THREE.MeshPhongMaterial({ color: 0x223344, transparent: true, opacity: 0.6 })
  )
  canopy.position.set(2.8, 0.55, 0)
  group.add(canopy)

  // Engine nozzle indicator (for exhaust attachment)
  const nozzle = new THREE.Object3D()
  nozzle.name = 'nozzle'
  nozzle.position.set(-4.0, 0, 0)
  group.add(nozzle)

  // Three.js convention: aircraft points in -Z direction (forward)
  // but our NED model has forward = +X. We rotate the group to align.
  group.rotation.y = Math.PI / 2

  return group
}

export function createNozzlePoint(group: THREE.Group): THREE.Object3D {
  return group.getObjectByName('nozzle') ?? group
}
