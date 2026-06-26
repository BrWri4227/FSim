import * as THREE from 'three'

// Per-aircraft procedural geometry. Fuselage nose points along local +X.
// Aircraft.ts updateMesh applies a +90° Y quaternion bias to align with world -Z (NED North).
// Each aircraft has a distinctive silhouette matching the real-world type.

// ── Material helpers ────────────────────────────────────────────────────────

/** Standard aircraft skin — low-to-medium metalness for a painted-metal look. */
function bm(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color, metalness: 0.35, roughness: 0.62, emissive: 0x000000,
  })
}
/** Metallic / dark-metal parts: nozzles, IRST balls, TVC bells. */
function mm(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color, metalness: 0.88, roughness: 0.22, emissive: 0x000000,
  })
}
function canopyMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x142838, metalness: 0.90, roughness: 0.08,
    transparent: true, opacity: 0.58, emissive: 0x000000,
  })
}

// ── Geometry helpers ────────────────────────────────────────────────────────

function addBox(
  g: THREE.Group, m: THREE.Material,
  w: number, h: number, d: number,
  x = 0, y = 0, z = 0,
  rx = 0, rz = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, 0, rz)
  mesh.castShadow = true
  g.add(mesh)
  return mesh
}

/** Cylinder with long axis along +X (nose cone / nacelle). */
function addCylX(
  g: THREE.Group, m: THREE.Material,
  rt: number, rb: number, len: number,
  x = 0, y = 0, z = 0, segs = 8
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, segs), m)
  // Rotate so the cylinder "top" points toward +X (nose-forward).
  mesh.rotation.z = -Math.PI / 2
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  g.add(mesh)
  return mesh
}

function wingGeom(
  rootChord: number,
  tipChord: number,
  semiSpan: number,
  sweepBack: number,
  thickness: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(-rootChord, 0)
  shape.lineTo(-sweepBack - tipChord, semiSpan)
  shape.lineTo(-sweepBack, semiSpan)
  shape.closePath()

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1,
  })
  // Center thickness around Y=0 after rotation into XZ planform.
  geom.translate(0, 0, -thickness / 2)
  geom.rotateX(-Math.PI / 2)
  return geom
}

function addWing(
  g: THREE.Group,
  m: THREE.Material,
  side: 1 | -1,
  x: number,
  y: number,
  rootOffsetZ: number,
  rootChord: number,
  tipChord: number,
  semiSpan: number,
  sweepBack: number,
  thickness = 0.10
): THREE.Mesh {
  const baseMat = m.clone() as THREE.MeshStandardMaterial
  baseMat.side = THREE.DoubleSide

  const mesh = new THREE.Mesh(
    wingGeom(rootChord, tipChord, semiSpan, sweepBack, thickness),
    baseMat
  )
  mesh.position.set(x, y, side > 0 ? rootOffsetZ : -rootOffsetZ)
  if (side < 0) mesh.scale.z = -1
  mesh.castShadow = true
  g.add(mesh)
  return mesh
}

function addCanopy(
  g: THREE.Group, x: number, y: number,
  radius = 0.52, arc = 0.5, segs = 12
): void {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segs, segs - 2, 0, Math.PI * 2, 0, Math.PI * arc),
    canopyMat()
  )
  mesh.position.set(x, y, 0)
  mesh.castShadow = true
  g.add(mesh)
}

/** Uniform fuselage box. Nose at +X, centered on origin. */
function addFuselage(
  g: THREE.Group, m: THREE.Material,
  len: number, h: number, w: number
): void {
  addBox(g, m, len, h, w, 0, 0, 0)
}

function cylFrontX(cx: number, len: number): number { return cx + len / 2 }
function cylRearX(cx: number, len: number): number { return cx - len / 2 }

/** Z center for a part mounted flush on the fuselage side. */
function sideZ(fuseW: number, partD: number): number {
  return fuseW / 2 + partD / 2
}

/** Nose cone; returns X of the forward tip. */
function addNoseCone(
  g: THREE.Group, m: THREE.Material,
  cx: number, len: number, tipR: number
): number {
  addCylX(g, m, 0, tipR, len, cx, 0, 0, 10)
  return cylFrontX(cx, len)
}

/** Short radome cap extending forward from nose tip. */
function addRadomeCap(
  g: THREE.Group, noseTipX: number, radius: number, len = 0.35
): number {
  addCylX(g, mm(0x1a1a22), radius, radius * 0.88, len, noseTipX + len / 2, 0, 0, 10)
  return noseTipX + len
}

/** Pitot tube extending forward from the given X. */
function addPitotAt(
  g: THREE.Group, frontX: number,
  len = 0.4, y = 0.10, z = 0.25
): void {
  addCylX(g, mm(0x999999), 0.016, 0.008, len, frontX + len / 2, y, z, 6)
}

/** Circular nozzle bell mounted at nacelle tail; returns exhaust X. */
function addNozzleAt(
  g: THREE.Group, rearX: number, y: number, z: number,
  radius: number, depth: number
): number {
  addCylX(g, mm(0x2a2a2a), radius, radius * 0.90, depth, rearX - depth / 2, y, z, 10)
  return rearX - depth
}

/** TVC bell mounted at nacelle tail; returns exhaust X. */
function addTvcAt(
  g: THREE.Group, rearX: number, y: number, z: number,
  rIn: number, rOut: number, depth: number
): number {
  addCylX(g, mm(0x333333), rIn, rOut, depth, rearX - depth / 2, y, z, 10)
  return rearX - depth
}

/** Rectangular nozzle mounted at nacelle tail; returns exhaust X. */
function addRectNozzleAt(
  g: THREE.Group, rearX: number, y: number, z: number,
  h: number, w: number, depth = 0.14
): number {
  addBox(g, mm(0x333333), depth, h, w, rearX - depth / 2, y, z)
  return rearX - depth
}

/** Wing fence standing on the wing upper surface. */
function addWingFence(
  g: THREE.Group, m: THREE.Material,
  x: number, wingY: number, z: number,
  height: number, wingThick = 0.12
): void {
  addBox(g, m, 0.04, height, 0.28, x, wingY + wingThick / 2 + height / 2, z)
}

