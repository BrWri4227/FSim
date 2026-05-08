import * as THREE from 'three'

export function createPlaceholderCockpit(aircraftId: string): THREE.Group {
  const cockpit = new THREE.Group()
  cockpit.name = 'cockpit_interior'

  const panelMat   = new THREE.MeshPhongMaterial({ color: 0x222222, side: THREE.FrontSide })
  const glassMat   = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  const darkMat    = new THREE.MeshPhongMaterial({ color: 0x111111 })

  // Instrument panel (front)
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.06), panelMat)
  panel.position.set(0.8, 0, -0.35)
  panel.rotation.y = 0
  cockpit.add(panel)

  // Side consoles
  for (const side of [-1, 1]) {
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.5), darkMat)
    console_.position.set(0.5, side * 0.55, -0.2)
    cockpit.add(console_)
  }

  // Canopy frame (left + right bow)
  for (const side of [-1, 1]) {
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), darkMat)
    bow.rotation.z = Math.PI / 2
    bow.position.set(0.3, side * 0.52, 0.15)
    cockpit.add(bow)
  }

  // Canopy glass
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat)
  canopy.position.set(0.25, 0, 0.1)
  canopy.rotation.z = -Math.PI / 2
  cockpit.add(canopy)

  // Left MFD placeholder quad
  const mfdGeo = new THREE.PlaneGeometry(0.22, 0.22)
  const lMFDMat = new THREE.MeshBasicMaterial({ color: 0x002200 })
  const lMFD = new THREE.Mesh(mfdGeo, lMFDMat)
  lMFD.name = 'mfd_left'
  lMFD.position.set(0.81, -0.22, -0.2)
  lMFD.rotation.y = -Math.PI / 16
  cockpit.add(lMFD)

  // Right MFD placeholder quad
  const rMFDMat = new THREE.MeshBasicMaterial({ color: 0x002200 })
  const rMFD = new THREE.Mesh(mfdGeo.clone(), rMFDMat)
  rMFD.name = 'mfd_right'
  rMFD.position.set(0.81, 0.22, -0.2)
  rMFD.rotation.y = Math.PI / 16
  cockpit.add(rMFD)

  // HUD combiner glass
  const hudGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.22), glassMat.clone())
  hudGlass.name = 'hud_combiner'
  hudGlass.position.set(0.68, 0, -0.05)
  hudGlass.rotation.x = THREE.MathUtils.degToRad(30)
  cockpit.add(hudGlass)

  void aircraftId
  return cockpit
}
