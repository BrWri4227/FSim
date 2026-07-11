import * as THREE from "three";
import { Materials, loft, prismXZ, box, cylinder, capsule, verticalFin, canopyWedge, wheel } from "../core/MeshTools";

export interface Su35SExteriorOptions { landingGearDown?: boolean; canopyOpen?: boolean; }

export class Su35SExterior extends THREE.Group {
  constructor(options: Su35SExteriorOptions = {}) {
    super(); this.name = "Su-35S Flanker-E Exterior";
    loft(this,"RefinedFlankerBody",[
  {z:-10.1,width:.03,height:.03,y:.72},{z:-8.1,width:.36,height:.29,y:.74},{z:-5.6,width:.72,height:.46,y:.76},
  {z:-3.0,width:1.08,height:.54,y:.69},{z:-.8,width:1.5,height:.48,y:.61},{z:2.9,width:1.58,height:.39,y:.53},{z:5.2,width:.65,height:.24,y:.52}
],Materials.body,20);
prismXZ(this,"LeftReshapedLERX",[[-.38,-4.4],[-1.75,-3.0],[-2.8,-.75],[-.72,-1.35]],.13,.69,Materials.body);
prismXZ(this,"RightReshapedLERX",[[.38,-4.4],[1.75,-3.0],[2.8,-.75],[.72,-1.35]],.13,.69,Materials.body);
prismXZ(this,"LeftUpdatedWing",[[-.72,-1.45],[-7.3,.38],[-6.2,3.08],[-.98,3.2]],.14,.67,Materials.body);
prismXZ(this,"RightUpdatedWing",[[.72,-1.45],[7.3,.38],[6.2,3.08],[.98,3.2]],.14,.67,Materials.body);
capsule(this,"LeftEngine",.57,5.25,[-1.02,.25,1.82],Materials.bodyDark,[1,.69,1]);
capsule(this,"RightEngine",.57,5.25,[1.02,.25,1.82],Materials.bodyDark,[1,.69,1]);
box(this,"CentralTunnel",[.86,.27,4.85],[0,-.01,1.68],Materials.bodyDark);
box(this,"LeftIntake",[.8,.62,.05],[-1.03,.21,-1.45],Materials.intake);
box(this,"RightIntake",[.8,.62,.05],[1.03,.21,-1.45],Materials.intake);
cylinder(this,"LeftVectoringNozzle",.46,.39,.82,[-1.02,.29,5.3],Materials.exhaust,[Math.PI/2,.04,0],30);
cylinder(this,"RightVectoringNozzle",.46,.39,.82,[1.02,.29,5.3],Materials.exhaust,[Math.PI/2,-.04,0],30);
verticalFin(this,"LeftReducedTail",[[-.56,0],[-.27,2.78],[.25,3.08],[.58,.14]],-1.29,3.05,.13,-.13,Materials.body);
verticalFin(this,"RightReducedTail",[[-.56,0],[-.27,2.78],[.25,3.08],[.58,.14]],1.29,3.05,.13,.13,Materials.body);
prismXZ(this,"LeftTailplane",[[-.62,3.02],[-3.9,3.68],[-3.25,5.02],[-.72,4.45]],.11,.64,Materials.body);
prismXZ(this,"RightTailplane",[[.62,3.02],[3.9,3.68],[3.25,5.02],[.72,4.45]],.11,.64,Materials.body);
box(this,"ShortenedTailBoom",[.42,.3,2.0],[0,.49,5.25],Materials.body);
cylinder(this,"IRSTBall",.13,.13,.16,[.22,1.2,-4.55],Materials.glass,[0,0,Math.PI/2],20);
canopyWedge(this,"ModernFlankerCanopy",2.65,.9,.76,[0,1.22,-3.76],false);
    if (options.landingGearDown ?? true) this.addLandingGear();
    const canopy=this.getObjectByName("GoldCanopy") ?? this.getObjectByName("SinglePieceCanopy") ?? this.getObjectByName("BubbleCanopy") ?? this.getObjectByName("FramedCanopy") ?? this.getObjectByName("ShortCanopy") ?? this.getObjectByName("FacetedCanopy") ?? this.getObjectByName("FlankerCanopy") ?? this.getObjectByName("ModernFlankerCanopy");
    if (options.canopyOpen && canopy) { canopy.rotation.x=-0.48; canopy.position.z += .55; canopy.position.y += .38; }
  }
  private addLandingGear(): void {
    cylinder(this,"NoseGearStrut",.045,.06,1.05,[0,-.48,-3.7],Materials.metal,[0,0,0],14); wheel(this,"NoseWheel",[0,-1.02,-3.7],.22,.13);
    for (const side of [-1,1]) { cylinder(this,side<0?"LeftMainStrut":"RightMainStrut",.06,.085,1.35,[side*1.05,-.35,.55],Materials.metal,[0,0,side*.18],14); wheel(this,side<0?"LeftMainWheel":"RightMainWheel",[side*1.25,-1.0,.55],.34,.17); }
  }
}