/** LEX pair blending from fuselage shoulders. */
function addLexPair(
  g: THREE.Group, m: THREE.Material,
  fuseW: number, x: number, y: number,
  len: number, height: number, depth: number,
  sweepRz = 0.12
): void {
  const z = sideZ(fuseW, depth)
  addBox(g, m, len, height, depth, x, y, z, 0, -sweepRz)
  addBox(g, m, len, height, depth, x, y, -z, 0, sweepRz)
}

/** Side intake pair flush with fuselage. */
function addSideIntakePair(
  g: THREE.Group, m: THREE.Material,
  fuseW: number, fuseH: number,
  x: number, w: number, h: number, d: number,
  bellyInset = 0.04
): void {
  const z = sideZ(fuseW, d)
  const y = -fuseH / 2 + h / 2 + bellyInset
  addBox(g, m, w, h, d, x, y, z)
  addBox(g, m, w, h, d, x, y, -z)
}

/** Outward- or inward-canted vertical stabilizer rooted on fuselage top. */
function addCantedVStab(
  g: THREE.Group, m: THREE.Material,
  x: number, fuseTopY: number, z: number,
  w: number, h: number, d: number,
  cantRad: number
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, fuseTopY + h / 2, z)
  mesh.rotation.x = cantRad
  mesh.castShadow = true
  g.add(mesh)
}

/**
 * Add deployed flap surfaces as a hidden 'flaps-group' child.
 * Flaps are thin trailing-edge panels angled ~35° down from the wing plane.
 * flapX: X position (chord-wise), flapZ: half-span start, flapSpan: panel span.
 */
function addFlapsGroup(
  g: THREE.Group,
  flapX: number,
  flapZ: number,
  flapSpan: number,
  flapChord: number,
  wingY: number
): void {
  const fm = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.2, roughness: 0.75, side: THREE.DoubleSide })
  const flaps = new THREE.Group()
  flaps.name = 'flaps-group'

  const angleRad = 35 * Math.PI / 180
  const halfC = flapChord / 2

  for (const side of [1, -1] as const) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(flapChord, 0.05, flapSpan), fm)
    panel.position.set(flapX - halfC * Math.cos(angleRad), wingY - halfC * Math.sin(angleRad), side * flapZ)
    panel.rotation.z = angleRad  // rotate around span axis: trailing edge deflects down
    flaps.add(panel)
  }

  flaps.visible = false
  g.add(flaps)
}

/**
 * Add retractable landing gear (nose + two main gear) as a hidden 'gear-group' child.
 * Struts extend downward (−Y). All positions are in local mesh space (+X = nose).
 */
function addGearGroup(
  g: THREE.Group,
  noseX: number,
  mainX: number,
  mainZ: number,
  bellyY: number,
  strutH: number,
  wheelR: number
): void {
  const gm = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.4 })
  const gear = new THREE.Group()
  gear.name = 'gear-group'

  // Nose strut + wheel
  const nStrut = new THREE.Mesh(new THREE.BoxGeometry(0.08, strutH, 0.08), gm)
  nStrut.position.set(noseX, bellyY - strutH / 2, 0)
  gear.add(nStrut)
  const nWheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.18, 8), gm)
  nWheel.rotation.x = Math.PI / 2
  nWheel.position.set(noseX, bellyY - strutH - wheelR, 0)
  gear.add(nWheel)

  // Left main strut + wheel
  const lStrut = new THREE.Mesh(new THREE.BoxGeometry(0.10, strutH, 0.10), gm)
  lStrut.position.set(mainX, bellyY - strutH / 2, mainZ)
  gear.add(lStrut)
  const lWheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 1.3, wheelR * 1.3, 0.22, 8), gm)
  lWheel.rotation.x = Math.PI / 2
  lWheel.position.set(mainX, bellyY - strutH - wheelR * 1.3, mainZ)
  gear.add(lWheel)

  // Right main strut + wheel
  const rStrut = new THREE.Mesh(new THREE.BoxGeometry(0.10, strutH, 0.10), gm)
  rStrut.position.set(mainX, bellyY - strutH / 2, -mainZ)
  gear.add(rStrut)
  const rWheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 1.3, wheelR * 1.3, 0.22, 8), gm)
  rWheel.rotation.x = Math.PI / 2
  rWheel.position.set(mainX, bellyY - strutH - wheelR * 1.3, -mainZ)
  gear.add(rWheel)

  gear.visible = false
  g.add(gear)
}

/** Place one invisible nozzle Object3D per engine exhaust. */
function placeNozzle(g: THREE.Group, positions: [number, number, number][]): void {
  for (let i = 0; i < positions.length; i++) {
    const [x, y, z] = positions[i]!
    const nozzle = new THREE.Object3D()
    nozzle.name = positions.length === 1 ? 'nozzle' : `nozzle-${i}`
    nozzle.position.set(x, y, z)
    g.add(nozzle)
  }
}

