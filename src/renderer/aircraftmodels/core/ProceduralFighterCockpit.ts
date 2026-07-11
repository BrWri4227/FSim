import * as THREE from "three";
import type { CockpitConfig } from "./types";
import { v3 } from "./types";

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

/**
 * Pilot eye point in the raw (floor-origin) model frame. The whole interior is
 * shifted by −EYE into {@link root} so the eye lands at the group origin, which
 * CockpitController pins to the aircraft eye each frame (forward = −Z).
 */
const EYE = new THREE.Vector3(0, 1.25, 0.42);

const STICK_PITCH_RANGE = 0.22;
const STICK_ROLL_RANGE = 0.24;
const THROTTLE_RANGE = 0.5;

/**
 * Shared procedural fighter cockpit. Subclasses only supply a {@link CockpitConfig}.
 * The stick (center or side) and throttle lever(s) are parented into pivot groups
 * and driven from live control inputs via {@link setControls}, mirroring the
 * bespoke FA18Cockpit. Two primary MFD faces are always exposed as `mfd_left` /
 * `mfd_right` (unlit MeshBasicMaterial) so the MFDRenderer can bind a canvas map.
 */
export class ProceduralFighterCockpit extends THREE.Group {
  protected readonly config: CockpitConfig;

  private stickPivot: THREE.Group | undefined;
  private throttlePivot: THREE.Group | undefined;
  private animPitch = 0;
  private animRoll = 0;
  private animThrottle = 0.3;

  protected readonly materials = {
    tub: new THREE.MeshStandardMaterial({ color: 0x24282a, roughness: 0.88, metalness: 0.08 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x101315, roughness: 0.9 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1b1f21, roughness: 0.75, metalness: 0.16 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x06130c, emissive: 0x45ff91, emissiveIntensity: 0.22, roughness: 0.25 }),
    button: new THREE.MeshStandardMaterial({ color: 0x404446, roughness: 0.78 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x6a7072, roughness: 0.42, metalness: 0.7 }),
    cushion: new THREE.MeshStandardMaterial({ color: 0x49513f, roughness: 1 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x2c3130, roughness: 0.95 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x78d7d2, transparent: true, opacity: 0.2, roughness: 0.06, transmission: 0.45, depthWrite: false, side: THREE.DoubleSide }),
    hud: new THREE.MeshPhysicalMaterial({ color: 0x61ffad, transparent: true, opacity: 0.25, roughness: 0.04, transmission: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    accent: new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff5a00, emissiveIntensity: 0.35 }),
  };

  constructor(config: CockpitConfig) {
    super();
    this.config = config;
    this.name = `${config.className}Cockpit`;
    this.build();
    this.setupControlsAnimation();
  }

  /**
   * Drive the stick + throttle from live (already-smoothed) control inputs.
   * @param pitch −1 (push / nose down) .. +1 (pull / nose up)
   * @param roll  −1 (left) .. +1 (right)
   * @param throttle 0 (idle) .. 1 (max)
   */
  setControls(pitch: number, roll: number, throttle: number): void {
    const k = 0.25;
    this.animPitch += (clamp(pitch, -1, 1) - this.animPitch) * k;
    this.animRoll += (clamp(roll, -1, 1) - this.animRoll) * k;
    this.animThrottle += (clamp(throttle, 0, 1) - this.animThrottle) * k;

    if (this.stickPivot) {
      // Pull back (pitch +) tips the grip toward the pilot (+Z) → +rotation.x;
      // roll right tips the grip toward +X → −rotation.z. Works for a side stick too.
      this.stickPivot.rotation.x = this.animPitch * STICK_PITCH_RANGE;
      this.stickPivot.rotation.z = -this.animRoll * STICK_ROLL_RANGE;
    }
    if (this.throttlePivot) {
      // Idle sits aft (+rotation.x); full power swings the levers forward (−).
      this.throttlePivot.rotation.x = (0.5 - this.animThrottle) * THROTTLE_RANGE;
    }
  }

