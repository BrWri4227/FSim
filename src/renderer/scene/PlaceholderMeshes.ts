import * as THREE from 'three'

// Per-aircraft procedural geometry. Fuselage nose points along local +X.
// Aircraft.ts updateMesh applies a +90° Y quaternion bias to align with world -Z (NED North).
// Each aircraft has a distinctive silhouette matching the real-world type.

// ── Material helpers ────────────────────────────────────────────────────────

function bm(color: number, shininess = 30): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({ color, specular: 0x555555, shininess })
}
function canopyMat(): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color: 0x1a2f3a, specular: 0x88aacc, shininess: 80,
    transparent: true, opacity: 0.65
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
  const baseMat = (m instanceof THREE.MeshPhongMaterial)
    ? m.clone()
    : new THREE.MeshPhongMaterial({ color: 0x777777, side: THREE.DoubleSide })
  if (baseMat instanceof THREE.MeshPhongMaterial) baseMat.side = THREE.DoubleSide

  const mesh = new THREE.Mesh(
    wingGeom(rootChord, tipChord, semiSpan, sweepBack, thickness),
    baseMat
  )
  mesh.position.set(x, y, side > 0 ? rootOffsetZ : -rootOffsetZ)
  if (side < 0) mesh.scale.z = -1
  g.add(mesh)
  return mesh
}

function addCanopy(g: THREE.Group, x: number, y: number): void {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    canopyMat()
  )
  mesh.position.set(x, y, 0)
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
  const fm = new THREE.MeshPhongMaterial({ color: 0x556677, shininess: 20, side: THREE.DoubleSide })
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
  const gm = new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 20 })
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

/** Place the invisible nozzle Object3D (average of provided positions). */
function placeNozzle(g: THREE.Group, positions: [number, number, number][]): void {
  const n = positions.length
  const cx = positions.reduce((s, p) => s + p[0], 0) / n
  const cy = positions.reduce((s, p) => s + p[1], 0) / n
  const cz = positions.reduce((s, p) => s + p[2], 0) / n
  const nozzle = new THREE.Object3D()
  nozzle.name = 'nozzle'
  nozzle.position.set(cx, cy, cz)
  g.add(nozzle)
}