// ── F-15C Eagle ─────────────────────────────────────────────────────────────
function buildF15C(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = 0x7799bb
  const Cw = C - 0x0f0f10
  const Cd = C - 0x1f1f20
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)
  const fLen = 10.0, fH = 1.1, fW = 1.3

  addFuselage(g, fm, fLen, fH, fW)
  const noseTip = addNoseCone(g, fm, 6.4, 2.8, 0.55)
  addPitotAt(g, addRadomeCap(g, noseTip, 0.55))

  addCanopy(g, 3.3, fH / 2 + 0.02, 0.50, 0.52)

  // Cheek intakes — flush with fuselage sides
  const iD = 0.7, iZ = sideZ(fW, iD)
  addBox(g, dm, 3.0, 0.65, iD, 1.5, -0.18, iZ)
  addBox(g, dm, 3.0, 0.65, iD, 1.5, -0.18, -iZ)

  const wingY = -0.28
  addWing(g, wm, 1, 2.0, wingY, sideZ(fW, 0.10), 4.4, 1.7, 3.7, 1.0, 0.12)
  addWing(g, wm, -1, 2.0, wingY, sideZ(fW, 0.10), 4.4, 1.7, 3.7, 1.0, 0.12)

  const tailZ = sideZ(fW, 0.13)
  addBox(g, wm, 2.2, 2.0, 0.13, -3.8, fH / 2 + 1.0, tailZ, 0.05)
  addBox(g, wm, 2.2, 2.0, 0.13, -3.8, fH / 2 + 1.0, -tailZ, -0.05)

  const stabZ = sideZ(fW, 2.5)
  addBox(g, wm, 2.0, 0.10, 2.5, -4.5, wingY + 0.06, stabZ)
  addBox(g, wm, 2.0, 0.10, 2.5, -4.5, wingY + 0.06, -stabZ)

  const engZ = sideZ(fW * 0.85, 0.52 * 2)
  const nLen = 4.5, nCx = -3.0
  addCylX(g, dm, 0.42, 0.52, nLen, nCx, -0.05, engZ, 12)
  addCylX(g, dm, 0.42, 0.52, nLen, nCx, -0.05, -engZ, 12)
  const exL = addNozzleAt(g, cylRearX(nCx, nLen), -0.05, engZ, 0.52, 0.28)
  const exR = addNozzleAt(g, cylRearX(nCx, nLen), -0.05, -engZ, 0.52, 0.28)

  addFlapsGroup(g, 0.0, 0.8, 2.0, 1.2, wingY)
  addGearGroup(g, 4.0, 1.0, 1.0, -fH / 2, 0.5, 0.22)
  placeNozzle(g, [[exL, -0.05, engZ], [exR, -0.05, -engZ]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── F-16C Fighting Falcon ───────────────────────────────────────────────────
function buildF16C(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = 0x6688aa
  const Cw = C - 0x101010
  const Cd = C - 0x1a1a1a
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)
  const fLen = 9.0, fH = 0.9, fW = 1.05

  addFuselage(g, fm, fLen, fH, fW)
  const noseTip = addNoseCone(g, fm, 6.1, 3.2, 0.45)
  addPitotAt(g, addRadomeCap(g, noseTip, 0.45))

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.50, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    canopyMat()
  )
  canopy.position.set(2.9, fH / 2 + 0.0, 0)
  canopy.castShadow = true
  g.add(canopy)

  // Chin intake — centered under fuselage belly
  addBox(g, dm, 2.2, 0.52, 0.85, 1.2, -fH / 2 - 0.52 / 2 + 0.04, 0)

  const wingY = -0.26
  addWing(g, wm, 1, 1.6, wingY, sideZ(fW, 0.10), 4.0, 1.0, 3.2, 1.25, 0.11)
  addWing(g, wm, -1, 1.6, wingY, sideZ(fW, 0.10), 4.0, 1.0, 3.2, 1.25, 0.11)

  addBox(g, wm, 2.4, 2.1, 0.13, -3.6, fH / 2 + 1.05, 0)

  const stabZ = sideZ(fW, 1.8)
  addBox(g, wm, 1.5, 0.09, 1.8, -4.2, wingY + 0.04, stabZ)
  addBox(g, wm, 1.5, 0.09, 1.8, -4.2, wingY + 0.04, -stabZ)

  const nLen = 4.0, nCx = -2.8
  addCylX(g, dm, 0.38, 0.48, nLen, nCx, 0.0, 0, 12)
  const ex = addNozzleAt(g, cylRearX(nCx, nLen), 0.0, 0, 0.48, 0.26)

  addFlapsGroup(g, 0.2, 0.65, 1.8, 1.0, wingY)
  addGearGroup(g, 3.5, 1.0, 0.9, -fH / 2, 0.5, 0.20)
  placeNozzle(g, [[ex, 0.0, 0]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── F/A-18C Hornet ──────────────────────────────────────────────────────────
function buildFA18C(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = 0x556677
  const Cw = C - 0x0e0e0e
  const Cd = C - 0x1a1a1a
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)
  const fLen = 9.5, fH = 1.0, fW = 1.25

  addFuselage(g, fm, fLen, fH, fW)
  const noseTip = addNoseCone(g, fm, 6.15, 2.8, 0.50)
  addPitotAt(g, addRadomeCap(g, noseTip, 0.50))

  addCanopy(g, 3.0, fH / 2 + 0.06, 0.48, 0.50)

  addLexPair(g, bm(C - 0x08080a), fW, 1.8, -0.10, 4.2, 0.18, 1.4, 0.12)
  addSideIntakePair(g, dm, fW, fH, 1.0, 2.0, 0.55, 0.65, 0.02)

  const wingY = -0.28
  addWing(g, wm, 1, 1.5, wingY, sideZ(fW, 0.10), 3.9, 1.6, 3.5, 0.95, 0.11)
  addWing(g, wm, -1, 1.5, wingY, sideZ(fW, 0.10), 3.9, 1.6, 3.5, 0.95, 0.11)

  const tailZ = sideZ(fW, 0.13)
  addCantedVStab(g, wm, -3.6, fH / 2, tailZ, 2.0, 1.8, 0.13, 0.36)
  addCantedVStab(g, wm, -3.6, fH / 2, -tailZ, 2.0, 1.8, 0.13, -0.36)

  const stabZ = sideZ(fW, 2.2)
  addBox(g, wm, 1.8, 0.10, 2.2, -4.2, wingY + 0.08, stabZ)
  addBox(g, wm, 1.8, 0.10, 2.2, -4.2, wingY + 0.08, -stabZ)

  const engZ = sideZ(fW, 0.65)
  const nLen = 3.8, nCx = -3.0
  addCylX(g, dm, 0.38, 0.46, nLen, nCx, -0.05, engZ, 12)
  addCylX(g, dm, 0.38, 0.46, nLen, nCx, -0.05, -engZ, 12)
  const exL = addNozzleAt(g, cylRearX(nCx, nLen), -0.05, engZ, 0.46, 0.26)
  const exR = addNozzleAt(g, cylRearX(nCx, nLen), -0.05, -engZ, 0.46, 0.26)

  addFlapsGroup(g, 0.0, 0.7, 1.9, 1.1, wingY)
  addGearGroup(g, 3.5, 0.5, 0.9, -fH / 2, 0.5, 0.21)
  placeNozzle(g, [[exL, -0.05, engZ], [exR, -0.05, -engZ]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── MiG-29 Fulcrum ──────────────────────────────────────────────────────────
function buildMiG29(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = 0x887766
  const Cw = C - 0x0f0f0e
  const Cd = C - 0x1a1a18
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)
  const fLen = 9.5, fH = 1.05, fW = 1.55

  addFuselage(g, fm, fLen, fH, fW)
  const noseTip = addNoseCone(g, fm, 6.0, 2.5, 0.52)
  addPitotAt(g, addRadomeCap(g, noseTip, 0.52))

  addCanopy(g, 3.1, fH / 2 + 0.045, 0.48, 0.50)

  addLexPair(g, bm(C - 0x080808), fW, 1.5, 0.05, 5.0, 0.20, 1.7, 0.15)

  const iD = 0.85
  addSideIntakePair(g, dm, fW, fH, 1.8, 2.8, 0.7, iD, 0.06)

  const wingY = -0.28
  const wingRoot = sideZ(fW, 0.10)
  addWing(g, wm, 1, 2.0, wingY, wingRoot, 4.2, 1.6, 3.9, 0.95, 0.12)
  addWing(g, wm, -1, 2.0, wingY, wingRoot, 4.2, 1.6, 3.9, 0.95, 0.12)
  addWingFence(g, wm, 0.5, wingY, wingRoot + 0.8, 0.32, 0.12)
  addWingFence(g, wm, 0.5, wingY, -(wingRoot + 0.8), 0.32, 0.12)

  const tailZ = sideZ(fW, 0.13)
  addBox(g, wm, 2.2, 2.0, 0.13, -3.8, fH / 2 + 1.0, tailZ, 0.07)
  addBox(g, wm, 2.2, 2.0, 0.13, -3.8, fH / 2 + 1.0, -tailZ, -0.07)

  const stabZ = sideZ(fW, 2.4)
  addBox(g, wm, 2.0, 0.10, 2.4, -4.3, wingY + 0.06, stabZ)
  addBox(g, wm, 2.0, 0.10, 2.4, -4.3, wingY + 0.06, -stabZ)

  const engZ = sideZ(fW, 0.65 * 2) * 0.85
  const nLen = 4.8, nCx = -3.0
  addCylX(g, dm, 0.42, 0.52, nLen, nCx, 0.0, engZ, 12)
  addCylX(g, dm, 0.42, 0.52, nLen, nCx, 0.0, -engZ, 12)
  const exL = addNozzleAt(g, cylRearX(nCx, nLen), 0.0, engZ, 0.52, 0.28)
  const exR = addNozzleAt(g, cylRearX(nCx, nLen), 0.0, -engZ, 0.52, 0.28)

  addFlapsGroup(g, 0.2, 0.85, 2.0, 1.2, wingY)
  addGearGroup(g, 3.8, 0.8, 1.0, -fH / 2, 0.55, 0.22)
  placeNozzle(g, [[exL, 0.0, engZ], [exR, 0.0, -engZ]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Su-27 Flanker ───────────────────────────────────────────────────────────
function buildSu27(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = 0x998866
  const Cw = C - 0x101010
  const Cd = C - 0x1c1c1c
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)
  const fLen = 12.0, fH = 1.1, fW = 1.5

  addFuselage(g, fm, fLen, fH, fW)
  addBox(g, bm(C - 0x0a0a0a), 5.5, 0.5, 0.85, -0.5, fH / 2 + 0.10, 0)
  const noseTip = addNoseCone(g, fm, 7.6, 3.2, 0.55)
  addPitotAt(g, addRadomeCap(g, noseTip, 0.55))

  addCanopy(g, 4.0, fH / 2 + 0.02, 0.50, 0.50)

  addLexPair(g, bm(C - 0x080808), fW, 1.5, -0.05, 5.5, 0.20, 2.0, 0.10)

  const iD = 0.85
  addSideIntakePair(g, dm, fW, fH, 2.0, 3.0, 0.72, iD, 0.04)

  const wingY = -0.30
  const wingRoot = sideZ(fW, 0.10)
  addWing(g, wm, 1, 2.0, wingY, wingRoot, 5.3, 1.9, 4.6, 1.05, 0.12)
  addWing(g, wm, -1, 2.0, wingY, wingRoot, 5.3, 1.9, 4.6, 1.05, 0.12)
  addWingFence(g, wm, 0.2, wingY, wingRoot + 1.0, 0.38, 0.12)
  addWingFence(g, wm, 0.2, wingY, -(wingRoot + 1.0), 0.38, 0.12)

  const tailZ = sideZ(fW, 0.13)
  addBox(g, wm, 2.5, 2.2, 0.13, -5.0, fH / 2 + 1.1, tailZ, 0.06)
  addBox(g, wm, 2.5, 2.2, 0.13, -5.0, fH / 2 + 1.1, -tailZ, -0.06)

  const stabZ = sideZ(fW, 2.8)
  addBox(g, wm, 2.2, 0.10, 2.8, -5.5, wingY + 0.05, stabZ)
  addBox(g, wm, 2.2, 0.10, 2.8, -5.5, wingY + 0.05, -stabZ)

  const engZ = sideZ(fW, 0.72 * 2) * 0.88
  const nLen = 6.0, nCx = -3.5
  addCylX(g, dm, 0.45, 0.55, nLen, nCx, -0.05, engZ, 12)
  addCylX(g, dm, 0.45, 0.55, nLen, nCx, -0.05, -engZ, 12)
  const exL = addNozzleAt(g, cylRearX(nCx, nLen), -0.05, engZ, 0.55, 0.30)
  const exR = addNozzleAt(g, cylRearX(nCx, nLen), -0.05, -engZ, 0.55, 0.30)

  addFlapsGroup(g, -0.2, 1.1, 2.4, 1.4, wingY)
  addGearGroup(g, 5.0, 0.5, 1.0, -fH / 2, 0.55, 0.24)
  placeNozzle(g, [[exL, -0.05, engZ], [exR, -0.05, -engZ]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Su-35 Flanker-E ─────────────────────────────────────────────────────────
function buildSu35(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = 0x778866
  const Cw = C - 0x101010
  const Cd = C - 0x1c1c1c
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)
  const fLen = 12.0, fH = 1.1, fW = 1.5

  addFuselage(g, fm, fLen, fH, fW)
  addBox(g, bm(C - 0x0a0a0a), 5.5, 0.5, 0.85, -0.5, fH / 2 + 0.10, 0)
  const noseTip = addNoseCone(g, fm, 7.6, 3.2, 0.55)
  addPitotAt(g, addRadomeCap(g, noseTip, 0.55))

  // Nose chines flush with fuselage sides
  const chineD = 0.55
  const chineZ = sideZ(fW, chineD)
  addBox(g, bm(Cd), 3.5, 0.18, chineD, 4.5, 0.0, chineZ)
  addBox(g, bm(Cd), 3.5, 0.18, chineD, 4.5, 0.0, -chineZ)
  const irst = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), mm(0x222222))
  irst.position.set(5.5, 0.0, chineZ * 0.55)
  g.add(irst)

  addCanopy(g, 4.0, fH / 2 + 0.02, 0.50, 0.50)

  addLexPair(g, bm(C - 0x080808), fW, 1.5, -0.05, 5.5, 0.20, 2.0, 0.10)
  addSideIntakePair(g, dm, fW, fH, 2.0, 3.0, 0.72, 0.85, 0.04)

  const wingY = -0.30
  const wingRoot = sideZ(fW, 0.10)
  addWing(g, wm, 1, 2.0, wingY, wingRoot, 5.4, 1.8, 4.7, 1.00, 0.12)
  addWing(g, wm, -1, 2.0, wingY, wingRoot, 5.4, 1.8, 4.7, 1.00, 0.12)
  addWingFence(g, wm, 0.2, wingY, wingRoot + 1.05, 0.38, 0.12)
  addWingFence(g, wm, 0.2, wingY, -(wingRoot + 1.05), 0.38, 0.12)

  const tailZ = sideZ(fW, 0.13)
  addBox(g, wm, 2.5, 2.2, 0.13, -5.0, fH / 2 + 1.1, tailZ, 0.06)
  addBox(g, wm, 2.5, 2.2, 0.13, -5.0, fH / 2 + 1.1, -tailZ, -0.06)

  const stabZ = sideZ(fW, 2.8)
  addBox(g, wm, 2.2, 0.10, 2.8, -5.5, wingY + 0.05, stabZ)
  addBox(g, wm, 2.2, 0.10, 2.8, -5.5, wingY + 0.05, -stabZ)

  const engZ = sideZ(fW, 0.72 * 2) * 0.88
  const nLen = 6.0, nCx = -3.5
  addCylX(g, dm, 0.45, 0.55, nLen, nCx, -0.05, engZ, 12)
  addCylX(g, dm, 0.45, 0.55, nLen, nCx, -0.05, -engZ, 12)
  const exL = addTvcAt(g, cylRearX(nCx, nLen), -0.05, engZ, 0.55, 0.48, 0.55)
  const exR = addTvcAt(g, cylRearX(nCx, nLen), -0.05, -engZ, 0.55, 0.48, 0.55)

  addFlapsGroup(g, -0.2, 1.1, 2.4, 1.4, wingY)
  addGearGroup(g, 5.0, 0.5, 1.0, -fH / 2, 0.55, 0.24)
  placeNozzle(g, [[exL, -0.05, engZ], [exR, -0.05, -engZ]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── F-22A Raptor ────────────────────────────────────────────────────────────
function buildF22(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = 0x4a5568
  const Cw = C - 0x0c0c0d
  const Cd = C - 0x181819
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)
  const fLen = 11.5, fH = 1.05, fW = 1.45

  addFuselage(g, fm, fLen, fH, fW)
  const noseTip = addNoseCone(g, fm, 7.25, 3.0, 0.48)
  addPitotAt(g, addRadomeCap(g, noseTip, 0.48))

  const chineD = 0.55
  const chineZ = sideZ(fW, chineD)
  addBox(g, bm(C - 0x060608), 3.5, 0.12, chineD, 5.5, fH / 2 - 0.34, chineZ)
  addBox(g, bm(C - 0x060608), 3.5, 0.12, chineD, 5.5, fH / 2 - 0.34, -chineZ)

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    canopyMat()
  )
  canopy.position.set(3.5, fH / 2 + 0.0, 0)
  canopy.castShadow = true
  g.add(canopy)

  const dsiD = 0.75
  const dsiZ = sideZ(fW, dsiD)
  addBox(g, dm, 1.8, 0.55, dsiD, 2.2, -0.12, dsiZ)
  addBox(g, dm, 1.8, 0.55, dsiD, 2.2, -0.12, -dsiZ)

  const wingY = -0.30
  addWing(g, wm, 1, 1.8, wingY, sideZ(fW, 0.10), 4.8, 1.4, 4.2, 1.35, 0.11)
  addWing(g, wm, -1, 1.8, wingY, sideZ(fW, 0.10), 4.8, 1.4, 4.2, 1.35, 0.11)

  const tailZ = sideZ(fW, 0.12)
  addCantedVStab(g, wm, -4.2, fH / 2, tailZ, 2.0, 1.9, 0.12, 0.47)
  addCantedVStab(g, wm, -4.2, fH / 2, -tailZ, 2.0, 1.9, 0.12, -0.47)

  const stabZ = sideZ(fW, 2.2)
  addBox(g, wm, 1.6, 0.09, 2.2, -4.8, wingY + 0.12, stabZ)
  addBox(g, wm, 1.6, 0.09, 2.2, -4.8, wingY + 0.12, -stabZ)

  const engZ = sideZ(fW, 0.58 * 2) * 0.88
  const nLen = 4.2, nCx = -3.2
  addCylX(g, dm, 0.40, 0.48, nLen, nCx, -0.08, engZ, 12)
  addCylX(g, dm, 0.40, 0.48, nLen, nCx, -0.08, -engZ, 12)
  const exL = addRectNozzleAt(g, cylRearX(nCx, nLen), -0.08, engZ, 0.55, 0.55)
  const exR = addRectNozzleAt(g, cylRearX(nCx, nLen), -0.08, -engZ, 0.55, 0.55)

  addFlapsGroup(g, 0.0, 0.75, 2.0, 1.1, wingY)
  addGearGroup(g, 4.5, 0.8, 1.0, -fH / 2, 0.52, 0.22)
  placeNozzle(g, [[exL, -0.08, engZ], [exR, -0.08, -engZ]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── F-35A Lightning II ─────────────────────────────────────────────────────
function buildF35A(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = 0x5a6678
  const Cw = C - 0x0d0d0e
  const Cd = C - 0x1a1a1b
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)
  const fLen = 9.5, fH = 1.15, fW = 1.35

  addFuselage(g, fm, fLen, fH, fW)
  addBox(g, bm(C - 0x050507), 7.0, 0.22, 0.70, 1.5, fH / 2 - 0.15, 0)
  const noseTip = addNoseCone(g, fm, 6.05, 2.6, 0.46)
  addPitotAt(g, addRadomeCap(g, noseTip, 0.46))

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    canopyMat()
  )
  canopy.position.set(2.8, fH / 2 + 0.0, 0)
  canopy.castShadow = true
  g.add(canopy)

  const dsiD = 0.70
  const dsiZ = sideZ(fW, dsiD)
  addBox(g, dm, 1.6, 0.50, dsiD, 1.8, -0.15, dsiZ)
  addBox(g, dm, 1.6, 0.50, dsiD, 1.8, -0.15, -dsiZ)

  const wingY = -0.26
  addWing(g, wm, 1, 1.4, wingY, sideZ(fW, 0.10), 3.5, 1.2, 3.0, 0.90, 0.10)
  addWing(g, wm, -1, 1.4, wingY, sideZ(fW, 0.10), 3.5, 1.2, 3.0, 0.90, 0.10)

  const tailZ = sideZ(fW, 0.11)
  addCantedVStab(g, wm, -3.8, fH / 2, tailZ, 1.6, 1.5, 0.11, 0.40)
  addCantedVStab(g, wm, -3.8, fH / 2, -tailZ, 1.6, 1.5, 0.11, -0.40)

  const stabZ = sideZ(fW, 1.8)
  addBox(g, wm, 1.4, 0.08, 1.8, -4.3, wingY + 0.06, stabZ)
  addBox(g, wm, 1.4, 0.08, 1.8, -4.3, wingY + 0.06, -stabZ)

  const nLen = 3.8, nCx = -2.8
  addCylX(g, dm, 0.38, 0.46, nLen, nCx, -0.05, 0, 12)
  const ex = addRectNozzleAt(g, cylRearX(nCx, nLen), -0.05, 0, 0.50, 0.50)

  addFlapsGroup(g, 0.2, 0.62, 1.6, 0.95, wingY)
  addGearGroup(g, 3.8, 0.6, 0.85, -fH / 2, 0.50, 0.21)
  placeNozzle(g, [[ex, -0.05, 0]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Su-57 Felon ─────────────────────────────────────────────────────────────
function buildSu57(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = 0x6a7068
  const Cw = C - 0x101010
  const Cd = C - 0x1c1c1c
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)
  const fLen = 12.5, fH = 1.05, fW = 1.40

  addFuselage(g, fm, fLen, fH, fW)
  addBox(g, bm(C - 0x080808), 8.0, 0.35, 1.20, 0.5, fH / 2 + 0.02, 0)
  const noseTip = addNoseCone(g, fm, 7.75, 3.0, 0.50)
  addPitotAt(g, addRadomeCap(g, noseTip, 0.50))

  const chineD = 0.50
  const chineZ = sideZ(fW, chineD)
  addBox(g, bm(Cd), 3.8, 0.16, chineD, 5.0, 0.05, chineZ)
  addBox(g, bm(Cd), 3.8, 0.16, chineD, 5.0, 0.05, -chineZ)
  const irst = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), mm(0x222222))
  irst.position.set(5.8, 0.05, chineZ * 0.55)
  g.add(irst)

  addCanopy(g, 4.2, fH / 2 + 0.035, 0.48, 0.48)

  addLexPair(g, bm(C - 0x070707), fW, 1.5, -0.02, 5.0, 0.18, 1.85, 0.12)

  const iD = 0.80
  addSideIntakePair(g, dm, fW, fH, 2.2, 2.5, 0.65, iD, 0.04)

  const wingY = -0.28
  const wingRoot = sideZ(fW, 0.10)
  addWing(g, wm, 1, 2.0, wingY, wingRoot, 5.2, 1.7, 4.5, 1.05, 0.11)
  addWing(g, wm, -1, 2.0, wingY, wingRoot, 5.2, 1.7, 4.5, 1.05, 0.11)

  const tailZ = sideZ(fW, 0.12)
  addBox(g, wm, 2.0, 1.8, 0.12, -4.8, fH / 2 + 0.90, tailZ, 0.08)
  addBox(g, wm, 2.0, 1.8, 0.12, -4.8, fH / 2 + 0.90, -tailZ, -0.08)

  const stabZ = sideZ(fW, 2.5)
  addBox(g, wm, 2.0, 0.09, 2.5, -5.3, wingY + 0.06, stabZ)
  addBox(g, wm, 2.0, 0.09, 2.5, -5.3, wingY + 0.06, -stabZ)

  const engZ = sideZ(fW, 0.85 * 2) * 0.92
  const nLen = 5.5, nCx = -3.3
  addCylX(g, dm, 0.42, 0.50, nLen, nCx, -0.05, engZ, 12)
  addCylX(g, dm, 0.42, 0.50, nLen, nCx, -0.05, -engZ, 12)
  const exL = addTvcAt(g, cylRearX(nCx, nLen), -0.05, engZ, 0.50, 0.42, 0.50)
  const exR = addTvcAt(g, cylRearX(nCx, nLen), -0.05, -engZ, 0.50, 0.42, 0.50)

  addFlapsGroup(g, -0.1, 1.0, 2.2, 1.3, wingY)
  addGearGroup(g, 5.2, 0.5, 1.05, -fH / 2, 0.55, 0.23)
  placeNozzle(g, [[exL, -0.05, engZ], [exR, -0.05, -engZ]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Fallback generic jet ────────────────────────────────────────────────────

function buildGeneric(_nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = _nation === 'USA' ? 0x6688aa : 0x887766
  const fm = bm(C), wm = bm(C - 0x111111)
  const fLen = 8.0, fH = 1.0, fW = 1.2

  addFuselage(g, fm, fLen, fH, fW)
  const noseTip = addNoseCone(g, fm, 5.0, 2.0, 0.5)
  addRadomeCap(g, noseTip, 0.5)
  addCanopy(g, 2.8, fH / 2 + 0.05)

  const wingY = -0.20
  addWing(g, wm, 1, 1.5, wingY, sideZ(fW, 0.10), 2.4, 1.0, 2.6, 0.8, 0.13)
  addWing(g, wm, -1, 1.5, wingY, sideZ(fW, 0.10), 2.4, 1.0, 2.6, 0.8, 0.13)

  const stabZ = sideZ(fW, 3.2)
  addBox(g, wm, 0.9, 0.12, 3.2, -3.5, wingY + 0.20, 0)
  addBox(g, wm, 0.9, 1.4, 0.13, -3.5, fH / 2 + 0.70, 0)

  const nLen = 3.5, nCx = -2.5
  addCylX(g, fm, 0.35, 0.42, nLen, nCx, 0, 0, 12)
  const ex = addNozzleAt(g, cylRearX(nCx, nLen), 0, 0, 0.42, 0.24)

  addFlapsGroup(g, 0.0, 0.65, 1.4, 0.9, wingY)
  addGearGroup(g, 3.0, 0.5, 0.8, -fH / 2, 0.5, 0.20)
  placeNozzle(g, [[ex, 0.0, 0]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Public API ──────────────────────────────────────────────────────────────

export function createPlaceholderAircraftMesh(aircraftId: string, nation: 'USA' | 'RUS'): THREE.Group {
  switch (aircraftId) {
    case 'f15c':  return buildF15C(nation)
    case 'f16c':  return buildF16C(nation)
    case 'fa18c': return buildFA18C(nation)
    case 'mig29': return buildMiG29(nation)
    case 'su27':  return buildSu27(nation)
    case 'su35':  return buildSu35(nation)
    case 'f22':   return buildF22(nation)
    case 'f35a':  return buildF35A(nation)
    case 'su57':  return buildSu57(nation)
    default:      return buildGeneric(nation)
  }
}

/** All engine nozzle anchor points on an aircraft mesh (1 or 2). */
export function createNozzlePoints(group: THREE.Group): THREE.Object3D[] {
  const points: THREE.Object3D[] = []
  group.traverse(obj => {
    if (obj.name === 'nozzle' || /^nozzle-\d+$/.test(obj.name)) {
      points.push(obj)
    }
  })
  points.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return points.length > 0 ? points : [group]
}

/** First nozzle point — convenience for single-engine callers. */
export function createNozzlePoint(group: THREE.Group): THREE.Object3D {
  return createNozzlePoints(group)[0] ?? group
}

/** Per-engine thruster scale: twin jets use two slightly smaller plumes. */
export function getThrusterScale(engineCount: number): number {
  return engineCount > 1 ? 1.45 : 1.8
}

const GEAR_CLEARANCE: Record<string, { gearUp: number; gearDown: number }> = {
  f15c:  { gearUp: 0.55, gearDown: 1.27 },
  f16c:  { gearUp: 0.45, gearDown: 1.15 },
  fa18c: { gearUp: 0.50, gearDown: 1.21 },
  mig29: { gearUp: 0.53, gearDown: 1.30 },
  su27:  { gearUp: 0.55, gearDown: 1.34 },
  su35:  { gearUp: 0.55, gearDown: 1.34 },
  f22:   { gearUp: 0.52, gearDown: 1.29 },
  f35a:  { gearUp: 0.57, gearDown: 1.32 },
  su57:  { gearUp: 0.52, gearDown: 1.32 },
}

export function getGroundClearance(aircraftId: string, gearDown: boolean): number {
  const c = GEAR_CLEARANCE[aircraftId] ?? { gearUp: 0.50, gearDown: 1.20 }
  return gearDown ? c.gearDown : c.gearUp
}

export function setGearVisible(group: THREE.Group, visible: boolean): void {
  const gear = group.getObjectByName('gear-group')
  if (gear) gear.visible = visible
}

export function setFlapsVisible(group: THREE.Group, visible: boolean): void {
  const flaps = group.getObjectByName('flaps-group')
  if (flaps) flaps.visible = visible
}

/**
 * Apply damage tint to all mesh children of an aircraft group.
 * damageLevel: 0 = pristine, 1 = destroyed.
 * onFire: adds orange emissive glow.
 */
export function applyDamageTint(group: THREE.Group, damageLevel: number, onFire: boolean): void {
  const fireEmissive   = new THREE.Color(0.6, 0.15, 0.0)
  const damageEmissive = new THREE.Color(0.25, 0.05, 0.0)
  const zero = new THREE.Color(0, 0, 0)

  group.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    const mat = obj.material
    if (Array.isArray(mat)) return
    const m = mat as THREE.MeshStandardMaterial
    if (!(m instanceof THREE.MeshStandardMaterial)) return
    if (onFire) {
      m.emissive.copy(fireEmissive)
    } else if (damageLevel > 0.3) {
      m.emissive.copy(damageEmissive).multiplyScalar(damageLevel)
    } else {
      m.emissive.copy(zero)
    }
  })
}

// ── Gear animation ──────────────────────────────────────────────────────────

/**
 * Animate landing gear retraction/deployment.
 * t = 0 → fully retracted (hidden), t = 1 → fully deployed (normal position).
 * Call each frame with a smoothly changing t value.
 */
export function setGearAnimT(group: THREE.Group, t: number): void {
  const gear = group.getObjectByName('gear-group')
  if (!gear) return
  gear.visible = t > 0.02
  // Raise the gear group upward when retracting so it disappears into the fuselage.
  gear.position.y = (1 - t) * 1.8
}

// ── Store mesh builder ──────────────────────────────────────────────────────

import type { WeaponCategory } from '../types/aircraft'

/**
 * Build a simple recognisable store mesh for the given weapon category.
 * The long axis of the store runs along +X (forward), same as aircraft fuselage.
 * Returns null for EMPTY / GUN_POD (gun pod stays internal for now).
 */
export function buildStoreMesh(category: WeaponCategory): THREE.Group | null {
  const g = new THREE.Group()
  switch (category) {
    case 'IR_MISSILE': {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5, roughness: 0.5 })
      const noseMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 })
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.2, 8), bodyMat)
      body.rotation.z = -Math.PI / 2
      body.castShadow = true
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 8), noseMat)
      nose.rotation.z = -Math.PI / 2
      nose.position.x = 1.35
      nose.castShadow = true
      // Tail fins
      const finMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.4, roughness: 0.6 })
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.016, 0.28), finMat)
        fin.rotation.x = i * (Math.PI / 2)
        fin.position.x = -0.85
        g.add(fin)
      }
      g.add(body, nose)
      break
    }
    case 'ARH_MISSILE': {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xbbbbcc, metalness: 0.5, roughness: 0.5 })
      const noseMat = new THREE.MeshStandardMaterial({ color: 0x334488, metalness: 0.6, roughness: 0.4 })
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 2.8, 8), bodyMat)
      body.rotation.z = -Math.PI / 2
      body.castShadow = true
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.55, 8), noseMat)
      nose.rotation.z = -Math.PI / 2
      nose.position.x = 1.68
      nose.castShadow = true
      const finMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.4, roughness: 0.6 })
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.018, 0.32), finMat)
        fin.rotation.x = i * (Math.PI / 2)
        fin.position.x = -1.1
        g.add(fin)
      }
      g.add(body, nose)
      break
    }
    case 'AGM_MISSILE': {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x556644, metalness: 0.35, roughness: 0.7 })
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 3.5, 8), bodyMat)
      body.rotation.z = -Math.PI / 2
      body.castShadow = true
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 8),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 }))
      nose.rotation.z = -Math.PI / 2
      nose.position.x = 2.1
      nose.castShadow = true
      g.add(body, nose)
      break
    }
    case 'LGB':
    case 'BOMB': {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334433, metalness: 0.3, roughness: 0.75 })
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.8, 8), bodyMat)
      body.rotation.z = -Math.PI / 2
      body.castShadow = true
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), bodyMat)
      nose.rotation.z = -Math.PI / 2
      nose.position.x = 1.7
      nose.castShadow = true
      // Tail fin group
      const finMat = new THREE.MeshStandardMaterial({ color: 0x556655, metalness: 0.3, roughness: 0.7 })
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.015, 0.35), finMat)
        fin.rotation.x = i * (Math.PI / 2)
        fin.position.x = -1.1
        g.add(fin)
      }
      g.add(body, nose)
      break
    }
    case 'FUEL_TANK': {
      const mat = new THREE.MeshStandardMaterial({ color: 0x999988, metalness: 0.4, roughness: 0.6 })
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.5, 10), mat)
      body.rotation.z = -Math.PI / 2
      body.castShadow = true
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 10), mat)
      nose.rotation.z = -Math.PI / 2
      nose.position.x = 2.65
      nose.castShadow = true
      g.add(body, nose)
      break
    }
    case 'GUN_POD': {
      const mat = new THREE.MeshStandardMaterial({ color: 0x445544, metalness: 0.4, roughness: 0.65 })
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.35), mat)
      body.castShadow = true
      g.add(body)
      break
    }
    case 'EMPTY':
    default:
      return null
  }
  return g
}

