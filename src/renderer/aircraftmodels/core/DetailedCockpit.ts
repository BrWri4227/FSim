import * as THREE from "three";

export type DisplaySpec = {
  name: string;
  position: [number, number, number];
  size: [number, number];
  rotationX?: number;
  buttons?: boolean;
};

export type GaugeSpec = {
  position: [number, number, number];
  radius?: number;
};

export type DetailedCockpitConfig = {
  name: string;
  tubWidth?: number;
  tubLength?: number;
  panelWidth?: number;
  panelHeight?: number;
  panelPosition?: [number, number, number];
  panelRotationX?: number;
  displays: DisplaySpec[];
  gauges?: GaugeSpec[];
  ufc?: boolean;
  panoramicDisplay?: boolean;
  sideStick?: boolean;
  dualThrottle?: boolean;
  russianStyle?: boolean;
  canopyGold?: boolean;
  canopyHeight?: number;
  canopyLength?: number;
  seatScale?: number;
  consoleRows?: number;
  consoleColumns?: number;
  hud?: boolean;
};

export class DetailedCockpit extends THREE.Group {
  protected readonly materials = {
    cockpit: new THREE.MeshStandardMaterial({ color: 0x25282a, roughness: 0.82, metalness: 0.08 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.9, metalness: 0.05 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x07130d, emissive: 0x34ff8a, emissiveIntensity: 0.22, roughness: 0.25 }),
    screenBlue: new THREE.MeshStandardMaterial({ color: 0x071018, emissive: 0x3aa8ff, emissiveIntensity: 0.16, roughness: 0.25 }),
    screenFrame: new THREE.MeshStandardMaterial({ color: 0x171a1c, roughness: 0.72, metalness: 0.15 }),
    button: new THREE.MeshStandardMaterial({ color: 0x3a3d3e, roughness: 0.8 }),
    redButton: new THREE.MeshStandardMaterial({ color: 0x8c1717, roughness: 0.65 }),
    greenButton: new THREE.MeshStandardMaterial({ color: 0x175c2b, roughness: 0.65 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x303533, roughness: 0.95 }),
    cushion: new THREE.MeshStandardMaterial({ color: 0x48503f, roughness: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x5d6264, roughness: 0.45, metalness: 0.65 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x91d6d8, transparent: true, opacity: 0.19, roughness: 0.08, metalness: 0, transmission: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    goldGlass: new THREE.MeshPhysicalMaterial({ color: 0xb78e52, transparent: true, opacity: 0.27, roughness: 0.08, metalness: 0.06, transmission: 0.42, depthWrite: false, side: THREE.DoubleSide }),
    hudGlass: new THREE.MeshPhysicalMaterial({ color: 0x64ffab, transparent: true, opacity: 0.24, roughness: 0.04, transmission: 0.4, depthWrite: false, side: THREE.DoubleSide }),
    warning: new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0xff6a00, emissiveIntensity: 0.35, roughness: 0.55 }),
  };

  protected readonly config: Required<Omit<DetailedCockpitConfig, "gauges">> & { gauges: GaugeSpec[] };

  constructor(config: DetailedCockpitConfig) {
    super();
    this.config = {
      tubWidth: 1.3, tubLength: 2.9, panelWidth: 1.14, panelHeight: 0.76,
      panelPosition: [0, 1.02, -0.91], panelRotationX: -0.11,
      gauges: [], ufc: true, panoramicDisplay: false, sideStick: false,
      dualThrottle: true, russianStyle: false, canopyGold: false,
      canopyHeight: 1.0, canopyLength: 2.55, seatScale: 1,
      consoleRows: 9, consoleColumns: 4, hud: true,
      ...config,
    };
    this.name = this.config.name;
    this.createCockpitTub();
    this.createSeat();
    this.createMainInstrumentPanel();
    this.createSideConsoles();
    this.createControlStick();
    this.createThrottle();
    this.createRudderPedals();
    if (this.config.hud) this.createHUD();
    this.createCanopyFrame();
    this.createCanopyGlass();
    this.createRearDeck();
  }

