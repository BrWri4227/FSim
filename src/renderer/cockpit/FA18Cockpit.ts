import * as THREE from 'three'
import { clamp } from '../utils/MathUtils'

/**
 * Detailed F/A-18 cockpit interior built from primitive geometry.
 *
 * Modeled in the CockpitCamera body frame (no mesh bias): forward = local −Z,
 * right = +X, up = +Y. The raw model is authored with its origin on the cockpit
 * floor; the whole assembly is shifted by −EYE inside {@link root} so the pilot's
 * eye point ends up at the group origin (which {@link CockpitController} pins to
 * the aircraft eye each frame).
 *
 * The control stick and throttle are parented to dedicated pivot groups so they
 * can be animated from live control inputs via {@link setControls}.
 */
export class FA18Cockpit extends THREE.Group {
  /**
   * Pilot eye point in raw model (floor-origin) coordinates. Y sits just above
   * the glareshield (MainInstrumentPanel top ≈ 1.40) so the forward view clears
   * the coaming and the HUD reticle rather than looking into the panel.
   */
  private static readonly EYE = new THREE.Vector3(0, 1.45, 0.42)

  private static readonly STICK_BASE = new THREE.Vector3(0.25, 0.34, -0.2)
  private static readonly THROTTLE_PIVOT = new THREE.Vector3(-0.53, 0.72, 0.2)

  /** Max stick deflection each axis (rad). */
  private static readonly STICK_PITCH_RANGE = 0.22
  private static readonly STICK_ROLL_RANGE = 0.24
  /** Total throttle lever swing from idle (aft) to max (forward), rad. */
  private static readonly THROTTLE_RANGE = 0.5

  /** Holds all structure, translated by −EYE so the eye sits at the origin. */
  private readonly root = new THREE.Group()
  private readonly stickPivot = new THREE.Group()
  private readonly throttlePivot = new THREE.Group()

  /** MFD display quads wired by the CockpitController (canvas textures). */
  readonly mfdLeft: THREE.Mesh
  readonly mfdRight: THREE.Mesh

  // Smoothed animation state (0..1 throttle, −1..1 stick axes).
  private animPitch = 0
  private animRoll = 0
  private animThrottle = 0.3