  protected addMesh(name: string, g: THREE.BufferGeometry, m: THREE.Material, p = v3(0, 0, 0), r = new THREE.Euler()): THREE.Mesh {
    const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.position.copy(p); mesh.rotation.copy(r); mesh.castShadow = true; mesh.receiveShadow = true; this.add(mesh); return mesh;
  }
  protected box(name: string, s: THREE.Vector3, p: THREE.Vector3, m: THREE.Material, r = new THREE.Euler()): THREE.Mesh { return this.addMesh(name, new THREE.BoxGeometry(s.x, s.y, s.z), m, p, r); }
  protected cylinder(name: string, rt: number, rb: number, h: number, p: THREE.Vector3, m: THREE.Material, r = new THREE.Euler(), seg = 16): THREE.Mesh { return this.addMesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, p, r); }

  protected build(): void {
    this.createTub(); this.createSeat(); this.createMainPanel(); this.createSideConsoles(); this.createControls(); this.createPedals(); if (this.config.hud) this.createHUD(); this.createCanopyFrame();
  }

  protected createTub(): void {
    const c = this.config;
    this.box("CockpitFloor", v3(c.tubWidth, 0.1, c.tubLength), v3(0, 0.05, 0), this.materials.tub);
    this.box("LeftWall", v3(0.11, 0.9, c.tubLength), v3(-c.tubWidth / 2 - 0.03, 0.5, 0), this.materials.tub, new THREE.Euler(0, 0, -0.05));
    this.box("RightWall", v3(0.11, 0.9, c.tubLength), v3(c.tubWidth / 2 + 0.03, 0.5, 0), this.materials.tub, new THREE.Euler(0, 0, 0.05));
    this.box("FrontBulkhead", v3(c.tubWidth, 0.95, 0.11), v3(0, 0.5, -c.tubLength / 2), this.materials.tub);
    this.box("RearBulkhead", v3(c.tubWidth, 1.0, 0.11), v3(0, 0.55, c.tubLength / 2), this.materials.tub);
  }

  protected createSeat(): void {
    this.box("SeatBase", v3(0.62, 0.16, 0.68), v3(0, 0.32, 0.5), this.materials.seat, new THREE.Euler(-0.08, 0, 0));
    this.box("SeatBottomCushion", v3(0.52, 0.1, 0.56), v3(0, 0.44, 0.47), this.materials.cushion, new THREE.Euler(-0.08, 0, 0));
    this.box("SeatBack", v3(0.62, 1.0, 0.18), v3(0, 0.9, 0.88), this.materials.seat, new THREE.Euler(-0.18, 0, 0));
    this.box("BackCushion", v3(0.5, 0.72, 0.1), v3(0, 0.87, 0.76), this.materials.cushion, new THREE.Euler(-0.18, 0, 0));
    this.box("Headrest", v3(0.44, 0.28, 0.24), v3(0, 1.47, 1.02), this.materials.seat, new THREE.Euler(-0.12, 0, 0));
    for (const x of [-0.17, 0.17]) this.box("Harness", v3(0.07, 0.68, 0.025), v3(x, 1.02, 0.68), this.materials.metal, new THREE.Euler(-0.23, 0, x < 0 ? -0.14 : 0.14));
    this.box("EjectionHandle", v3(0.38, 0.04, 0.04), v3(0, 0.42, 0.08), this.materials.accent, new THREE.Euler(0, 0, 0));
  }

  protected createMainPanel(): void {
    const c = this.config;
    const z = -c.tubLength * 0.35;
    this.box("MainPanel", v3(c.tubWidth * 0.86, 0.72, 0.11), v3(0, 1.02, -c.tubLength * 0.32), this.materials.panel, new THREE.Euler(c.panelAngle, 0, 0));

    if (c.screenLayout === "panoramic") {
      // Render the wide panoramic display as two bindable MFD halves.
      const w = c.tubWidth * 0.68;
      const hw = w * 0.49;
      this.createMFDScreen("mfd_left", -w * 0.255, 1.05, z, hw, 0.4, 5, 4);
      this.createMFDScreen("mfd_right", w * 0.255, 1.05, z, hw, 0.4, 5, 4);
    } else if (c.screenLayout === "three-mfd") {
      this.createMFDScreen("mfd_left", -0.34, 1.04, z, 0.35, 0.32, 5, 4);
      this.createMFDScreen("mfd_right", 0.34, 1.04, z, 0.35, 0.32, 5, 4);
      this.createScreen("CenterMFD", 0, 0.68, -c.tubLength * 0.37, 0.36, 0.26, 5, 3);
    } else if (c.screenLayout === "mixed") {
      this.createMFDScreen("mfd_left", -0.3, 1.03, z, 0.34, 0.3, 5, 4);
      this.createMFDScreen("mfd_right", 0.3, 1.03, z, 0.34, 0.3, 5, 4);
      for (const x of [-0.28, 0, 0.28]) this.createGauge(x, 0.7, -c.tubLength * 0.37);
    } else {
      // analog-heavy: dials up top, two compact MFDs low so radar/EW stay usable.
      for (const [x, y] of [[-0.36, 1.08], [-0.12, 1.08], [0.12, 1.08], [0.36, 1.08]] as [number, number][]) this.createGauge(x, y, -c.tubLength * 0.36);
      this.createMFDScreen("mfd_left", -0.3, 0.75, -c.tubLength * 0.36, 0.24, 0.2, 4, 3);
      this.createMFDScreen("mfd_right", 0.3, 0.75, -c.tubLength * 0.36, 0.24, 0.2, 4, 3);
    }
    this.createUFC();
  }

  /** Decorative (lit) display used for the non-primary center MFD. */
  protected createScreen(name: string, x: number, y: number, z: number, w: number, h: number, bx: number, by: number): void {
    const group = new THREE.Group(); group.name = name; group.position.set(x, y, z); group.rotation.x = this.config.panelAngle;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.06), this.materials.frame); group.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.materials.screen); screen.position.z = -0.035; screen.rotation.y = Math.PI; group.add(screen);
    for (let i = 0; i < bx; i++) { const px = -w / 2 + (i / (bx - 1)) * w; for (const py of [h / 2 + 0.05, -h / 2 - 0.05]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.022), this.materials.button); b.position.set(px, py, -0.04); group.add(b); } }
    for (let i = 0; i < by; i++) { const py = -h / 2 + (i / (by - 1)) * h; for (const px of [-w / 2 - 0.05, w / 2 + 0.05]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.022), this.materials.button); b.position.set(px, py, -0.04); group.add(b); } }
    this.add(group);
  }

  /**
   * Primary MFD face bound by the MFDRenderer. Uses an unlit MeshBasicMaterial and
   * faces the pilot (+Z normal, no mirror flip) so the canvas texture reads upright.
   */
  protected createMFDScreen(name: string, x: number, y: number, z: number, w: number, h: number, bx: number, by: number): void {
    const group = new THREE.Group(); group.name = `${name}_group`; group.position.set(x, y, z); group.rotation.x = this.config.panelAngle;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.06), this.materials.frame); group.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x001a0d, side: THREE.DoubleSide })); screen.name = name; screen.position.z = 0.035; group.add(screen);
    for (let i = 0; i < bx; i++) { const px = -w / 2 + (i / (bx - 1)) * w; for (const py of [h / 2 + 0.05, -h / 2 - 0.05]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.022), this.materials.button); b.position.set(px, py, 0.04); group.add(b); } }
    for (let i = 0; i < by; i++) { const py = -h / 2 + (i / (by - 1)) * h; for (const px of [-w / 2 - 0.05, w / 2 + 0.05]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.022), this.materials.button); b.position.set(px, py, 0.04); group.add(b); } }
    this.add(group);
  }

  protected createGauge(x: number, y: number, z: number): void {
    this.cylinder("GaugeBezel", 0.07, 0.07, 0.025, v3(x, y, z), this.materials.metal, new THREE.Euler(Math.PI / 2 + this.config.panelAngle, 0, 0), 20);
    const face = this.addMesh("GaugeFace", new THREE.CircleGeometry(0.055, 20), this.materials.panel, v3(x, y, z - 0.017), new THREE.Euler(this.config.panelAngle, Math.PI, 0)); face.renderOrder = 1;
  }

  protected createUFC(): void {
    const z = -this.config.tubLength * 0.35;
    this.box("UFC", v3(0.48, 0.18, 0.07), v3(0, 1.4, z), this.materials.panel, new THREE.Euler(this.config.panelAngle, 0, 0));
    this.box("UFCDisplay", v3(0.24, 0.05, 0.015), v3(0, 1.44, z - 0.045), this.materials.screen, new THREE.Euler(this.config.panelAngle, 0, 0));
    for (let r = 0; r < 2; r++) for (let col = 0; col < 5; col++) this.box("UFCButton", v3(0.038, 0.03, 0.02), v3(-0.12 + col * 0.06, 1.37 - r * 0.045, z - 0.05), this.materials.button, new THREE.Euler(this.config.panelAngle, 0, 0));
  }

  protected createSideConsoles(): void {
    const c = this.config;
    for (const side of [-1, 1] as const) {
      const x = side * (c.tubWidth * 0.4);
      this.box(side < 0 ? "LeftConsole" : "RightConsole", v3(c.tubWidth * 0.22, 0.22, c.tubLength * 0.62), v3(x, 0.52, 0.1), this.materials.panel, new THREE.Euler(0.02, 0, side * -0.05));
      for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) this.box("ConsoleButton", v3(0.032, 0.022, 0.04), v3(x + (col - 1.5) * 0.052, 0.65, -0.55 + row * 0.15), this.materials.button);
    }
  }

  protected createControls(): void {
    const c = this.config;
    if (c.centerStick) {
      this.cylinder("StickShaft", 0.035, 0.05, 0.48, v3(0.18, 0.58, -0.15), this.materials.metal, new THREE.Euler(0.15, 0, -0.15));
      const grip = this.addMesh("ControlStickGrip", new THREE.CapsuleGeometry(0.07, 0.18, 6, 12), this.materials.panel, v3(0.13, 0.86, -0.1), new THREE.Euler(0.08, 0, -0.15)); grip.castShadow = true;
    }
    if (c.sideStick) {
      this.cylinder("SideStickShaft", 0.028, 0.04, 0.28, v3(0.48, 0.74, -0.15), this.materials.metal, new THREE.Euler(0.05, 0, -0.22));
      this.addMesh("SideStickGrip", new THREE.CapsuleGeometry(0.06, 0.14, 6, 12), this.materials.panel, v3(0.44, 0.91, -0.13), new THREE.Euler(0.05, 0, -0.2));
    }
    const count = c.twinThrottle ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const x = -0.48 + (i - (count - 1) / 2) * 0.07;
      this.box("ThrottleLever", v3(0.04, 0.3, 0.04), v3(x, 0.86, 0.02), this.materials.metal, new THREE.Euler(-0.18, 0, 0));
      this.addMesh("ThrottleGrip", new THREE.CapsuleGeometry(0.043, 0.11, 5, 10), this.materials.panel, v3(x, 1.02, -0.02), new THREE.Euler(0, 0, Math.PI / 2));
    }
  }

  protected createPedals(): void {
    for (const side of [-1, 1] as const) {
      this.box("PedalArm", v3(0.04, 0.04, 0.44), v3(side * 0.2, 0.24, -0.72), this.materials.metal, new THREE.Euler(-0.2, 0, 0));
      this.box("RudderPedal", v3(0.22, 0.07, 0.16), v3(side * 0.2, 0.34, -0.95), this.materials.metal, new THREE.Euler(-0.36, 0, 0));
    }
  }

  protected createHUD(): void {
    const z = -this.config.tubLength * 0.34;
    this.box("HUDBase", v3(0.4, 0.1, 0.2), v3(0, 1.53, z), this.materials.panel);
    for (const x of [-0.18, 0.18]) this.box("HUDSupport", v3(0.03, 0.3, 0.03), v3(x, 1.72, z - 0.02), this.materials.metal, new THREE.Euler(-0.08, 0, 0));
    const hud = this.addMesh("HUDGlass", new THREE.PlaneGeometry(0.38, 0.28), this.materials.hud, v3(0, 1.77, z - 0.03), new THREE.Euler(-0.08, Math.PI, 0)); hud.renderOrder = 3;
  }

  protected createCanopyFrame(): void {
    const c = this.config;
    const left = new THREE.CatmullRomCurve3([v3(-c.tubWidth / 2, 0.9, -c.tubLength / 2 + 0.1), v3(-c.tubWidth * 0.45, 1.7, -0.55), v3(-c.tubWidth * 0.32, 2.0, 0.25), v3(-c.tubWidth * 0.38, 1.55, c.tubLength / 2 - 0.1)]);
    const right = new THREE.CatmullRomCurve3(left.points.map(p => v3(-p.x, p.y, p.z)));
    for (const [name, curve] of [["CanopyRailLeft", left], ["CanopyRailRight", right]] as const) this.addMesh(name, new THREE.TubeGeometry(curve, 24, 0.03, 8, false), this.materials.metal);
    if (c.canopyBow) {
      const bow = new THREE.CatmullRomCurve3([v3(-c.tubWidth / 2, 0.92, -c.tubLength / 2 + 0.12), v3(-c.tubWidth * 0.25, 1.58, -c.tubLength / 2 + 0.1), v3(0, 1.78, -c.tubLength / 2 + 0.08), v3(c.tubWidth * 0.25, 1.58, -c.tubLength / 2 + 0.1), v3(c.tubWidth / 2, 0.92, -c.tubLength / 2 + 0.12)]);
      this.addMesh("CanopyBow", new THREE.TubeGeometry(bow, 24, 0.035, 8, false), this.materials.metal);
    }
  }

  /**
   * Reparent the stick + throttle into pivot groups, then shift the whole
   * interior by −EYE so the pilot eye sits at the group origin.
   */
  private setupControlsAnimation(): void {
    const stickBase = this.config.sideStick ? v3(0.48, 0.6, -0.15) : v3(0.18, 0.34, -0.15);
    this.stickPivot = this.buildPivot(stickBase, ["StickShaft", "ControlStickGrip", "SideStickShaft", "SideStickGrip"]);
    this.throttlePivot = this.buildPivot(v3(-0.48, 0.72, 0.18), ["ThrottleLever", "ThrottleGrip"]);

    const root = new THREE.Group();
    root.name = "cockpit_root";
    for (const child of [...this.children]) root.add(child);
    this.add(root);
    root.position.set(-EYE.x, -EYE.y, -EYE.z);
  }

  private buildPivot(base: THREE.Vector3, names: string[]): THREE.Group | undefined {
    const nameSet = new Set(names);
    const parts = this.children.filter(child => nameSet.has(child.name));
    if (parts.length === 0) return undefined;
    const pivot = new THREE.Group();
    pivot.name = "controlPivot";
    pivot.position.copy(base);
    for (const part of parts) {
      this.remove(part);
      part.position.sub(base);
      pivot.add(part);
    }
    this.add(pivot);
    return pivot;
  }
}