// ── Distant LOD mesh ────────────────────────────────────────────────────────

/**
 * Simplified aircraft silhouette for LOD beyond ~5 km.
 * Per-type shapes preserve twin-tail, single-tail, and wide-body distinctions.
 */
export function buildDistantAircraftMesh(aircraftId: string, nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const baseColor = nation === 'USA' ? 0x5a6678 : 0x778866
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor, metalness: 0.2, roughness: 0.8, emissive: 0x000000,
  })

  const isFlanker = aircraftId === 'su27' || aircraftId === 'su35' || aircraftId === 'su57'
  const isStealth = aircraftId === 'f22' || aircraftId === 'f35a' || aircraftId === 'su57'
  const isSingleTail = aircraftId === 'f16c'
  const isWideTwin = aircraftId === 'mig29' || aircraftId === 'su57'

  const fuseLen = isFlanker ? 11 : isStealth && aircraftId !== 'f35a' ? 10.5 : 9
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(fuseLen, 0.7, isWideTwin ? 1.1 : 0.9), mat)
  fuse.castShadow = true
  g.add(fuse)

  const wingSpan = isFlanker ? 9.0 : aircraftId === 'f22' ? 8.5 : 7.5
  const wingSweep = isStealth ? 1.2 : 0.5
  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, wingSpan), mat)
  wing.position.set(wingSweep, -0.05, 0)
  wing.castShadow = true
  g.add(wing)

  if (isSingleTail) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.12), mat)
    tail.position.set(-fuseLen / 2 + 0.8, 0.65, 0)
    tail.castShadow = true
    g.add(tail)
  } else {
    const tailSpacing = isWideTwin ? 0.55 : 0.35
    for (const side of [1, -1] as const) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.12), mat)
      tail.position.set(-fuseLen / 2 + 0.8, 0.55, side * tailSpacing)
      if (aircraftId === 'fa18c' || aircraftId === 'f22' || aircraftId === 'f35a') {
        tail.rotation.x = side * 0.3
      }
      tail.castShadow = true
      g.add(tail)
    }
  }

  g.rotation.y = Math.PI / 2
  return g
}