  private readonly materials = {
    cockpit: new THREE.MeshStandardMaterial({ color: 0x25282a, emissive: 0x090a0b, roughness: 0.82, metalness: 0.08 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x111315, emissive: 0x050506, roughness: 0.9, metalness: 0.05 }),
    screenFrame: new THREE.MeshStandardMaterial({ color: 0x171a1c, roughness: 0.72, metalness: 0.15 }),
    button: new THREE.MeshStandardMaterial({ color: 0x3a3d3e, roughness: 0.8 }),
    redButton: new THREE.MeshStandardMaterial({ color: 0x8c1717, emissive: 0x350707, roughness: 0.65 }),
    greenButton: new THREE.MeshStandardMaterial({ color: 0x175c2b, emissive: 0x07230f, roughness: 0.65 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x303533, roughness: 0.95 }),
    cushion: new THREE.MeshStandardMaterial({ color: 0x48503f, roughness: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x5d6264, roughness: 0.45, metalness: 0.65 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.85, metalness: 0.1 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x91d6d8, transparent: true, opacity: 0.18, roughness: 0.08, metalness: 0,
      transmission: 0.55, depthWrite: false, side: THREE.DoubleSide,
    }),
    warning: new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0xff6a00, emissiveIntensity: 0.35, roughness: 0.55 }),
  }

  constructor() {
    super()
    this.name = 'FA18Cockpit'

    this.root.position.copy(FA18Cockpit.EYE).multiplyScalar(-1)
    this.add(this.root)

    this.stickPivot.position.copy(FA18Cockpit.STICK_BASE)
    this.throttlePivot.position.copy(FA18Cockpit.THROTTLE_PIVOT)
    this.root.add(this.stickPivot, this.throttlePivot)

    this.createCockpitTub()
    this.createSeat()
    this.createMainInstrumentPanel()
    this.createSideConsoles()
    this.createControlStick()
    this.createThrottle()
    this.createRudderPedals()
    this.createCanopyFrame()
    this.createCanopyGlass()
    this.createRearDeck()

    this.mfdLeft = this.createMFD('mfd_left', -0.36, 1.03, -0.98, 0.38, 0.33)
    this.mfdRight = this.createMFD('mfd_right', 0.36, 1.03, -0.98, 0.38, 0.33)
    this.createMFD('mfd_center', 0, 0.68, -1.08, 0.39, 0.29)

    this.setControls(0, 0, 0.3)
  }

  /**
   * Drive the stick and throttle animation from live control inputs.
   * @param pitch −1 (push / nose down) .. +1 (pull / nose up)
   * @param roll  −1 (left) .. +1 (right)
   * @param throttle 0 (idle) .. 1 (max / afterburner)
   */
  setControls(pitch: number, roll: number, throttle: number): void {
    // Inputs are already smoothed upstream, but ease a little more so keyboard
    // throttle steps and axis snaps read as physical lever/stick motion.
    const k = 0.25
    this.animPitch += (clamp(pitch, -1, 1) - this.animPitch) * k
    this.animRoll += (clamp(roll, -1, 1) - this.animRoll) * k
    this.animThrottle += (clamp(throttle, 0, 1) - this.animThrottle) * k

    // Pull back (pitch +) tilts the grip toward the pilot (+Z) → +rotation.x.
    this.stickPivot.rotation.x = this.animPitch * FA18Cockpit.STICK_PITCH_RANGE
    // Roll right tips the grip toward +X → −rotation.z.
    this.stickPivot.rotation.z = -this.animRoll * FA18Cockpit.STICK_ROLL_RANGE
    // Idle sits aft (+rotation.x), full power swings the levers forward (−).
    this.throttlePivot.rotation.x = (0.5 - this.animThrottle) * FA18Cockpit.THROTTLE_RANGE
  }

  private box(
    parent: THREE.Object3D,
    name: string,
    size: THREE.Vector3,
    position: THREE.Vector3,
    material: THREE.Material,
    rotation = new THREE.Euler(),
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material)
    mesh.name = name
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  private cylinder(
    parent: THREE.Object3D,
    name: string,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    position: THREE.Vector3,
    material: THREE.Material,
    rotation = new THREE.Euler(),
    radialSegments = 16,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
      material,
    )
    mesh.name = name
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  private createCockpitTub(): void {
    this.box(this.root, 'CockpitFloor', new THREE.Vector3(1.3, 0.1, 2.9), new THREE.Vector3(0, 0.05, 0.1), this.materials.cockpit)
    this.box(this.root, 'LeftWall', new THREE.Vector3(0.12, 0.92, 2.75), new THREE.Vector3(-0.71, 0.47, 0.05), this.materials.cockpit, new THREE.Euler(0, 0, -0.05))
    this.box(this.root, 'RightWall', new THREE.Vector3(0.12, 0.92, 2.75), new THREE.Vector3(0.71, 0.47, 0.05), this.materials.cockpit, new THREE.Euler(0, 0, 0.05))
    this.box(this.root, 'FrontBulkhead', new THREE.Vector3(1.32, 0.95, 0.12), new THREE.Vector3(0, 0.47, -1.34), this.materials.cockpit)
    this.box(this.root, 'RearBulkhead', new THREE.Vector3(1.32, 1.1, 0.12), new THREE.Vector3(0, 0.55, 1.42), this.materials.cockpit)
    this.box(this.root, 'LowerKneePanel', new THREE.Vector3(1.02, 0.58, 0.16), new THREE.Vector3(0, 0.52, -1.13), this.materials.panel, new THREE.Euler(-0.32, 0, 0))
  }

  private createSeat(): void {
    this.box(this.root, 'SeatBase', new THREE.Vector3(0.62, 0.16, 0.7), new THREE.Vector3(0, 0.31, 0.48), this.materials.seat, new THREE.Euler(-0.08, 0, 0))
    this.box(this.root, 'SeatBottomCushion', new THREE.Vector3(0.53, 0.11, 0.58), new THREE.Vector3(0, 0.43, 0.45), this.materials.cushion, new THREE.Euler(-0.08, 0, 0))
    this.box(this.root, 'SeatBack', new THREE.Vector3(0.62, 1.02, 0.18), new THREE.Vector3(0, 0.88, 0.88), this.materials.seat, new THREE.Euler(-0.18, 0, 0))
    this.box(this.root, 'BackCushion', new THREE.Vector3(0.5, 0.75, 0.1), new THREE.Vector3(0, 0.84, 0.76), this.materials.cushion, new THREE.Euler(-0.18, 0, 0))
    this.box(this.root, 'Headrest', new THREE.Vector3(0.45, 0.3, 0.25), new THREE.Vector3(0, 1.47, 1.02), this.materials.seat, new THREE.Euler(-0.12, 0, 0))
    this.box(this.root, 'LeftSeatRail', new THREE.Vector3(0.07, 1.2, 0.08), new THREE.Vector3(-0.35, 0.89, 1.04), this.materials.metal, new THREE.Euler(-0.16, 0, 0))
    this.box(this.root, 'RightSeatRail', new THREE.Vector3(0.07, 1.2, 0.08), new THREE.Vector3(0.35, 0.89, 1.04), this.materials.metal, new THREE.Euler(-0.16, 0, 0))
    this.createHarnessStrap(-0.16)
    this.createHarnessStrap(0.16)
    this.box(this.root, 'EjectionHandleLeft', new THREE.Vector3(0.04, 0.04, 0.22), new THREE.Vector3(-0.2, 0.43, 0.04), this.materials.warning, new THREE.Euler(0, 0.35, 0))
    this.box(this.root, 'EjectionHandleRight', new THREE.Vector3(0.04, 0.04, 0.22), new THREE.Vector3(0.2, 0.43, 0.04), this.materials.warning, new THREE.Euler(0, -0.35, 0))
  }

  private createHarnessStrap(x: number): void {
    this.box(this.root, 'HarnessStrap', new THREE.Vector3(0.075, 0.7, 0.025), new THREE.Vector3(x, 1.02, 0.68), this.materials.metal, new THREE.Euler(-0.23, 0, x < 0 ? -0.14 : 0.14))
  }

  private createMainInstrumentPanel(): void {
    this.box(this.root, 'MainInstrumentPanel', new THREE.Vector3(1.14, 0.76, 0.11), new THREE.Vector3(0, 1.02, -0.91), this.materials.panel, new THREE.Euler(-0.11, 0, 0))
    this.createUFC()
    this.createGaugeCluster()
    this.createMasterArmPanel()
  }

  private createMFD(
    name: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
  ): THREE.Mesh {
    const group = new THREE.Group()
    group.name = `${name}_assembly`
    group.position.set(x, y, z)
    group.rotation.x = -0.11
    this.root.add(group)

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.09, height + 0.09, 0.065),
      this.materials.screenFrame,
    )
    group.add(frame)

    // Display quad faces the pilot: PlaneGeometry normal is +Z and the eye sits
    // on the +Z side, so the canvas texture applied by the MFDRenderer reads
    // upright without a mirror flip.
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0x001a0d, side: THREE.DoubleSide }),
    )
    screen.name = name
    screen.position.z = 0.036
    group.add(screen)

    const buttonSize = 0.028
    for (let i = 0; i < 5; i++) {
      const offsetX = -width / 2 + (i / 4) * width
      group.add(this.makeMFDButton(offsetX, height / 2 + 0.055, buttonSize))
      group.add(this.makeMFDButton(offsetX, -height / 2 - 0.055, buttonSize))
    }
    for (let i = 0; i < 4; i++) {
      const offsetY = -height / 2 + (i / 3) * height
      group.add(this.makeMFDButton(-width / 2 - 0.055, offsetY, buttonSize))
      group.add(this.makeMFDButton(width / 2 + 0.055, offsetY, buttonSize))
    }

    return screen
  }

  private makeMFDButton(x: number, y: number, size: number): THREE.Mesh {
    const button = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.025), this.materials.button)
    button.position.set(x, y, 0.045)
    button.castShadow = true
    return button
  }

  private createUFC(): void {
    const group = new THREE.Group()
    group.name = 'UpFrontController'
    group.position.set(0, 1.37, -0.96)
    group.rotation.x = -0.1
    this.root.add(group)

    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.08), this.materials.panel))

    const display = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.055),
      new THREE.MeshBasicMaterial({ color: 0x07321c, side: THREE.DoubleSide }),
    )
    display.position.set(0, 0.04, 0.045)
    group.add(display)

    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 5; column++) {
        const button = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.025), this.materials.button)
        button.position.set(-0.12 + column * 0.06, -0.03 - row * 0.052, 0.05)
        group.add(button)
      }
    }
  }

  private createGaugeCluster(): void {
    const gaugePositions: Array<[number, number]> = [[-0.48, 0.73], [-0.37, 0.71], [0.37, 0.71], [0.48, 0.73]]
    for (const [x, y] of gaugePositions) {
      const bezel = this.cylinder(this.root, 'AnalogGaugeBezel', 0.05, 0.05, 0.025, new THREE.Vector3(x, y, -1.105), this.materials.metal, new THREE.Euler(Math.PI / 2 - 0.11, 0, 0), 24)
      bezel.rotation.z = Math.PI / 2
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.039, 24), this.materials.panel)
      face.position.set(x, y, -1.09)
      face.rotation.set(-0.11, 0, 0)
      this.root.add(face)
    }
  }

  private createMasterArmPanel(): void {
    this.box(this.root, 'MasterArmPanel', new THREE.Vector3(0.18, 0.13, 0.05), new THREE.Vector3(0.49, 1.39, -1.01), this.materials.panel, new THREE.Euler(-0.1, 0, 0))
    this.box(this.root, 'MasterArmSwitch', new THREE.Vector3(0.025, 0.07, 0.025), new THREE.Vector3(0.49, 1.4, -1.05), this.materials.redButton, new THREE.Euler(-0.1, 0, 0.25))
  }

  private createSideConsoles(): void {
    this.createConsole(-1)
    this.createConsole(1)
  }

  private createConsole(side: -1 | 1): void {
    const x = side * 0.54
    this.box(this.root, side === -1 ? 'LeftConsole' : 'RightConsole', new THREE.Vector3(0.31, 0.23, 1.75), new THREE.Vector3(x, 0.52, 0.12), this.materials.panel, new THREE.Euler(0.02, 0, side * -0.05))

    const columns = 4
    const rows = 9
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const z = -0.58 + row * 0.16
        const localX = x + (column - (columns - 1) / 2) * 0.055
        const material =
          (row + column) % 11 === 0 ? this.materials.redButton
            : (row + column) % 7 === 0 ? this.materials.greenButton
              : this.materials.button
        this.box(this.root, 'ConsoleButton', new THREE.Vector3(0.035, 0.025, 0.045), new THREE.Vector3(localX, 0.655, z), material, new THREE.Euler(0, 0, side * -0.05))
      }
    }

    for (let index = 0; index < 5; index++) {
      this.createToggleSwitch(x + (index - 2) * 0.055, 0.69, 0.55 + index * 0.15, side)
    }
  }

  private createToggleSwitch(x: number, y: number, z: number, side: number): void {
    this.cylinder(this.root, 'ToggleSwitchBase', 0.025, 0.025, 0.018, new THREE.Vector3(x, y, z), this.materials.metal, new THREE.Euler(0, 0, Math.PI / 2), 12)
    this.box(this.root, 'ToggleSwitchLever', new THREE.Vector3(0.015, 0.055, 0.015), new THREE.Vector3(x, y + 0.035, z), this.materials.metal, new THREE.Euler(0.2, 0, side * 0.12))
  }

  private createControlStick(): void {
    const base = FA18Cockpit.STICK_BASE
    const rel = (x: number, y: number, z: number): THREE.Vector3 =>
      new THREE.Vector3(x, y, z).sub(base)

    this.cylinder(this.stickPivot, 'ControlStickShaft', 0.035, 0.05, 0.5, rel(0.25, 0.58, -0.2), this.materials.metal, new THREE.Euler(0.15, 0, -0.17), 16)

    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.19, 6, 12), this.materials.grip)
    grip.name = 'ControlStickGrip'
    grip.position.copy(rel(0.19, 0.86, -0.16))
    grip.rotation.set(0.08, 0, -0.16)
    grip.castShadow = true
    this.stickPivot.add(grip)

    this.cylinder(this.stickPivot, 'StickHatSwitch', 0.025, 0.025, 0.025, rel(0.17, 0.97, -0.18), this.materials.button, new THREE.Euler(0, 0, Math.PI / 2), 12)
    this.box(this.stickPivot, 'StickTrigger', new THREE.Vector3(0.022, 0.065, 0.025), rel(0.14, 0.91, -0.22), this.materials.redButton, new THREE.Euler(0.15, 0, -0.16))
  }

  private createThrottle(): void {
    // Static rail stays on the console; only the levers/grips swing.
    this.box(this.root, 'ThrottleTrack', new THREE.Vector3(0.13, 0.07, 0.5), new THREE.Vector3(-0.53, 0.71, 0.05), this.materials.metal)

    const pivot = FA18Cockpit.THROTTLE_PIVOT
    const rel = (x: number, y: number, z: number): THREE.Vector3 =>
      new THREE.Vector3(x, y, z).sub(pivot)

    for (const offsetX of [-0.035, 0.035]) {
      this.box(this.throttlePivot, 'ThrottleLever', new THREE.Vector3(0.045, 0.32, 0.045), rel(-0.53 + offsetX, 0.87, 0.03), this.materials.metal, new THREE.Euler(-0.18, 0, 0))

      const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 5, 10), this.materials.grip)
      grip.name = 'ThrottleGrip'
      grip.position.copy(rel(-0.53 + offsetX, 1.02, -0.02))
      grip.rotation.z = Math.PI / 2
      grip.castShadow = true
      this.throttlePivot.add(grip)
    }
  }

  private createRudderPedals(): void {
    for (const side of [-1, 1]) {
      this.box(this.root, 'RudderPedalArm', new THREE.Vector3(0.045, 0.045, 0.48), new THREE.Vector3(side * 0.22, 0.23, -0.75), this.materials.metal, new THREE.Euler(-0.2, 0, 0))
      this.box(this.root, 'RudderPedal', new THREE.Vector3(0.24, 0.08, 0.17), new THREE.Vector3(side * 0.22, 0.33, -1), this.materials.metal, new THREE.Euler(-0.38, 0, 0))
    }
  }

  private createCanopyFrame(): void {
    const frameCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.67, 0.88, -1.18),
      new THREE.Vector3(-0.63, 1.63, -0.72),
      new THREE.Vector3(-0.48, 2.02, 0.05),
      new THREE.Vector3(-0.42, 1.93, 0.92),
      new THREE.Vector3(-0.53, 1.52, 1.35),
    ])
    const oppositeCurve = new THREE.CatmullRomCurve3(
      frameCurve.points.map(point => new THREE.Vector3(-point.x, point.y, point.z)),
    )
    this.addTube('LeftCanopyRail', frameCurve, 0.035)
    this.addTube('RightCanopyRail', oppositeCurve, 0.035)

    const frontBow = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.67, 0.9, -1.17),
      new THREE.Vector3(-0.48, 1.56, -1.13),
      new THREE.Vector3(0, 1.83, -1.1),
      new THREE.Vector3(0.48, 1.56, -1.13),
      new THREE.Vector3(0.67, 0.9, -1.17),
    ])
    this.addTube('FrontCanopyBow', frontBow, 0.04)

    const rearBow = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.54, 1.49, 1.34),
      new THREE.Vector3(-0.35, 1.93, 1.32),
      new THREE.Vector3(0, 2.05, 1.31),
      new THREE.Vector3(0.35, 1.93, 1.32),
      new THREE.Vector3(0.54, 1.49, 1.34),
    ])
    this.addTube('RearCanopyBow', rearBow, 0.04)
  }

  private addTube(name: string, curve: THREE.Curve<THREE.Vector3>, radius: number): void {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 8, false), this.materials.metal)
    tube.name = name
    tube.castShadow = true
    this.root.add(tube)
  }

  private createCanopyGlass(): void {
    const geometry = new THREE.BufferGeometry()
    const vertices = new Float32Array([
      -0.65, 0.95, -1.12, -0.46, 1.94, -0.55, -0.4, 1.88, 0.92,
      -0.65, 0.95, -1.12, -0.4, 1.88, 0.92, -0.52, 1.5, 1.31,
      0.65, 0.95, -1.12, 0.4, 1.88, 0.92, 0.46, 1.94, -0.55,
      0.65, 0.95, -1.12, 0.52, 1.5, 1.31, 0.4, 1.88, 0.92,
      -0.65, 0.95, -1.12, 0.65, 0.95, -1.12, 0.46, 1.94, -0.55,
      -0.65, 0.95, -1.12, 0.46, 1.94, -0.55, -0.46, 1.94, -0.55,
      -0.46, 1.94, -0.55, 0.46, 1.94, -0.55, 0.4, 1.88, 0.92,
      -0.46, 1.94, -0.55, 0.4, 1.88, 0.92, -0.4, 1.88, 0.92,
    ])
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geometry.computeVertexNormals()

    const glass = new THREE.Mesh(geometry, this.materials.glass)
    glass.name = 'CanopyGlass'
    glass.renderOrder = 2
    this.root.add(glass)
  }

  private createRearDeck(): void {
    this.box(this.root, 'RearAvionicsDeck', new THREE.Vector3(1.05, 0.17, 0.65), new THREE.Vector3(0, 1.32, 1.3), this.materials.cockpit, new THREE.Euler(-0.08, 0, 0))
    for (let index = 0; index < 6; index++) {
      this.box(this.root, 'RearDeckVent', new THREE.Vector3(0.07, 0.012, 0.34), new THREE.Vector3(-0.3 + index * 0.12, 1.415, 1.3), this.materials.panel, new THREE.Euler(-0.08, 0, 0))
    }
  }
}
