import * as THREE from "three";
import { Materials, loft, prismXZ, box, cylinder, verticalFin, canopyWedge, wheel } from "../core/MeshTools";

export interface F16CExteriorOptions { landingGearDown?: boolean; canopyOpen?: boolean; }

export class F16CExterior extends THREE.Group {
  constructor(options: F16CExteriorOptions = {}) {
    super(); this.name = "F-16C Fighting Falcon Exterior";
    loft(this,"SlenderFuselage",[
  {z:-7.0,width:.03,height:.03,y:.76},{z:-5.7,width:.32,height:.3,y:.78},{z:-3.7,width:.58,height:.5,y:.82},
  {z:-1.1,width:.7,height:.64,y:.76},{z:1.8,width:.66,height:.58,y:.66},{z:4.3,width:.47,height:.4,y:.63},{z:5.0,width:.18,height:.18,y:.63}
],Materials.bodyLight,18);
prismXZ(this,"LeftCroppedDelta",[[-.4,-1.55],[-4.75,.15],[-4.25,1.95],[-.55,2.35]],.12,.72,Materials.bodyLight);
prismXZ(this,"RightCroppedDelta",[[.4,-1.55],[4.75,.15],[4.25,1.95],[.55,2.35]],.12,.72,Materials.bodyLight);
prismXZ(this,"LeftStrake",[[-.3,-2.8],[-1.55,-1.3],[-.6,-.8]],.1,.78,Materials.bodyLight);
prismXZ(this,"RightStrake",[[.3,-2.8],[1.55,-1.3],[.6,-.8]],.1,.78,Materials.bodyLight);
cylinder(this,"ChinIntakeLip",.5,.5,.18,[0,.12,-2.65],Materials.bodyDark,[Math.PI/2,0,0],28);
box(this,"ChinIntake",[.78,.48,1.35],[0,.08,-1.98],Materials.intake);
cylinder(this,"SingleEngineNozzle",.43,.38,.72,[0,.62,4.75],Materials.exhaust,[Math.PI/2,0,0],28);
prismXZ(this,"LeftTailplane",[[-.25,3.15],[-2.25,3.65],[-1.8,4.45],[-.35,4.1]],.09,.78,Materials.bodyLight);
prismXZ(this,"RightTailplane",[[.25,3.15],[2.25,3.65],[1.8,4.45],[.35,4.1]],.09,.78,Materials.bodyLight);
verticalFin(this,"SingleVerticalTail",[[-.62,0],[-.16,2.8],[.3,3.18],[.65,.15]],0,3.6,.13,0,Materials.bodyLight);
canopyWedge(this,"BubbleCanopy",2.75,.92,.9,[0,1.24,-2.55],false);
box(this,"VentralFin",[.08,.52,.7],[0,.05,3.35],Materials.bodyDark,[.15,0,0]);
    if (options.landingGearDown ?? true) this.addLandingGear();
    const canopy=this.getObjectByName("GoldCanopy") ?? this.getObjectByName("SinglePieceCanopy") ?? this.getObjectByName("BubbleCanopy") ?? this.getObjectByName("FramedCanopy") ?? this.getObjectByName("ShortCanopy") ?? this.getObjectByName("FacetedCanopy") ?? this.getObjectByName("FlankerCanopy") ?? this.getObjectByName("ModernFlankerCanopy");
    if (options.canopyOpen && canopy) { canopy.rotation.x=-0.48; canopy.position.z += .55; canopy.position.y += .38; }
  }
  private addLandingGear(): void {
    cylinder(this,"NoseGearStrut",.045,.06,1.05,[0,-.48,-3.7],Materials.metal,[0,0,0],14); wheel(this,"NoseWheel",[0,-1.02,-3.7],.22,.13);
    for (const side of [-1,1]) { cylinder(this,side<0?"LeftMainStrut":"RightMainStrut",.06,.085,1.35,[side*1.05,-.35,.55],Materials.metal,[0,0,side*.18],14); wheel(this,side<0?"LeftMainWheel":"RightMainWheel",[side*1.25,-1.0,.55],.34,.17); }
  }
}