  protected box(name:string,size:THREE.Vector3,position:THREE.Vector3,material:THREE.Material,rotation=new THREE.Euler()):THREE.Mesh {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),material);
    mesh.name=name; mesh.position.copy(position); mesh.rotation.copy(rotation); mesh.castShadow=true; mesh.receiveShadow=true; this.add(mesh); return mesh;
  }
  protected cylinder(name:string,rt:number,rb:number,h:number,position:THREE.Vector3,material:THREE.Material,rotation=new THREE.Euler(),segments=16):THREE.Mesh {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material);
    mesh.name=name; mesh.position.copy(position); mesh.rotation.copy(rotation); mesh.castShadow=true; mesh.receiveShadow=true; this.add(mesh); return mesh;
  }
  private createCockpitTub():void {
    const w=this.config.tubWidth, l=this.config.tubLength;
    this.box("CockpitFloor",new THREE.Vector3(w,.1,l),new THREE.Vector3(0,.05,.1),this.materials.cockpit);
    this.box("LeftWall",new THREE.Vector3(.12,.92,l-.15),new THREE.Vector3(-w/2-.06,.47,.05),this.materials.cockpit,new THREE.Euler(0,0,-.05));
    this.box("RightWall",new THREE.Vector3(.12,.92,l-.15),new THREE.Vector3(w/2+.06,.47,.05),this.materials.cockpit,new THREE.Euler(0,0,.05));
    this.box("FrontBulkhead",new THREE.Vector3(w+.02,.95,.12),new THREE.Vector3(0,.47,-l/2+.11),this.materials.cockpit);
    this.box("RearBulkhead",new THREE.Vector3(w+.02,1.1,.12),new THREE.Vector3(0,.55,l/2-.03),this.materials.cockpit);
    this.box("LowerKneePanel",new THREE.Vector3(this.config.panelWidth*.9,.58,.16),new THREE.Vector3(0,.52,-1.13),this.materials.panel,new THREE.Euler(-.32,0,0));
  }
  private createSeat():void {
    const s=this.config.seatScale;
    this.box("SeatBase",new THREE.Vector3(.62*s,.16*s,.7*s),new THREE.Vector3(0,.31,.48),this.materials.seat,new THREE.Euler(-.08,0,0));
    this.box("SeatBottomCushion",new THREE.Vector3(.53*s,.11*s,.58*s),new THREE.Vector3(0,.43,.45),this.materials.cushion,new THREE.Euler(-.08,0,0));
    this.box("SeatBack",new THREE.Vector3(.62*s,1.02*s,.18*s),new THREE.Vector3(0,.88,.88),this.materials.seat,new THREE.Euler(-.18,0,0));
    this.box("BackCushion",new THREE.Vector3(.5*s,.75*s,.1*s),new THREE.Vector3(0,.84,.76),this.materials.cushion,new THREE.Euler(-.18,0,0));
    this.box("Headrest",new THREE.Vector3(.45*s,.3*s,.25*s),new THREE.Vector3(0,1.47,1.02),this.materials.seat,new THREE.Euler(-.12,0,0));
    this.box("LeftSeatRail",new THREE.Vector3(.07,1.2,.08),new THREE.Vector3(-.35,.89,1.04),this.materials.metal,new THREE.Euler(-.16,0,0));
    this.box("RightSeatRail",new THREE.Vector3(.07,1.2,.08),new THREE.Vector3(.35,.89,1.04),this.materials.metal,new THREE.Euler(-.16,0,0));
    this.createHarnessStrap(-.16); this.createHarnessStrap(.16);
    this.box("EjectionHandleLeft",new THREE.Vector3(.04,.04,.22),new THREE.Vector3(-.2,.43,.04),this.materials.warning,new THREE.Euler(0,.35,0));
    this.box("EjectionHandleRight",new THREE.Vector3(.04,.04,.22),new THREE.Vector3(.2,.43,.04),this.materials.warning,new THREE.Euler(0,-.35,0));
  }
  private createHarnessStrap(x:number):void { this.box("HarnessStrap",new THREE.Vector3(.075,.7,.025),new THREE.Vector3(x,1.02,.68),this.materials.metal,new THREE.Euler(-.23,0,x<0?-.14:.14)); }
  private createMainInstrumentPanel():void {
    const [x,y,z]=this.config.panelPosition;
    this.box("MainInstrumentPanel",new THREE.Vector3(this.config.panelWidth,this.config.panelHeight,.11),new THREE.Vector3(x,y,z),this.materials.panel,new THREE.Euler(this.config.panelRotationX,0,0));
    if(this.config.panoramicDisplay) this.createPanoramicDisplay(); else for(const d of this.config.displays) this.createMFD(d);
    if(this.config.ufc) this.createUFC();
    for(const g of this.config.gauges) this.createGauge(g);
    this.createMasterArmPanel();
  }
  private createMFD(spec:DisplaySpec):void {
    const group=new THREE.Group(); group.name=spec.name; group.position.set(...spec.position); group.rotation.x=spec.rotationX??this.config.panelRotationX;
    const [w,h]=spec.size;
    const frame=new THREE.Mesh(new THREE.BoxGeometry(w+.09,h+.09,.065),this.materials.screenFrame);
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(w,h),this.config.russianStyle?this.materials.screenBlue:this.materials.screen); screen.position.z=-.036; screen.rotation.y=Math.PI;
    group.add(frame,screen);
    if(spec.buttons!==false){ const sx=5,sy=4,bs=.028; for(let i=0;i<sx;i++){const ox=-w/2+i/(sx-1)*w;group.add(this.makeMFDButton(ox,h/2+.055,bs),this.makeMFDButton(ox,-h/2-.055,bs));} for(let i=0;i<sy;i++){const oy=-h/2+i/(sy-1)*h;group.add(this.makeMFDButton(-w/2-.055,oy,bs),this.makeMFDButton(w/2+.055,oy,bs));}}
    this.add(group);
  }
  private createPanoramicDisplay():void {
    const g=new THREE.Group(); g.name="PanoramicCockpitDisplay"; g.position.set(0,1.04,-.98); g.rotation.x=-.1;
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.03,.46,.07),this.materials.screenFrame); const screen=new THREE.Mesh(new THREE.PlaneGeometry(.94,.38),this.materials.screenBlue); screen.position.z=-.041; screen.rotation.y=Math.PI; g.add(frame,screen);
    for(let i=0;i<7;i++){const divider=new THREE.Mesh(new THREE.BoxGeometry(.008,.36,.012),this.materials.panel);divider.position.set(-.39+i*.13,0,-.048);g.add(divider);} this.add(g);
  }
  private makeMFDButton(x:number,y:number,size:number):THREE.Mesh { const b=new THREE.Mesh(new THREE.BoxGeometry(size,size,.025),this.materials.button); b.position.set(x,y,-.045); b.castShadow=true; return b; }
  private createUFC():void {
    const group=new THREE.Group(); group.name="UpFrontController"; group.position.set(0,1.39,-.96); group.rotation.x=-.1;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(.5,.2,.08),this.materials.panel));
    const display=new THREE.Mesh(new THREE.PlaneGeometry(.25,.055),this.materials.screen); display.position.set(0,.04,-.045); display.rotation.y=Math.PI; group.add(display);
    for(let r=0;r<2;r++) for(let c=0;c<5;c++){const b=new THREE.Mesh(new THREE.BoxGeometry(.04,.035,.025),this.materials.button);b.position.set(-.12+c*.06,-.03-r*.052,-.05);group.add(b);} this.add(group);
  }
  private createGauge(spec:GaugeSpec):void { const [x,y,z]=spec.position,r=spec.radius??.05; this.cylinder("AnalogGaugeBezel",r,r,.025,new THREE.Vector3(x,y,z),this.materials.metal,new THREE.Euler(Math.PI/2-this.config.panelRotationX,0,0),24); const face=new THREE.Mesh(new THREE.CircleGeometry(r*.78,24),this.materials.panel);face.position.set(x,y,z-.017);face.rotation.set(this.config.panelRotationX,Math.PI,0);this.add(face); }
  private createMasterArmPanel():void { this.box("MasterArmPanel",new THREE.Vector3(.18,.13,.05),new THREE.Vector3(.49,1.39,-1.01),this.materials.panel,new THREE.Euler(-.1,0,0)); this.box("MasterArmSwitch",new THREE.Vector3(.025,.07,.025),new THREE.Vector3(.49,1.4,-1.05),this.materials.redButton,new THREE.Euler(-.1,0,.25)); }
  private createSideConsoles():void { this.createConsole(-1); this.createConsole(1); }
  private createConsole(side:-1|1):void {
    const x=side*(this.config.tubWidth*.415);
    this.box(side===-1?"LeftConsole":"RightConsole",new THREE.Vector3(.31,.23,1.75),new THREE.Vector3(x,.52,.12),this.materials.panel,new THREE.Euler(.02,0,side*-.05));
    for(let r=0;r<this.config.consoleRows;r++) for(let c=0;c<this.config.consoleColumns;c++){const z=-.58+r*(1.3/Math.max(1,this.config.consoleRows-1));const lx=x+(c-(this.config.consoleColumns-1)/2)*.055;const mat=(r+c)%11===0?this.materials.redButton:(r+c)%7===0?this.materials.greenButton:this.materials.button;this.box("ConsoleButton",new THREE.Vector3(.035,.025,.045),new THREE.Vector3(lx,.655,z),mat,new THREE.Euler(0,0,side*-.05));}
    for(let i=0;i<5;i++) this.createToggleSwitch(x+(i-2)*.055,.69,.55+i*.15,side);
  }
  private createToggleSwitch(x:number,y:number,z:number,side:number):void { this.cylinder("ToggleSwitchBase",.025,.025,.018,new THREE.Vector3(x,y,z),this.materials.metal,new THREE.Euler(0,0,Math.PI/2),12); this.box("ToggleSwitchLever",new THREE.Vector3(.015,.055,.015),new THREE.Vector3(x,y+.035,z),this.materials.metal,new THREE.Euler(.2,0,side*.12)); }
  private createControlStick():void {
    const x = this.config.sideStick ? 0.28 : 0;
    this.cylinder("ControlStickShaft",.035,.05,.5,new THREE.Vector3(x,.58,-.2),this.materials.metal,new THREE.Euler(.15,0,this.config.sideStick?-.17:0),16);
    const grip=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.19,6,12),this.materials.panel); grip.name="ControlStickGrip"; grip.position.set(x-.06,.86,-.16); grip.rotation.set(.08,0,this.config.sideStick?-.16:0); grip.castShadow=true; this.add(grip);
    this.cylinder("StickHatSwitch",.025,.025,.025,new THREE.Vector3(x-.08,.97,-.18),this.materials.button,new THREE.Euler(0,0,Math.PI/2),12);
    this.box("StickTrigger",new THREE.Vector3(.022,.065,.025),new THREE.Vector3(x-.11,.91,-.22),this.materials.redButton,new THREE.Euler(.15,0,this.config.sideStick?-.16:0));
  }
  private createThrottle():void {
    this.box("ThrottleTrack",new THREE.Vector3(.13,.07,.5),new THREE.Vector3(-.53,.71,.05),this.materials.metal);
    for(const dx of this.config.dualThrottle?[-.035,.035]:[0]){this.box("ThrottleLever",new THREE.Vector3(.045,.32,.045),new THREE.Vector3(-.53+dx,.87,.03),this.materials.metal,new THREE.Euler(-.18,0,0));const grip=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.12,5,10),this.materials.panel);grip.name="ThrottleGrip";grip.position.set(-.53+dx,1.02,-.02);grip.rotation.z=Math.PI/2;grip.castShadow=true;this.add(grip);}
  }
  private createRudderPedals():void { for(const side of [-1,1]){this.box("RudderPedalArm",new THREE.Vector3(.045,.045,.48),new THREE.Vector3(side*.22,.23,-.75),this.materials.metal,new THREE.Euler(-.2,0,0));this.box("RudderPedal",new THREE.Vector3(.24,.08,.17),new THREE.Vector3(side*.22,.33,-1),this.materials.metal,new THREE.Euler(-.38,0,0));} }
  private createHUD():void { this.box("HUDBase",new THREE.Vector3(.42,.12,.23),new THREE.Vector3(0,1.53,-.92),this.materials.panel);this.box("HUDLeftSupport",new THREE.Vector3(.035,.34,.035),new THREE.Vector3(-.19,1.73,-.94),this.materials.metal,new THREE.Euler(-.08,0,0));this.box("HUDRightSupport",new THREE.Vector3(.035,.34,.035),new THREE.Vector3(.19,1.73,-.94),this.materials.metal,new THREE.Euler(-.08,0,0));const glass=new THREE.Mesh(new THREE.PlaneGeometry(.39,.3),this.materials.hudGlass);glass.name="HUDCombinerGlass";glass.position.set(0,1.78,-.95);glass.rotation.set(-.08,Math.PI,0);glass.renderOrder=3;this.add(glass); }
  private createCanopyFrame():void {
    const h=this.config.canopyHeight,l=this.config.canopyLength,w=this.config.tubWidth*.52;
    const left=new THREE.CatmullRomCurve3([new THREE.Vector3(-w,.88,-l*.43),new THREE.Vector3(-w*.94,1.58,-l*.2),new THREE.Vector3(-w*.7,1.02+h,0),new THREE.Vector3(-w*.62,.96+h,l*.34),new THREE.Vector3(-w*.8,1.5,l*.5)]);
    const right=new THREE.CatmullRomCurve3(left.points.map(p=>new THREE.Vector3(-p.x,p.y,p.z)));this.addTube("LeftCanopyRail",left,.035);this.addTube("RightCanopyRail",right,.035);
    const front=new THREE.CatmullRomCurve3([new THREE.Vector3(-w,.9,-l*.42),new THREE.Vector3(-w*.7,1.5,-l*.4),new THREE.Vector3(0,1.78,-l*.38),new THREE.Vector3(w*.7,1.5,-l*.4),new THREE.Vector3(w,.9,-l*.42)]);this.addTube("FrontCanopyBow",front,.04);
    const rear=new THREE.CatmullRomCurve3([new THREE.Vector3(-w*.8,1.49,l*.48),new THREE.Vector3(-w*.5,.96+h,l*.47),new THREE.Vector3(0,1.06+h,l*.46),new THREE.Vector3(w*.5,.96+h,l*.47),new THREE.Vector3(w*.8,1.49,l*.48)]);this.addTube("RearCanopyBow",rear,.04);
  }
  private addTube(name:string,curve:THREE.Curve<THREE.Vector3>,radius:number):void { const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,28,radius,8,false),this.materials.metal);tube.name=name;tube.castShadow=true;this.add(tube); }
  private createCanopyGlass():void {
    const h=this.config.canopyHeight,l=this.config.canopyLength,w=this.config.tubWidth*.5;
    const vertices=new Float32Array([-w,.95,-l*.4,-w*.7,.94+h,-l*.18,-w*.62,.88+h,l*.34,-w,.95,-l*.4,-w*.62,.88+h,l*.34,-w*.78,1.5,l*.48,w,.95,-l*.4,w*.62,.88+h,l*.34,w*.7,.94+h,-l*.18,w,.95,-l*.4,w*.78,1.5,l*.48,w*.62,.88+h,l*.34,-w,.95,-l*.4,w,.95,-l*.4,w*.7,.94+h,-l*.18,-w,.95,-l*.4,w*.7,.94+h,-l*.18,-w*.7,.94+h,-l*.18,-w*.7,.94+h,-l*.18,w*.7,.94+h,-l*.18,w*.62,.88+h,l*.34,-w*.7,.94+h,-l*.18,w*.62,.88+h,l*.34,-w*.62,.88+h,l*.34]);
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(vertices,3));g.computeVertexNormals();const glass=new THREE.Mesh(g,this.config.canopyGold?this.materials.goldGlass:this.materials.glass);glass.name="CanopyGlass";glass.renderOrder=2;this.add(glass);
  }
  private createRearDeck():void { this.box("RearAvionicsDeck",new THREE.Vector3(1.05,.17,.65),new THREE.Vector3(0,1.32,1.3),this.materials.cockpit,new THREE.Euler(-.08,0,0));for(let i=0;i<6;i++)this.box("RearDeckVent",new THREE.Vector3(.07,.012,.34),new THREE.Vector3(-.3+i*.12,1.415,1.3),this.materials.panel,new THREE.Euler(-.08,0,0)); }
}
