import * as THREE from 'three'

/**
 * Cockpit interior modeled in the CockpitCamera body frame (no mesh bias):
 *   forward = local −Z, right = +X, up = +Y.
 * The group origin is the pilot's eye point, so all structure is placed
 * ahead of and below the origin (with the canopy above and the seat behind).
 * Materials are self-lit (emissive) so the tub reads clearly regardless of
 * sun angle, and the MFD / HUD quads face the pilot (+Z normal).
 */
export function createPlaceholderCockpit(aircraftId: string): THREE.Group {
  const cockpit = new THREE.Group()
  cockpit.name = 'cockpit_interior'

  const structMat = new THREE.MeshStandardMaterial({
    color: 0x2b2f34, emissive: 0x0b0d0f, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide,
  })
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x141619, emissive: 0x050506, roughness: 0.9, metalness: 0.15, side: THREE.DoubleSide,
  })
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d20, emissive: 0x070809, roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide,
  })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8fd0ff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.0, side: THREE.DoubleSide,
  })
  const mfdBezelMat = new THREE.MeshStandardMaterial({
    color: 0x0c0d0f, emissive: 0x000000, roughness: 0.9, metalness: 0.2, side: THREE.DoubleSide,
  })

  const add = (
    geo: THREE.BufferGeometry, mat: THREE.Material,
    x: number, y: number, z: number,
    rx = 0, ry = 0, rz = 0,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, rz)
    cockpit.add(m)
    return m
  }

  // Glareshield / coaming just below the line of sight, ahead of the pilot.
  add(new THREE.BoxGeometry(1.15, 0.10, 0.34), darkMat, 0, -0.26, -0.60)

  // Main instrument panel (vertical face) below the glareshield.
  add(new THREE.BoxGeometry(1.05, 0.42, 0.05), structMat, 0, -0.46, -0.75)

  // MFD bezels + display quads (left / right of the main panel).
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.28, 0.28, 0.04), mfdBezelMat, side * 0.28, -0.44, -0.735)
  }

  const mfdGeo = new THREE.PlaneGeometry(0.22, 0.22)
  // PlaneGeometry normal is +Z; the pilot (origin) sits on the +Z side of the
  // panels, so the textured front already faces the pilot. Tilt the top slightly
  // back (toward the eye) so it is comfortable to read.
  const lMFD = add(mfdGeo, new THREE.MeshBasicMaterial({ color: 0x002200, side: THREE.DoubleSide }),
    -0.28, -0.44, -0.73, -0.18, 0.10, 0)
  lMFD.name = 'mfd_left'
  const rMFD = add(mfdGeo.clone(), new THREE.MeshBasicMaterial({ color: 0x002200, side: THREE.DoubleSide }),
    0.28, -0.44, -0.73, -0.18, -0.10, 0)
  rMFD.name = 'mfd_right'

  // Center lower console / pedestal.
  add(new THREE.BoxGeometry(0.34, 0.26, 0.42), darkMat, 0, -0.62, -0.5)

  // Side consoles running fore-aft along the tub rails.
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.14, 0.24, 0.75), structMat, side * 0.5, -0.5, -0.35)
  }

  // Canopy sill rails (fore-aft) at shoulder height.
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.06, 0.06, 1.15), railMat, side * 0.5, -0.12, -0.25)
  }

  // Canopy bows (front arch + mid arch) over the pilot.
  for (const z of [-0.55, 0.05]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 6, 16, Math.PI), railMat)
    arch.position.set(0, -0.1, z)
    arch.rotation.y = Math.PI / 2
    cockpit.add(arch)
  }

  // Canopy glass shell (see-through).
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    glassMat,
  )
  canopy.position.set(0, -0.1, -0.2)
  cockpit.add(canopy)

  // Ejection seat back + headrest behind the eye.
  add(new THREE.BoxGeometry(0.5, 0.6, 0.1), darkMat, 0, -0.35, 0.32)
  add(new THREE.BoxGeometry(0.26, 0.16, 0.1), railMat, 0, 0.02, 0.34)

  void aircraftId
  return cockpit
}
