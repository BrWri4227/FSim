import * as THREE from "three";
import type { FighterExteriorConfig, FighterOptions, WingPlanform, TailPlanform } from "./types";
import { v3 } from "./types";

/**
 * Shared procedural fighter exterior. Authored with the nose along local −Z
 * (Radome/ForwardFuselage at negative Z), +Y up. PlaceholderMeshes reconciles
 * the axis convention (nose → +X) so the shared MESH_BIAS_QUAT orients it toward
 * NED North like the rest of the roster.
 */
export class ProceduralFighterExterior extends THREE.Group {
  protected readonly config: FighterExteriorConfig;
  protected readonly options: Required<FighterOptions>;

  protected readonly materials = {
    body: new THREE.MeshStandardMaterial({ color: 0x858c90, roughness: 0.72, metalness: 0.16 }),
    bodyDark: new THREE.MeshStandardMaterial({ color: 0x4b5054, roughness: 0.76, metalness: 0.2 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x22272a, roughness: 0.82, metalness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x466a73, transparent: true, opacity: 0.5, roughness: 0.1, transmission: 0.25, depthWrite: false, side: THREE.DoubleSide }),
    intake: new THREE.MeshStandardMaterial({ color: 0x111416, roughness: 0.95, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb8bec0, roughness: 0.4, metalness: 0.75 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.96 }),
    red: new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 1.4 }),
    green: new THREE.MeshStandardMaterial({ color: 0x20ff48, emissive: 0x00ff22, emissiveIntensity: 1.4 }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.1 }),
    store: new THREE.MeshStandardMaterial({ color: 0xb9bdbb, roughness: 0.62, metalness: 0.16 }),
  };

  constructor(config: FighterExteriorConfig, options: FighterOptions = {}) {
    super();
    this.config = config;
    this.options = {
      landingGearDown: options.landingGearDown ?? true,
      canopyOpen: options.canopyOpen ?? false,
      showStores: options.showStores ?? false,
    };
    this.name = `${config.className}Exterior`;
    this.build();
  }

  protected build(): void {
    this.createFuselage();
    this.createWingPair(this.config.wing, "Wing");
    this.createHorizontalTailPair(this.config.horizontalTail);
    this.createIntakes();
    this.createEngines();
    this.createVerticalTails();
    this.createCockpitCanopy();
    this.createAircraftFeatures();
    this.createLights();
    if (this.options.landingGearDown) this.createLandingGear();
    if (this.options.showStores) this.createStores();
  }

  protected addMesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position = v3(0, 0, 0), rotation = new THREE.Euler()): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.add(mesh);
    return mesh;
  }

  protected box(name: string, size: THREE.Vector3, position: THREE.Vector3, material: THREE.Material, rotation = new THREE.Euler()): THREE.Mesh {
    return this.addMesh(name, new THREE.BoxGeometry(size.x, size.y, size.z), material, position, rotation);
  }

  protected cylinder(name: string, rt: number, rb: number, h: number, position: THREE.Vector3, material: THREE.Material, rotation = new THREE.Euler(), segments = 24): THREE.Mesh {
    return this.addMesh(name, new THREE.CylinderGeometry(rt, rb, h, segments), material, position, rotation);
  }

  protected createFuselage(): void {
    const c = this.config;
    this.addMesh("MainFuselage", new THREE.CapsuleGeometry(c.fuselageRadius, c.bodyLength, 10, 28), this.materials.body, v3(0, c.fuselageY, 0), new THREE.Euler(Math.PI / 2, 0, 0));
    this.cylinder("ForwardFuselage", c.fuselageRadius * 0.95, c.fuselageRadius * 0.45, c.noseLength, v3(0, c.fuselageY, -(c.bodyLength / 2 + c.noseLength / 2 - 0.25)), this.materials.body, new THREE.Euler(Math.PI / 2, 0, 0), 28);
    this.cylinder("Radome", c.fuselageRadius * 0.45, 0.025, c.noseLength * 0.58, v3(0, c.fuselageY, -c.length / 2 + c.noseLength * 0.29), this.materials.bodyDark, new THREE.Euler(Math.PI / 2, 0, 0), 28);
    this.box("LowerKeel", v3(c.fuselageRadius * 1.35, c.fuselageRadius * 0.38, c.bodyLength * 0.72), v3(0, c.fuselageY - c.fuselageRadius * 0.7, 0.45), this.materials.bodyDark);
    if (c.dorsalSpine) this.addMesh("DorsalSpine", new THREE.CapsuleGeometry(c.fuselageRadius * 0.28, c.bodyLength * 0.58, 8, 18), this.materials.body, v3(0, c.fuselageY + c.fuselageRadius * 0.72, 0.5), new THREE.Euler(Math.PI / 2, 0, 0));
  }

  protected createWingPair(p: WingPlanform, prefix: string): void {
    const left = [new THREE.Vector2(-0.35, p.rootLeadingZ), new THREE.Vector2(-p.halfSpan, p.tipLeadingZ), new THREE.Vector2(-p.halfSpan, p.tipTrailingZ), new THREE.Vector2(-0.45, p.rootTrailingZ)];
    const right = left.map(q => new THREE.Vector2(-q.x, q.y));
    this.createPrism(`${prefix}Left`, left, p.thickness, p.y, this.materials.body);
    this.createPrism(`${prefix}Right`, right, p.thickness, p.y, this.materials.body);
  }

  protected createHorizontalTailPair(p: TailPlanform): void {
    const left = [new THREE.Vector2(-p.xOffset, p.rootLeadingZ), new THREE.Vector2(-p.halfSpan, p.tipLeadingZ), new THREE.Vector2(-p.halfSpan, p.tipTrailingZ), new THREE.Vector2(-p.xOffset, p.rootTrailingZ)];
    const right = left.map(q => new THREE.Vector2(-q.x, q.y));
    this.createPrism("HorizontalTailLeft", left, p.thickness, p.y, this.materials.body);
    this.createPrism("HorizontalTailRight", right, p.thickness, p.y, this.materials.body);
  }

  protected createPrism(name: string, points: THREE.Vector2[], thickness: number, y: number, material: THREE.Material): THREE.Mesh {
    const shape = new THREE.Shape();
    const first = points[0]!;
    shape.moveTo(first.x, first.y);
    for (const p of points.slice(1)) shape.lineTo(p.x, p.y);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, -thickness / 2, 0);
    geometry.computeVertexNormals();
    return this.addMesh(name, geometry, material, v3(0, y, 0));
  }

  protected createIntakes(): void {
    const c = this.config;
    for (const side of [-1, 1] as const) {
      const x = side * c.intakeSpacing;
      const rotY = c.stealth ? side * 0.1 : side * 0.03;
      this.box(side < 0 ? "IntakeLeft" : "IntakeRight", v3(c.intakeWidth, c.intakeHeight, 1.8), v3(x, c.fuselageY - 0.12, c.intakeZ), this.materials.bodyDark, new THREE.Euler(0, rotY, 0));
      this.box(side < 0 ? "IntakeOpeningLeft" : "IntakeOpeningRight", v3(c.intakeWidth * 0.72, c.intakeHeight * 0.72, 0.035), v3(x, c.fuselageY - 0.1, c.intakeZ - 0.92), this.materials.intake, new THREE.Euler(0, rotY, 0));
    }
  }

  protected createEngines(): void {
    const c = this.config;
    const xs = c.twinEngine ? [-c.engineSpacing, c.engineSpacing] : [0];
    for (const x of xs) {
      this.addMesh(`EngineNacelle${x < 0 ? "Left" : x > 0 ? "Right" : ""}`, new THREE.CapsuleGeometry(c.engineRadius, c.bodyLength * 0.5, 8, 22), this.materials.bodyDark, v3(x, c.fuselageY - 0.12, c.engineZ), new THREE.Euler(Math.PI / 2, 0, 0));
      this.cylinder(`Exhaust${x < 0 ? "Left" : x > 0 ? "Right" : ""}`, c.engineRadius * 0.86, c.engineRadius * 0.72, 0.72, v3(x, c.fuselageY - 0.12, c.engineZ + c.bodyLength * 0.31), this.materials.panel, new THREE.Euler(Math.PI / 2, 0, 0), 28);
    }
  }

  protected createVerticalTails(): void {
    const c = this.config;
    const xs = c.twinTail ? [-c.tailSpacing, c.tailSpacing] : [0];
    for (const x of xs) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.52, 0); shape.lineTo(-0.12, c.tailHeight); shape.lineTo(0.34, c.tailHeight * 0.78); shape.lineTo(0.58, 0.1); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.11, bevelEnabled: false }); g.center();
      const side = x < 0 ? -1 : x > 0 ? 1 : 0;
      this.addMesh(`VerticalTail${side < 0 ? "Left" : side > 0 ? "Right" : ""}`, g, this.materials.body, v3(x, c.fuselageY + c.tailHeight * 0.52, c.engineZ + c.bodyLength * 0.18), new THREE.Euler(0, side * c.tailSweep, side * -c.tailCant));
    }
  }

  protected createCockpitCanopy(): void {
    const c = this.config;
    const group = new THREE.Group(); group.name = "CanopyAssembly";
    const baseZ = -c.length * 0.18;
    const base = new THREE.Mesh(new THREE.BoxGeometry(c.fuselageRadius * 1.3, 0.12, c.length * 0.18), this.materials.panel); base.position.set(0, c.fuselageY + c.fuselageRadius * 0.75, baseZ); group.add(base);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(c.fuselageRadius * 0.72, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.materials.glass); canopy.name = "Canopy"; canopy.scale.set(1, 0.9, 2.0); canopy.position.set(0, c.fuselageY + c.fuselageRadius * 0.84, baseZ - 0.1); canopy.rotation.x = this.options.canopyOpen ? -0.45 : 0; canopy.renderOrder = 4; group.add(canopy);
    this.add(group);
  }

  protected createAircraftFeatures(): void {
    const c = this.config;
    if (c.lerx) {
      const z = -c.length * 0.12;
      this.createPrism("LERXLeft", [new THREE.Vector2(-0.35, z - 1.3), new THREE.Vector2(-2.0, z + 0.5), new THREE.Vector2(-0.65, z + 0.15)], 0.08, c.wing.y + 0.02, this.materials.body);
      this.createPrism("LERXRight", [new THREE.Vector2(0.35, z - 1.3), new THREE.Vector2(2.0, z + 0.5), new THREE.Vector2(0.65, z + 0.15)], 0.08, c.wing.y + 0.02, this.materials.body);
    }
    if (c.canards) {
      const z = -c.length * 0.16;
      this.createWingPair({ rootLeadingZ: z - 0.3, rootTrailingZ: z + 0.45, tipLeadingZ: z - 0.05, tipTrailingZ: z + 0.25, halfSpan: 2.0, thickness: 0.07, y: c.fuselageY + 0.05 }, "Canard");
    }
    if (c.ventralFins) {
      this.box("VentralFinLeft", v3(0.07, 0.58, 0.7), v3(-0.55, c.fuselageY - c.fuselageRadius * 0.95, c.engineZ + 1.8), this.materials.bodyDark, new THREE.Euler(0.16, 0, -0.3));
      this.box("VentralFinRight", v3(0.07, 0.58, 0.7), v3(0.55, c.fuselageY - c.fuselageRadius * 0.95, c.engineZ + 1.8), this.materials.bodyDark, new THREE.Euler(0.16, 0, 0.3));
    }
    if (c.stealth) {
      this.box("StealthChineLeft", v3(0.08, 0.12, c.length * 0.28), v3(-c.fuselageRadius * 0.72, c.fuselageY + 0.18, -c.length * 0.15), this.materials.bodyDark, new THREE.Euler(0, 0, -0.12));
      this.box("StealthChineRight", v3(0.08, 0.12, c.length * 0.28), v3(c.fuselageRadius * 0.72, c.fuselageY + 0.18, -c.length * 0.15), this.materials.bodyDark, new THREE.Euler(0, 0, 0.12));
    }
  }

  protected createLights(): void {
    const c = this.config;
    this.addMesh("NavLightLeft", new THREE.SphereGeometry(0.07, 12, 8), this.materials.red, v3(-c.wing.halfSpan, c.wing.y + 0.08, (c.wing.tipLeadingZ + c.wing.tipTrailingZ) / 2));
    this.addMesh("NavLightRight", new THREE.SphereGeometry(0.07, 12, 8), this.materials.green, v3(c.wing.halfSpan, c.wing.y + 0.08, (c.wing.tipLeadingZ + c.wing.tipTrailingZ) / 2));
    this.addMesh("TailLight", new THREE.SphereGeometry(0.06, 12, 8), this.materials.white, v3(0, c.fuselageY + 0.5, c.length * 0.37));
  }

  protected createLandingGear(): void {
    const c = this.config;
    this.cylinder("NoseGearStrut", 0.05, 0.07, 1.1, v3(0, c.fuselageY - 0.8, -c.length * 0.23), this.materials.metal);
    this.createWheel("NoseWheel", v3(0, c.fuselageY - 1.4, -c.length * 0.23), 0.22, 0.12);
    for (const side of [-1, 1] as const) {
      this.cylinder(side < 0 ? "MainGearLeft" : "MainGearRight", 0.07, 0.1, 1.55, v3(side * c.intakeSpacing, c.fuselageY - 0.65, 0.45), this.materials.metal, new THREE.Euler(0, 0, side * 0.22));
      this.createWheel(side < 0 ? "MainWheelLeft" : "MainWheelRight", v3(side * (c.intakeSpacing + 0.3), c.fuselageY - 1.45, 0.45), 0.36, 0.18);
    }
  }

  protected createWheel(name: string, position: THREE.Vector3, radius: number, width: number): void {
    this.addMesh(name, new THREE.CylinderGeometry(radius, radius, width, 24), this.materials.tire, position, new THREE.Euler(0, 0, Math.PI / 2));
    this.addMesh(`${name}Hub`, new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, width + 0.01, 20), this.materials.metal, position, new THREE.Euler(0, 0, Math.PI / 2));
  }

  protected createStores(): void {
    const c = this.config;
    for (const side of [-1, 1] as const) {
      this.createMissile(`WingtipStore${side < 0 ? "Left" : "Right"}`, v3(side * (c.wing.halfSpan - 0.1), c.wing.y - 0.22, (c.wing.tipLeadingZ + c.wing.tipTrailingZ) / 2));
      this.createMissile(`UnderwingStore${side < 0 ? "Left" : "Right"}`, v3(side * c.wing.halfSpan * 0.52, c.wing.y - 0.28, (c.wing.rootLeadingZ + c.wing.rootTrailingZ) / 2));
    }
  }

  protected createMissile(name: string, position: THREE.Vector3): void {
    const g = new THREE.Group(); g.name = name; g.position.copy(position);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 14), this.materials.store); body.rotation.x = Math.PI / 2; g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.38, 14), this.materials.store); nose.position.z = -1.14; nose.rotation.x = -Math.PI / 2; g.add(nose);
    const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.025, 0.25), this.materials.store); fin1.position.z = 0.72; g.add(fin1);
    const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.32, 0.25), this.materials.store); fin2.position.z = 0.72; g.add(fin2);
    this.add(g);
  }
}
