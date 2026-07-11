import * as THREE from "three";

export interface FA18ExteriorOptions {
  landingGearDown?: boolean;
  canopyOpen?: boolean;
  showWeapons?: boolean;
}

/**
 * Procedural F/A-18E exterior. Authored with the nose pointing along local −Z,
 * wingspan ~12 units, length ~16 units, +Y up. Wire it into the roster via
 * PlaceholderMeshes, which reconciles the axis convention (nose → +X) so the
 * shared MESH_BIAS_QUAT orients it toward NED North like every other jet.
 */
export class FA18Exterior extends THREE.Group {
  private readonly options: Required<FA18ExteriorOptions>;

  private readonly materials = {
    body: new THREE.MeshStandardMaterial({ color: 0x8b9296, roughness: 0.72, metalness: 0.18 }),
    bodyDark: new THREE.MeshStandardMaterial({ color: 0x5d6367, roughness: 0.76, metalness: 0.22 }),
    panelDark: new THREE.MeshStandardMaterial({ color: 0x303538, roughness: 0.8, metalness: 0.12 }),
    intake: new THREE.MeshStandardMaterial({ color: 0x16191b, roughness: 0.88, metalness: 0.05, side: THREE.DoubleSide }),
    engine: new THREE.MeshStandardMaterial({ color: 0x34383a, roughness: 0.5, metalness: 0.75 }),
    exhaust: new THREE.MeshStandardMaterial({ color: 0x201f1e, roughness: 0.62, metalness: 0.82 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x587f88, transparent: true, opacity: 0.52, roughness: 0.12, metalness: 0.05, transmission: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    tire: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0 }),
    landingGear: new THREE.MeshStandardMaterial({ color: 0xd3d6d5, roughness: 0.42, metalness: 0.72 }),
    lightRed: new THREE.MeshStandardMaterial({ color: 0xff1919, emissive: 0xff0000, emissiveIntensity: 1.7 }),
    lightGreen: new THREE.MeshStandardMaterial({ color: 0x19ff42, emissive: 0x00ff22, emissiveIntensity: 1.7 }),
    lightWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5 }),
    missile: new THREE.MeshStandardMaterial({ color: 0xc7c9c6, roughness: 0.62, metalness: 0.2 }),
    missileBand: new THREE.MeshStandardMaterial({ color: 0x3c4143, roughness: 0.72 }),
  };

  constructor(options: FA18ExteriorOptions = {}) {
    super();
    this.options = {
      landingGearDown: options.landingGearDown ?? true,
      canopyOpen: options.canopyOpen ?? false,
      showWeapons: options.showWeapons ?? false,
    };
    this.name = "FA18Exterior";
    this.createFuselage();
    this.createCockpitSection();
    this.createLeadingEdgeExtensions();
    this.createWings();
    this.createTailSection();
    this.createAirIntakes();
    this.createEngineNacelles();
    this.createControlSurfaces();
    this.createDetails();
    this.createNavigationLights();
    if (this.options.landingGearDown) this.createLandingGear();
    if (this.options.showWeapons) this.createStores();
  }

  private mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position = new THREE.Vector3(), rotation = new THREE.Euler()): THREE.Mesh {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.position.copy(position);
    object.rotation.copy(rotation);
    object.castShadow = true;
    object.receiveShadow = true;
    this.add(object);
    return object;
  }

  private box(name: string, size: THREE.Vector3, position: THREE.Vector3, material: THREE.Material, rotation = new THREE.Euler()): THREE.Mesh {
    return this.mesh(name, new THREE.BoxGeometry(size.x, size.y, size.z), material, position, rotation);
  }

  private cylinder(name: string, radiusTop: number, radiusBottom: number, height: number, position: THREE.Vector3, material: THREE.Material, rotation = new THREE.Euler(), radialSegments = 20): THREE.Mesh {
    return this.mesh(name, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material, position, rotation);
  }

  private createFuselage(): void {
    this.mesh("MainFuselage", new THREE.CapsuleGeometry(0.72, 6.7, 12, 28), this.materials.body, new THREE.Vector3(0, 0.72, 0.3), new THREE.Euler(Math.PI / 2, 0, 0));
    this.cylinder("ForwardFuselage", 0.68, 0.35, 3.3, new THREE.Vector3(0, 0.74, -4.1), this.materials.body, new THREE.Euler(Math.PI / 2, 0, 0), 28);
    this.cylinder("Radome", 0.35, 0.025, 2.2, new THREE.Vector3(0, 0.73, -6.83), this.materials.bodyDark, new THREE.Euler(Math.PI / 2, 0, 0), 28);
    this.mesh("UpperSpine", new THREE.CapsuleGeometry(0.28, 4.3, 8, 18), this.materials.body, new THREE.Vector3(0, 1.25, 0.7), new THREE.Euler(Math.PI / 2, 0, 0));
    this.box("LowerFuselage", new THREE.Vector3(1.1, 0.34, 5.5), new THREE.Vector3(0, 0.18, 0.25), this.materials.bodyDark);
  }

  private createCockpitSection(): void {
    const canopy = this.createCanopyGeometry();
    const canopyMesh = this.mesh("Canopy", canopy, this.materials.glass, new THREE.Vector3(0, 1.23, -2.5));
    canopyMesh.renderOrder = 4;
    if (this.options.canopyOpen) { canopyMesh.position.set(0, 1.62, -1.8); canopyMesh.rotation.x = -0.52; }
    this.box("CanopyBase", new THREE.Vector3(1.02, 0.16, 2.65), new THREE.Vector3(0, 1.2, -2.25), this.materials.panelDark);
    this.box("CanopyRearFrame", new THREE.Vector3(1.08, 0.1, 0.1), new THREE.Vector3(0, 1.45, -1.1), this.materials.panelDark, new THREE.Euler(0.05, 0, 0));
    this.box("CanopyCenterBow", new THREE.Vector3(0.055, 0.58, 0.08), new THREE.Vector3(0, 1.53, -2.45), this.materials.panelDark, new THREE.Euler(-0.18, 0, 0));
  }

  private createCanopyGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -0.52,0.0,-1.25, -0.41,0.63,-0.75, -0.34,0.78,0.35,
      -0.52,0.0,-1.25, -0.34,0.78,0.35, -0.5,0.15,1.25,
      0.52,0.0,-1.25, 0.34,0.78,0.35, 0.41,0.63,-0.75,
      0.52,0.0,-1.25, 0.5,0.15,1.25, 0.34,0.78,0.35,
      -0.52,0.0,-1.25, 0.52,0.0,-1.25, 0.41,0.63,-0.75,
      -0.52,0.0,-1.25, 0.41,0.63,-0.75, -0.41,0.63,-0.75,
      -0.41,0.63,-0.75, 0.41,0.63,-0.75, 0.34,0.78,0.35,
      -0.41,0.63,-0.75, 0.34,0.78,0.35, -0.34,0.78,0.35,
      -0.34,0.78,0.35, 0.34,0.78,0.35, 0.5,0.15,1.25,
      -0.34,0.78,0.35, 0.5,0.15,1.25, -0.5,0.15,1.25,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  private createLeadingEdgeExtensions(): void {
    const leftPoints = [ new THREE.Vector2(-0.48,-3.0), new THREE.Vector2(-0.72,-1.7), new THREE.Vector2(-2.0,-0.25), new THREE.Vector2(-0.75,-0.75) ];
    const rightPoints = leftPoints.map((p) => new THREE.Vector2(-p.x, p.y));
    this.createPrismFromXZ("LeftLeadingEdgeExtension", leftPoints, 0.1, 0.7, this.materials.body);
    this.createPrismFromXZ("RightLeadingEdgeExtension", rightPoints, 0.1, 0.7, this.materials.body);
  }

  private createWings(): void {
    const leftWing = [ new THREE.Vector2(-0.65,-0.6), new THREE.Vector2(-6.0,0.6), new THREE.Vector2(-5.65,2.0), new THREE.Vector2(-0.78,2.45) ];
    const rightWing = leftWing.map((p) => new THREE.Vector2(-p.x, p.y));
    this.createPrismFromXZ("LeftWing", leftWing, 0.14, 0.66, this.materials.body);
    this.createPrismFromXZ("RightWing", rightWing, 0.14, 0.66, this.materials.body);
    this.box("LeftWingtipRail", new THREE.Vector3(0.1,0.13,1.35), new THREE.Vector3(-5.73,0.67,1.23), this.materials.bodyDark, new THREE.Euler(0,-0.06,0));
    this.box("RightWingtipRail", new THREE.Vector3(0.1,0.13,1.35), new THREE.Vector3(5.73,0.67,1.23), this.materials.bodyDark, new THREE.Euler(0,0.06,0));
  }

  private createTailSection(): void {
    const leftStabilizer = [ new THREE.Vector2(-0.45,2.9), new THREE.Vector2(-3.75,3.45), new THREE.Vector2(-3.3,4.65), new THREE.Vector2(-0.55,4.1) ];
    const rightStabilizer = leftStabilizer.map((p) => new THREE.Vector2(-p.x, p.y));
    this.createPrismFromXZ("LeftHorizontalStabilizer", leftStabilizer, 0.12, 0.78, this.materials.body);
    this.createPrismFromXZ("RightHorizontalStabilizer", rightStabilizer, 0.12, 0.78, this.materials.body);
    this.createVerticalTail(-1);
    this.createVerticalTail(1);
  }

  private createVerticalTail(side: -1 | 1): void {
    const shape = new THREE.Shape();
    shape.moveTo(-0.6, 0);
    shape.lineTo(-0.22, 2.6);
    shape.lineTo(0.28, 3.45);
    shape.lineTo(0.65, 0.25);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
    geometry.center();
    const tail = this.mesh(side === -1 ? "LeftVerticalTail" : "RightVerticalTail", geometry, this.materials.body, new THREE.Vector3(side * 1.05, 2.08, 3.15), new THREE.Euler(0, side * 0.05, side * -0.32));
    tail.rotation.order = "YXZ";
    this.box(side === -1 ? "LeftRudder" : "RightRudder", new THREE.Vector3(0.1,1.85,0.58), new THREE.Vector3(side * 1.48, 2.2, 3.7), this.materials.bodyDark, new THREE.Euler(0, 0, side * -0.32));
  }

  private createAirIntakes(): void {
    for (const side of [-1, 1] as const) {
      const x = side * 0.86;
      this.box(side === -1 ? "LeftIntakeOuter" : "RightIntakeOuter", new THREE.Vector3(0.66,0.75,2.2), new THREE.Vector3(x,0.55,-0.95), this.materials.bodyDark, new THREE.Euler(0, side * 0.035, 0));
      this.box(side === -1 ? "LeftIntakeOpening" : "RightIntakeOpening", new THREE.Vector3(0.48,0.52,0.04), new THREE.Vector3(x,0.57,-2.07), this.materials.intake, new THREE.Euler(0, side * 0.035, 0));
      this.box(side === -1 ? "LeftIntakeRamp" : "RightIntakeRamp", new THREE.Vector3(0.48,0.05,1.1), new THREE.Vector3(x,0.84,-1.5), this.materials.body, new THREE.Euler(0.08, 0, 0));
    }
  }

  private createEngineNacelles(): void {
    for (const side of [-1, 1] as const) {
      const x = side * 0.78;
      this.mesh(side === -1 ? "LeftEngineNacelle" : "RightEngineNacelle", new THREE.CapsuleGeometry(0.52,4.3,8,22), this.materials.bodyDark, new THREE.Vector3(x,0.53,1.52), new THREE.Euler(Math.PI / 2, 0, 0));
      this.cylinder(side === -1 ? "LeftExhaust" : "RightExhaust", 0.44,0.37,0.82, new THREE.Vector3(x,0.55,4.15), this.materials.exhaust, new THREE.Euler(Math.PI / 2, 0, 0), 28);
      this.cylinder(side === -1 ? "LeftExhaustInterior" : "RightExhaustInterior", 0.29,0.29,0.025, new THREE.Vector3(x,0.55,4.57), this.materials.intake, new THREE.Euler(Math.PI / 2, 0, 0), 28);
      this.createExhaustPetals(side);
    }
  }

  private createExhaustPetals(side: -1 | 1): void {
    const x = side * 0.78;
    const count = 14;
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2;
      const radius = 0.4;
      const petal = this.box("ExhaustPetal", new THREE.Vector3(0.07,0.2,0.5), new THREE.Vector3(x + Math.cos(angle) * radius, 0.55 + Math.sin(angle) * radius, 4.2), this.materials.engine, new THREE.Euler(0, 0, angle));
      petal.rotation.order = "ZYX";
    }
  }

  private createControlSurfaces(): void {
    this.box("LeftAileron", new THREE.Vector3(2.5,0.07,0.5), new THREE.Vector3(-3.55,0.73,1.82), this.materials.bodyDark, new THREE.Euler(0,-0.08,0));
    this.box("RightAileron", new THREE.Vector3(2.5,0.07,0.5), new THREE.Vector3(3.55,0.73,1.82), this.materials.bodyDark, new THREE.Euler(0,0.08,0));
    this.box("LeftLeadingEdgeFlap", new THREE.Vector3(2.8,0.06,0.34), new THREE.Vector3(-3.3,0.71,0.18), this.materials.bodyDark, new THREE.Euler(0,-0.2,0));
    this.box("RightLeadingEdgeFlap", new THREE.Vector3(2.8,0.06,0.34), new THREE.Vector3(3.3,0.71,0.18), this.materials.bodyDark, new THREE.Euler(0,0.2,0));
  }

  private createDetails(): void {
    this.cylinder("NoseProbe", 0.018,0.01,0.72, new THREE.Vector3(0,0.73,-8.25), this.materials.engine, new THREE.Euler(Math.PI / 2, 0, 0), 12);
    this.box("DorsalAntenna", new THREE.Vector3(0.08,0.3,0.45), new THREE.Vector3(0,1.65,1.45), this.materials.bodyDark, new THREE.Euler(-0.18,0,0));
    this.box("LeftVentralFin", new THREE.Vector3(0.07,0.65,0.72), new THREE.Vector3(-0.55,-0.05,3.1), this.materials.bodyDark, new THREE.Euler(0.18,0,-0.3));
    this.box("RightVentralFin", new THREE.Vector3(0.07,0.65,0.72), new THREE.Vector3(0.55,-0.05,3.1), this.materials.bodyDark, new THREE.Euler(0.18,0,0.3));
    this.cylinder("GunPort", 0.045,0.045,0.45, new THREE.Vector3(-0.41,0.95,-5.2), this.materials.intake, new THREE.Euler(Math.PI / 2, 0, 0), 12);
    this.cylinder("ArrestingHook", 0.045,0.055,2.2, new THREE.Vector3(0,-0.22,3.3), this.materials.landingGear, new THREE.Euler(1.35,0,0), 12);
  }

  private createNavigationLights(): void {
    this.mesh("LeftNavigationLight", new THREE.SphereGeometry(0.08,12,8), this.materials.lightRed, new THREE.Vector3(-5.8,0.77,1.1));
    this.mesh("RightNavigationLight", new THREE.SphereGeometry(0.08,12,8), this.materials.lightGreen, new THREE.Vector3(5.8,0.77,1.1));
    this.mesh("TailNavigationLight", new THREE.SphereGeometry(0.065,12,8), this.materials.lightWhite, new THREE.Vector3(0,1.2,4.68));
  }

  private createLandingGear(): void {
    this.createNoseLandingGear();
    this.createMainLandingGear(-1);
    this.createMainLandingGear(1);
  }

  private createNoseLandingGear(): void {
    this.cylinder("NoseGearStrut", 0.055,0.075,1.25, new THREE.Vector3(0,-0.53,-3.8), this.materials.landingGear);
    this.cylinder("NoseGearFork", 0.035,0.035,0.55, new THREE.Vector3(0,-1.15,-3.8), this.materials.landingGear, new THREE.Euler(0,0,Math.PI / 2));
    this.createWheel("NoseWheelLeft", new THREE.Vector3(-0.13,-1.25,-3.8), 0.24, 0.1);
    this.createWheel("NoseWheelRight", new THREE.Vector3(0.13,-1.25,-3.8), 0.24, 0.1);
    this.box("NoseGearDoorLeft", new THREE.Vector3(0.06,0.7,0.5), new THREE.Vector3(-0.32,-0.32,-3.65), this.materials.body, new THREE.Euler(0,0,-0.28));
    this.box("NoseGearDoorRight", new THREE.Vector3(0.06,0.7,0.5), new THREE.Vector3(0.32,-0.32,-3.65), this.materials.body, new THREE.Euler(0,0,0.28));
  }

  private createMainLandingGear(side: -1 | 1): void {
    const x = side * 1.2;
    this.cylinder(side === -1 ? "LeftMainGearStrut" : "RightMainGearStrut", 0.075,0.1,1.75, new THREE.Vector3(x,-0.35,0.45), this.materials.landingGear, new THREE.Euler(0,0,side * 0.28));
    this.cylinder("MainGearDragBrace", 0.04,0.04,1.15, new THREE.Vector3(side * 1.02,-0.25,0.95), this.materials.landingGear, new THREE.Euler(0.5,0,side * -0.25));
    this.createWheel(side === -1 ? "LeftMainWheel" : "RightMainWheel", new THREE.Vector3(side * 1.47,-1.2,0.4), 0.4, 0.18);
    this.box(side === -1 ? "LeftMainGearDoor" : "RightMainGearDoor", new THREE.Vector3(0.09,1.2,0.7), new THREE.Vector3(side * 0.85,-0.25,0.55), this.materials.body, new THREE.Euler(0.12,0,side * 0.2));
  }

  private createWheel(name: string, position: THREE.Vector3, radius: number, width: number): void {
    this.mesh(name, new THREE.CylinderGeometry(radius, radius, width, 24), this.materials.tire, position, new THREE.Euler(0, 0, Math.PI / 2));
    this.mesh(`${name}Hub`, new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, width + 0.015, 20), this.materials.landingGear, position, new THREE.Euler(0, 0, Math.PI / 2));
  }

  private createStores(): void {
    this.createMissile("LeftWingtipMissile", new THREE.Vector3(-5.78,0.5,1.15));
    this.createMissile("RightWingtipMissile", new THREE.Vector3(5.78,0.5,1.15));
    this.createFuelTank("CenterlineFuelTank", new THREE.Vector3(0,-0.35,0.85));
    this.createMissile("LeftUnderwingMissile", new THREE.Vector3(-2.7,0.1,1.0));
    this.createMissile("RightUnderwingMissile", new THREE.Vector3(2.7,0.1,1.0));
  }

  private createMissile(name: string, position: THREE.Vector3): void {
    const group = new THREE.Group();
    group.name = name;
    group.position.copy(position);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,2.25,16), this.materials.missile);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09,0.48,16), this.materials.missile);
    nose.position.z = -1.36; nose.rotation.x = -Math.PI / 2;
    group.add(nose);
    const rear = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.25,16), this.materials.missileBand);
    rear.position.z = 1.23; rear.rotation.x = Math.PI / 2;
    group.add(rear);
    for (const side of [-1, 1]) {
      const finHorizontal = new THREE.Mesh(new THREE.BoxGeometry(0.38,0.025,0.28), this.materials.missile);
      finHorizontal.position.set(0, 0, 0.85);
      group.add(finHorizontal);
      const finVertical = new THREE.Mesh(new THREE.BoxGeometry(0.025,0.38,0.28), this.materials.missile);
      finVertical.position.set(0, 0, 0.85);
      group.add(finVertical);
      void side;
    }
    this.add(group);
  }

  private createFuelTank(name: string, position: THREE.Vector3): void {
    const group = new THREE.Group();
    group.name = name;
    group.position.copy(position);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3,2.7,8,20), this.materials.body);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.32,1.2), this.materials.bodyDark);
    pylon.position.y = 0.35;
    group.add(pylon);
    this.add(group);
  }

  private createPrismFromXZ(name: string, points: THREE.Vector2[], thickness: number, y: number, material: THREE.Material): THREE.Mesh {
    const geometry = this.makeXZPrismGeometry(points, thickness);
    return this.mesh(name, geometry, material, new THREE.Vector3(0, y, 0));
  }

  private makeXZPrismGeometry(points: THREE.Vector2[], thickness: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const first = points[0]!;
    shape.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index++) {
      const point = points[index]!;
      shape.lineTo(point.x, point.y);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, -thickness / 2, 0);
    geometry.computeVertexNormals();
    return geometry;
  }
}