// ── F-15C Eagle ─────────────────────────────────────────────────────────────
// Twin engine, twin upright vertical tails, massive cheek intakes, large trapezoidal wings.
function buildF15C(): THREE.Group {
  const g = new THREE.Group()
  const C = 0x7799bb  // steel blue-grey
  const Cw = C - 0x0f0f10
  const Cd = C - 0x1f1f20
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)

  // Fuselage body
  addBox(g, fm, 10.0, 1.1, 1.3, 0, 0, 0)
  // Nose cone (long, faceted)
  addCylX(g, fm, 0, 0.55, 2.8, 6.4, 0, 0, 6)

  // Canopy (raised, behind nose)
  addCanopy(g, 3.3, 0.57)

  // Cheek intakes — large rectangular boxes on each side of fuselage
  addBox(g, dm, 3.0, 0.65, 0.7, 1.5, -0.18, 1.1)
  addBox(g, dm, 3.0, 0.65, 0.7, 1.5, -0.18, -1.1)

  // Main wings — trapezoidal planform with root attached to fuselage shoulder.
  addWing(g, wm, 1, 2.0, -0.28, 0.74, 4.4, 1.7, 3.7, 1.0, 0.12)
  addWing(g, wm, -1, 2.0, -0.28, 0.74, 4.4, 1.7, 3.7, 1.0, 0.12)

  // Twin upright vertical stabilizers (close together, slight toe-in)
  addBox(g, wm, 2.2, 2.0, 0.13, -3.8, 1.0, 0.75, 0.05)
  addBox(g, wm, 2.2, 2.0, 0.13, -3.8, 1.0, -0.75, -0.05)

  // Horizontal stabilators (all-moving, wide)
  addBox(g, wm, 2.0, 0.10, 2.5, -4.5, -0.22, 2.1)
  addBox(g, wm, 2.0, 0.10, 2.5, -4.5, -0.22, -2.1)

  // Engine nacelles (twin, round cross-section)
  addCylX(g, bm(Cd), 0.42, 0.52, 4.5, -3.0, -0.05, 0.55)
  addCylX(g, bm(Cd), 0.42, 0.52, 4.5, -3.0, -0.05, -0.55)

  addFlapsGroup(g, 0.0, 0.8, 2.0, 1.2, -0.28)
  addGearGroup(g, 4.0, 1.0, 1.0, -0.55, 0.5, 0.22)
  placeNozzle(g, [[-5.4, -0.05, 0.55], [-5.4, -0.05, -0.55]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── F-16C Fighting Falcon ───────────────────────────────────────────────────
// Single engine, single tall vertical tail, chin intake, cropped-delta wing, bubble canopy.
function buildF16C(): THREE.Group {
  const g = new THREE.Group()
  const C = 0x6688aa  // medium grey-blue
  const Cw = C - 0x101010
  const Cd = C - 0x1a1a1a
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)

  // Slim fuselage
  addBox(g, fm, 9.0, 0.9, 1.05, 0, 0, 0)
  // Long sharp nose
  addCylX(g, fm, 0, 0.45, 3.2, 6.1, 0.0, 0, 6)

  // Bubble canopy (very prominent, full bubble style)
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.50, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
    canopyMat()
  )
  canopy.position.set(2.9, 0.42, 0)
  g.add(canopy)

  // Chin intake (below-centre, forward of wing)
  addBox(g, dm, 2.2, 0.52, 0.85, 1.2, -0.58, 0)

  // Cropped-delta wings with pronounced root and short tip chord.
  addWing(g, wm, 1, 1.6, -0.26, 0.58, 4.0, 1.0, 3.2, 1.25, 0.11)
  addWing(g, wm, -1, 1.6, -0.26, 0.58, 4.0, 1.0, 3.2, 1.25, 0.11)

  // Single tall vertical stabilizer (with slight taper)
  addBox(g, wm, 2.4, 2.1, 0.13, -3.6, 1.05, 0)

  // Small delta-ish horizontal stabs
  addBox(g, wm, 1.5, 0.09, 1.8, -4.2, -0.22, 1.6)
  addBox(g, wm, 1.5, 0.09, 1.8, -4.2, -0.22, -1.6)

  // Single engine nacelle
  addCylX(g, dm, 0.38, 0.48, 4.0, -2.8, 0.0, 0)

  addFlapsGroup(g, 0.2, 0.65, 1.8, 1.0, -0.26)
  addGearGroup(g, 3.5, 1.0, 0.9, -0.45, 0.5, 0.20)
  placeNozzle(g, [[-5.0, 0.0, 0]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── F/A-18C Hornet ──────────────────────────────────────────────────────────
// Twin engines, prominent LEX, twin OUTWARD-canted vertical tails, trapezoidal wings.
function buildFA18C(): THREE.Group {
  const g = new THREE.Group()
  const C = 0x556677  // darker blue-grey
  const Cw = C - 0x0e0e0e
  const Cd = C - 0x1a1a1a
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)

  // Fuselage
  addBox(g, fm, 9.5, 1.0, 1.25, 0, 0, 0)
  addCylX(g, fm, 0, 0.50, 2.8, 6.15, 0, 0, 6)

  addCanopy(g, 3.0, 0.56)

  // LEX — large, sweeping leading-edge root extensions (defining feature)
  addBox(g, bm(C - 0x08080a), 4.2, 0.18, 1.4, 1.8, -0.10, 1.55, -0.12)
  addBox(g, bm(C - 0x08080a), 4.2, 0.18, 1.4, 1.8, -0.10, -1.55, 0.12)

  // Intakes (twin, behind LEX leading edge, underneath)
  addBox(g, dm, 2.0, 0.55, 0.65, 1.0, -0.48, 1.05)
  addBox(g, dm, 2.0, 0.55, 0.65, 1.0, -0.48, -1.05)

  // Hornet wing with moderate sweep and clipped tip.
  addWing(g, wm, 1, 1.5, -0.28, 0.64, 3.9, 1.6, 3.5, 0.95, 0.11)
  addWing(g, wm, -1, 1.5, -0.28, 0.64, 3.9, 1.6, 3.5, 0.95, 0.11)

  // Twin vertical stabilizers canted OUTWARD ~20° (key Hornet identifier)
  const vstabMesh1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 0.13), wm)
  vstabMesh1.position.set(-3.6, 0.85, 0.68)
  vstabMesh1.rotation.x = 0.36  // ~20° outward cant
  g.add(vstabMesh1)
  const vstabMesh2 = vstabMesh1.clone()
  vstabMesh2.position.z = -0.68
  vstabMesh2.rotation.x = -0.36
  g.add(vstabMesh2)

  // Horizontal stabilators
  addBox(g, wm, 1.8, 0.10, 2.2, -4.2, -0.20, 2.0)
  addBox(g, wm, 1.8, 0.10, 2.2, -4.2, -0.20, -2.0)

  // Twin engine nacelles
  addCylX(g, dm, 0.38, 0.46, 3.8, -3.0, -0.05, 0.52)
  addCylX(g, dm, 0.38, 0.46, 3.8, -3.0, -0.05, -0.52)

  addFlapsGroup(g, 0.0, 0.7, 1.9, 1.1, -0.28)
  addGearGroup(g, 3.5, 0.5, 0.9, -0.50, 0.5, 0.21)
  placeNozzle(g, [[-5.1, -0.05, 0.52], [-5.1, -0.05, -0.52]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── MiG-29 Fulcrum ──────────────────────────────────────────────────────────
// Wide body with clearly separated twin engines, huge triangular LEX, underside ramp intakes.
function buildMiG29(): THREE.Group {
  const g = new THREE.Group()
  const C = 0x887766  // sandy camouflage
  const Cw = C - 0x0f0f0e
  const Cd = C - 0x1a1a18
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)

  // Wide fuselage body
  addBox(g, fm, 9.5, 1.05, 1.55, 0, 0, 0)
  addCylX(g, fm, 0, 0.52, 2.5, 6.0, 0.0, 0, 6)

  addCanopy(g, 3.1, 0.57)

  // Very large triangular LEX blending into the nose (key Fulcrum feature)
  addBox(g, bm(C - 0x080808), 5.0, 0.20, 1.7, 1.5, 0.05, 1.7, -0.15)
  addBox(g, bm(C - 0x080808), 5.0, 0.20, 1.7, 1.5, 0.05, -1.7, 0.15)

  // Underslung ramp intakes (open rectangular face, characteristic MiG-29 look)
  addBox(g, dm, 2.8, 0.7, 0.85, 1.8, -0.58, 1.0)
  addBox(g, dm, 2.8, 0.7, 0.85, 1.8, -0.58, -1.0)

  // Fulcrum broad trapezoid wings blended from pronounced LEX roots.
  addWing(g, wm, 1, 2.0, -0.28, 0.78, 4.2, 1.6, 3.9, 0.95, 0.12)
  addWing(g, wm, -1, 2.0, -0.28, 0.78, 4.2, 1.6, 3.9, 0.95, 0.12)

  // Twin vertical stabilizers (slightly canted outward)
  addBox(g, wm, 2.2, 2.0, 0.13, -3.8, 1.0, 0.72, 0.07)
  addBox(g, wm, 2.2, 2.0, 0.13, -3.8, 1.0, -0.72, -0.07)

  // Horizontal stabilators
  addBox(g, wm, 2.0, 0.10, 2.4, -4.3, -0.22, 2.0)
  addBox(g, wm, 2.0, 0.10, 2.4, -4.3, -0.22, -2.0)

  // Twin engine nacelles (widely spaced — visible gap between them)
  addCylX(g, dm, 0.42, 0.52, 4.8, -3.0, 0.0, 0.65)
  addCylX(g, dm, 0.42, 0.52, 4.8, -3.0, 0.0, -0.65)

  addFlapsGroup(g, 0.2, 0.85, 2.0, 1.2, -0.28)
  addGearGroup(g, 3.8, 0.8, 1.0, -0.525, 0.55, 0.22)
  placeNozzle(g, [[-5.5, 0.0, 0.65], [-5.5, 0.0, -0.65]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Su-27 Flanker ───────────────────────────────────────────────────────────
// Long body with spine hump, huge blended wing-body, very large LEX, twin tails.
function buildSu27(): THREE.Group {
  const g = new THREE.Group()
  const C = 0x998866  // blue-grey camouflage
  const Cw = C - 0x101010
  const Cd = C - 0x1c1c1c
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)

  // Long fuselage
  addBox(g, fm, 12.0, 1.1, 1.5, 0, 0, 0)
  // Avionics/spine hump (the Flanker's distinctive dorsal hump)
  addBox(g, bm(C - 0x0a0a0a), 5.5, 0.5, 0.85, -0.5, 0.65, 0)
  // Long sharp nose
  addCylX(g, fm, 0, 0.55, 3.2, 7.6, 0, 0, 6)

  addCanopy(g, 4.0, 0.57)

  // Very prominent LEX (leading-edge root extensions — defining Flanker feature)
  addBox(g, bm(C - 0x080808), 5.5, 0.20, 2.0, 1.5, -0.05, 2.05, -0.10)
  addBox(g, bm(C - 0x080808), 5.5, 0.20, 2.0, 1.5, -0.05, -2.05, 0.10)

  // Underfuselage intakes (wide, between engine pods)
  addBox(g, dm, 3.0, 0.72, 0.85, 2.0, -0.60, 1.1)
  addBox(g, dm, 3.0, 0.72, 0.85, 2.0, -0.60, -1.1)

  // Flanker large blended wing-body with strong taper and span.
  addWing(g, wm, 1, 2.0, -0.30, 0.82, 5.3, 1.9, 4.6, 1.05, 0.12)
  addWing(g, wm, -1, 2.0, -0.30, 0.82, 5.3, 1.9, 4.6, 1.05, 0.12)

  // Twin vertical stabilizers
  addBox(g, wm, 2.5, 2.2, 0.13, -5.0, 1.1, 0.80, 0.06)
  addBox(g, wm, 2.5, 2.2, 0.13, -5.0, 1.1, -0.80, -0.06)

  // Large all-moving horizontal stabilators
  addBox(g, wm, 2.2, 0.10, 2.8, -5.5, -0.25, 2.3)
  addBox(g, wm, 2.2, 0.10, 2.8, -5.5, -0.25, -2.3)

  // Long engine nacelles (extend well beyond the tail — very distinctive)
  addCylX(g, dm, 0.45, 0.55, 6.0, -3.5, -0.05, 0.72)
  addCylX(g, dm, 0.45, 0.55, 6.0, -3.5, -0.05, -0.72)

  addFlapsGroup(g, -0.2, 1.1, 2.4, 1.4, -0.30)
  addGearGroup(g, 5.0, 0.5, 1.0, -0.55, 0.55, 0.24)
  placeNozzle(g, [[-6.7, -0.05, 0.72], [-6.7, -0.05, -0.72]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Su-35 Flanker-E ─────────────────────────────────────────────────────────
// Su-27 derivative: wider nose chines, larger IRST, thrust-vectoring nozzle bells.
function buildSu35(): THREE.Group {
  const g = new THREE.Group()
  const C = 0x778866  // olive-grey
  const Cw = C - 0x101010
  const Cd = C - 0x1c1c1c
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)

  // Long fuselage (same as Su-27 base)
  addBox(g, fm, 12.0, 1.1, 1.5, 0, 0, 0)
  addBox(g, bm(C - 0x0a0a0a), 5.5, 0.5, 0.85, -0.5, 0.65, 0)
  addCylX(g, fm, 0, 0.55, 3.2, 7.6, 0, 0, 6)

  // Su-35 wider nose chines (IRST sensor on the right)
  addBox(g, bm(Cd), 3.5, 0.18, 0.55, 4.5, 0.0, 0.95)
  addBox(g, bm(Cd), 3.5, 0.18, 0.55, 4.5, 0.0, -0.95)
  // IRST ball (small sphere on nose-right side)
  const irst = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), bm(0x222222, 60))
  irst.position.set(5.5, 0.0, 0.5)
  g.add(irst)

  addCanopy(g, 4.0, 0.57)

  // LEX
  addBox(g, bm(C - 0x080808), 5.5, 0.20, 2.0, 1.5, -0.05, 2.05, -0.10)
  addBox(g, bm(C - 0x080808), 5.5, 0.20, 2.0, 1.5, -0.05, -2.05, 0.10)

  // Intakes
  addBox(g, dm, 3.0, 0.72, 0.85, 2.0, -0.60, 1.1)
  addBox(g, dm, 3.0, 0.72, 0.85, 2.0, -0.60, -1.1)

  // Su-35 wings: similar to Su-27 but slightly refined root/tip taper.
  addWing(g, wm, 1, 2.0, -0.30, 0.82, 5.4, 1.8, 4.7, 1.00, 0.12)
  addWing(g, wm, -1, 2.0, -0.30, 0.82, 5.4, 1.8, 4.7, 1.00, 0.12)

  // Twin vertical stabilizers
  addBox(g, wm, 2.5, 2.2, 0.13, -5.0, 1.1, 0.80, 0.06)
  addBox(g, wm, 2.5, 2.2, 0.13, -5.0, 1.1, -0.80, -0.06)

  // Horizontal stabilators
  addBox(g, wm, 2.2, 0.10, 2.8, -5.5, -0.25, 2.3)
  addBox(g, wm, 2.2, 0.10, 2.8, -5.5, -0.25, -2.3)

  // Engine nacelles with larger TVC nozzle bells
  addCylX(g, dm, 0.45, 0.55, 6.0, -3.5, -0.05, 0.72)
  addCylX(g, dm, 0.45, 0.55, 6.0, -3.5, -0.05, -0.72)
  // TVC nozzle bells (wider at exit)
  addCylX(g, bm(0x333333, 60), 0.52, 0.42, 0.6, -6.8, -0.05, 0.72, 8)
  addCylX(g, bm(0x333333, 60), 0.52, 0.42, 0.6, -6.8, -0.05, -0.72, 8)

  addFlapsGroup(g, -0.2, 1.1, 2.4, 1.4, -0.30)
  addGearGroup(g, 5.0, 0.5, 1.0, -0.55, 0.55, 0.24)
  placeNozzle(g, [[-7.0, -0.05, 0.72], [-7.0, -0.05, -0.72]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── F-22A Raptor ────────────────────────────────────────────────────────────
// Diamond wing planform, twin outward-canted tails, DSI bumps, chined nose.
function buildF22(): THREE.Group {
  const g = new THREE.Group()
  const C = 0x4a5568  // low-observable blue-grey
  const Cw = C - 0x0c0c0d
  const Cd = C - 0x181819
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)

  // Blended fuselage — wide, flat-sided stealth shaping
  addBox(g, fm, 11.5, 1.05, 1.45, 0, 0, 0)
  // Chined nose (upper/lower facet meeting at sharp edge)
  addCylX(g, fm, 0, 0.48, 3.0, 7.25, 0.05, 0, 6)
  addBox(g, bm(C - 0x060608), 3.5, 0.12, 0.55, 5.5, 0.18, 0.85)
  addBox(g, bm(C - 0x060608), 3.5, 0.12, 0.55, 5.5, 0.18, -0.85)

  // Bubble canopy (set back, low profile)
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    canopyMat()
  )
  canopy.position.set(3.5, 0.48, 0)
  g.add(canopy)

  // DSI inlet bumps (characteristic F-22/F-35 feature)
  addBox(g, dm, 1.8, 0.55, 0.75, 2.2, -0.12, 1.05)
  addBox(g, dm, 1.8, 0.55, 0.75, 2.2, -0.12, -1.05)

  // Diamond wing — high sweep trapezoid, clipped tips
  addWing(g, wm, 1, 1.8, -0.30, 0.70, 4.8, 1.4, 4.2, 1.35, 0.11)
  addWing(g, wm, -1, 1.8, -0.30, 0.70, 4.8, 1.4, 4.2, 1.35, 0.11)

  // Twin outward-canted vertical tails (~27° from vertical)
  const vL = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.9, 0.12), wm)
  vL.position.set(-4.2, 0.90, 0.62)
  vL.rotation.x = 0.47
  g.add(vL)
  const vR = vL.clone()
  vR.position.z = -0.62
  vR.rotation.x = -0.47
  g.add(vR)

  // All-moving horizontal stabilators (canted to match tails)
  addBox(g, wm, 1.6, 0.09, 2.2, -4.8, -0.18, 1.95)
  addBox(g, wm, 1.6, 0.09, 2.2, -4.8, -0.18, -1.95)

  // Twin engine nacelles (integrated, rectangular 2D TVC nozzle exits)
  addCylX(g, dm, 0.40, 0.48, 4.2, -3.2, -0.08, 0.58)
  addCylX(g, dm, 0.40, 0.48, 4.2, -3.2, -0.08, -0.58)
  // Rectangular nozzle exits (F-22 2D thrust vectoring)
  addBox(g, bm(0x333333, 60), 0.15, 0.55, 0.55, -5.5, -0.08, 0.58)
  addBox(g, bm(0x333333, 60), 0.15, 0.55, 0.55, -5.5, -0.08, -0.58)

  addFlapsGroup(g, 0.0, 0.75, 2.0, 1.1, -0.30)
  addGearGroup(g, 4.5, 0.8, 1.0, -0.52, 0.52, 0.22)
  placeNozzle(g, [[-5.6, -0.08, 0.58], [-5.6, -0.08, -0.58]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── F-35A Lightning II ─────────────────────────────────────────────────────
// Single engine, thick fuselage, DSI bumps, inward-canted twin tails, wide canopy.
function buildF35A(): THREE.Group {
  const g = new THREE.Group()
  const C = 0x5a6678  // medium stealth grey
  const Cw = C - 0x0d0d0e
  const Cd = C - 0x1a1a1b
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)

  // Thick mid-fuselage (JSF's distinctive barrel shape)
  addBox(g, fm, 9.5, 1.15, 1.35, 0, 0, 0)
  // Dorsal chine running from nose (key F-35 identifier)
  addBox(g, bm(C - 0x050507), 7.0, 0.22, 0.70, 1.5, 0.42, 0)
  // Chined nose
  addCylX(g, fm, 0, 0.46, 2.6, 6.05, 0.08, 0, 6)

  // Large single-piece visor canopy (very prominent on F-35)
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
    canopyMat()
  )
  canopy.position.set(2.8, 0.52, 0)
  g.add(canopy)

  // DSI inlet bumps
  addBox(g, dm, 1.6, 0.50, 0.70, 1.8, -0.15, 0.95)
  addBox(g, dm, 1.6, 0.50, 0.70, 1.8, -0.15, -0.95)

  // Moderate sweep trapezoidal wings (smaller than F-22)
  addWing(g, wm, 1, 1.4, -0.26, 0.58, 3.5, 1.2, 3.0, 0.90, 0.10)
  addWing(g, wm, -1, 1.4, -0.26, 0.58, 3.5, 1.2, 3.0, 0.90, 0.10)

  // Twin outward-canted tails (smaller, closer together than F-22)
  const vL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 0.11), wm)
  vL.position.set(-3.8, 0.78, 0.52)
  vL.rotation.x = 0.40
  g.add(vL)
  const vR = vL.clone()
  vR.position.z = -0.52
  vR.rotation.x = -0.40
  g.add(vR)

  // Horizontal stabilators
  addBox(g, wm, 1.4, 0.08, 1.8, -4.3, -0.20, 1.65)
  addBox(g, wm, 1.4, 0.08, 1.8, -4.3, -0.20, -1.65)

  // Single engine nacelle with stealthy serrated nozzle
  addCylX(g, dm, 0.38, 0.46, 3.8, -2.8, -0.05, 0)
  addBox(g, bm(0x333333, 60), 0.12, 0.50, 0.50, -4.9, -0.05, 0)

  addFlapsGroup(g, 0.2, 0.62, 1.6, 0.95, -0.26)
  addGearGroup(g, 3.8, 0.6, 0.85, -0.57, 0.50, 0.21)
  placeNozzle(g, [[-5.0, -0.05, 0]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Su-57 Felon ─────────────────────────────────────────────────────────────
// Wide-spaced twin engines, angular stealth facets, S-duct intakes, LERX, IRST ball.
function buildSu57(): THREE.Group {
  const g = new THREE.Group()
  const C = 0x6a7068  // blue-grey camouflage
  const Cw = C - 0x101010
  const Cd = C - 0x1c1c1c
  const fm = bm(C), wm = bm(Cw), dm = bm(Cd)

  // Long angular fuselage with flat facet sides
  addBox(g, fm, 12.5, 1.05, 1.40, 0, 0, 0)
  // Flat upper fuselage facet (stealth shaping)
  addBox(g, bm(C - 0x080808), 8.0, 0.35, 1.20, 0.5, 0.55, 0)
  // Sharp chined nose
  addCylX(g, fm, 0, 0.50, 3.0, 7.75, 0.05, 0, 6)
  // Nose chines (angular stealth edges)
  addBox(g, bm(Cd), 3.8, 0.16, 0.50, 5.0, 0.05, 0.90)
  addBox(g, bm(Cd), 3.8, 0.16, 0.50, 5.0, 0.05, -0.90)
  // IRST ball (offset to starboard — Su-57 signature)
  const irst = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), bm(0x222222, 60))
  irst.position.set(5.8, 0.05, 0.45)
  g.add(irst)

  addCanopy(g, 4.2, 0.56)

  // Large LERX blending into wing roots
  addBox(g, bm(C - 0x070707), 5.0, 0.18, 1.85, 1.5, -0.02, 1.90, -0.12)
  addBox(g, bm(C - 0x070707), 5.0, 0.18, 1.85, 1.5, -0.02, -1.90, 0.12)

  // S-duct intake openings (under wing root, angled)
  addBox(g, dm, 2.5, 0.65, 0.80, 2.2, -0.55, 1.15)
  addBox(g, dm, 2.5, 0.65, 0.80, 2.2, -0.55, -1.15)

  // Large trapezoidal wings with moderate sweep
  addWing(g, wm, 1, 2.0, -0.28, 0.80, 5.2, 1.7, 4.5, 1.05, 0.11)
  addWing(g, wm, -1, 2.0, -0.28, 0.80, 5.2, 1.7, 4.5, 1.05, 0.11)

  // Smaller canted vertical tails (vs Su-27 — stealth-optimised)
  addBox(g, wm, 2.0, 1.8, 0.12, -4.8, 0.95, 0.68, 0.08)
  addBox(g, wm, 2.0, 1.8, 0.12, -4.8, 0.95, -0.68, -0.08)

  // All-moving horizontal stabilators
  addBox(g, wm, 2.0, 0.09, 2.5, -5.3, -0.22, 2.15)
  addBox(g, wm, 2.0, 0.09, 2.5, -5.3, -0.22, -2.15)

  // Widely spaced engine nacelles — visible gap between them (Su-57 signature)
  addCylX(g, dm, 0.42, 0.50, 5.5, -3.3, -0.05, 0.85)
  addCylX(g, dm, 0.42, 0.50, 5.5, -3.3, -0.05, -0.85)
  // 3D thrust-vectoring nozzle bells
  addCylX(g, bm(0x333333, 60), 0.50, 0.40, 0.55, -6.2, -0.05, 0.85, 8)
  addCylX(g, bm(0x333333, 60), 0.50, 0.40, 0.55, -6.2, -0.05, -0.85, 8)

  addFlapsGroup(g, -0.1, 1.0, 2.2, 1.3, -0.28)
  addGearGroup(g, 5.2, 0.5, 1.05, -0.52, 0.55, 0.23)
  placeNozzle(g, [[-6.4, -0.05, 0.85], [-6.4, -0.05, -0.85]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Fallback generic jet ────────────────────────────────────────────────────

function buildGeneric(nation: 'USA' | 'RUS'): THREE.Group {
  const g = new THREE.Group()
  const C = nation === 'USA' ? 0x6688aa : 0x887766
  const fm = bm(C), wm = bm(C - 0x111111)

  addBox(g, fm, 8.0, 1.0, 1.2)
  addCylX(g, fm, 0, 0.5, 2.0, 5.0)
  addCanopy(g, 2.8, 0.55)
  addWing(g, wm, 1, 1.5, -0.20, 0.62, 2.4, 1.0, 2.6, 0.8, 0.13)
  addWing(g, wm, -1, 1.5, -0.20, 0.62, 2.4, 1.0, 2.6, 0.8, 0.13)
  addBox(g, wm, 0.9, 0.12, 3.2, -3.5, 0.0)
  addBox(g, wm, 0.9, 1.4, 0.13, -3.5, 0.6)

  addFlapsGroup(g, 0.0, 0.65, 1.4, 0.9, -0.20)
  addGearGroup(g, 3.0, 0.5, 0.8, -0.50, 0.5, 0.20)
  placeNozzle(g, [[-4.1, 0.0, 0.0]])
  g.rotation.y = Math.PI / 2
  return g
}

// ── Public API ──────────────────────────────────────────────────────────────

export function createPlaceholderAircraftMesh(aircraftId: string, nation: 'USA' | 'RUS'): THREE.Group {
  switch (aircraftId) {
    case 'f15c':  return buildF15C()
    case 'f16c':  return buildF16C()
    case 'fa18c': return buildFA18C()
    case 'mig29': return buildMiG29()
    case 'su27':  return buildSu27()
    case 'su35':  return buildSu35()
    case 'f22':   return buildF22()
    case 'f35a':  return buildF35A()
    case 'su57':  return buildSu57()
    default:      return buildGeneric(nation)
  }
}

export function createNozzlePoint(group: THREE.Group): THREE.Object3D {
  return group.getObjectByName('nozzle') ?? group
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
  const fireEmissive = new THREE.Color(0.6, 0.15, 0.0)
  const damageEmissive = new THREE.Color(0.25, 0.05, 0.0)
  const zero = new THREE.Color(0, 0, 0)

  group.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    const mat = obj.material
    if (Array.isArray(mat)) return
    const m = mat as THREE.MeshPhongMaterial
    if (!('emissive' in m)) return
    if (onFire) {
      m.emissive.copy(fireEmissive)
    } else if (damageLevel > 0.3) {
      m.emissive.copy(damageEmissive).multiplyScalar(damageLevel)
    } else {
      m.emissive.copy(zero)
    }
  })
}
