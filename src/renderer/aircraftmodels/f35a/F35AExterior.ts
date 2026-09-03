import * as THREE from "three";
import { Materials, loft, prismXZ, box, cylinder, verticalFin, canopyWedge, wheel } from "../core/MeshTools";

export interface F35AExteriorOptions { landingGearDown?: boolean; canopyOpen?: boolean; }

export class F35AExterior extends THREE.Group {
  constructor(options: F35AExteriorOptions = {}) {
    super(); this.name = "F-35A Lightning II Exterior";
    loft(this,"DeepSingleEngineFuselage",[
  {z:-7.4,width:.05,height:.05,y:.72},{z:-6.0,width:.42,height:.36,y:.78},{z:-4.2,width:.92,height:.64,y:.82},
  {z:-1.9,width:1.38,height:.72,y:.72},{z:.8,width:1.55,height:.66,y:.62},{z:3.5,width:1.12,height:.58,y:.58},{z:4.8,width:.52,height:.42,y:.58}
],Materials.body,20);
prismXZ(this,"LeftCroppedWing",[[-.75,-1.1],[-5.4,.2],[-4.65,2.35],[-.92,2.8]],.16,.67,Materials.body);
prismXZ(this,"RightCroppedWing",[[.75,-1.1],[5.4,.2],[4.65,2.35],[.92,2.8]],.16,.67,Materials.body);
prismXZ(this,"LeftTailplane",[[-.65,2.55],[-2.85,3.25],[-2.35,4.25],[-.72,3.95]],.1,.76,Materials.body);
prismXZ(this,"RightTailplane",[[.65,2.55],[2.85,3.25],[2.35,4.25],[.72,3.95]],.1,.76,Materials.body);
box(this,"LeftDSI",[.72,.62,1.45],[-1.08,.64,-2.15],Materials.bodyDark,[0,.12,0]);
box(this,"RightDSI",[.72,.62,1.45],[1.08,.64,-2.15],Materials.bodyDark,[0,-.12,0]);
box(this,"LeftIntake",[.53,.38,.03],[-1.17,.65,-2.88],Materials.intake,[0,.12,0]);
box(this,"RightIntake",[.53,.38,.03],[1.17,.65,-2.88],Materials.intake,[0,-.12,0]);
cylinder(this,"SingleCircularNozzle",.52,.46,.7,[0,.61,4.65],Materials.exhaust,[Math.PI/2,0,0],30);
verticalFin(this,"LeftTail",[[-.5,0],[-.18,2.2],[.28,2.55],[.52,.16]],-.82,3.15,.1,-.28,Materials.body);
verticalFin(this,"RightTail",[[-.5,0],[-.18,2.2],[.28,2.55],[.52,.16]],.82,3.15,.1,.28,Materials.body);
canopyWedge(this,"SinglePieceCanopy",2.45,.95,.72,[0,1.32,-2.8],true);
box(this,"ChinedNoseLeft",[.08,.18,2.2],[-.47,.85,-5.2],Materials.bodyDark,[0,.05,0]);
box(this,"ChinedNoseRight",[.08,.18,2.2],[.47,.85,-5.2],Materials.bodyDark,[0,-.05,0]);
    if (options.landingGearDown ?? true) this.addLandingGear();
    const canopy=this.getObjectByName("GoldCanopy") ?? this.getObjectByName("SinglePieceCanopy") ?? this.getObjectByName("BubbleCanopy") ?? this.getObjectByName("FramedCanopy") ?? this.getObjectByName("ShortCanopy") ?? this.getObjectByName("FacetedCanopy") ?? this.getObjectByName("FlankerCanopy") ?? this.getObjectByName("ModernFlankerCanopy");
    if (options.canopyOpen && canopy) { canopy.rotation.x=-0.48; canopy.position.z += .55; canopy.position.y += .38; }
  }
  private addLandingGear(): void {
    cylinder(this,"NoseGearStrut",.045,.06,1.05,[0,-.48,-3.7],Materials.metal,[0,0,0],14); wheel(this,"NoseWheel",[0,-1.02,-3.7],.22,.13);
    for (const side of [-1,1]) { cylinder(this,side<0?"LeftMainStrut":"RightMainStrut",.06,.085,1.35,[side*1.05,-.35,.55],Materials.metal,[0,0,side*.18],14); wheel(this,side<0?"LeftMainWheel":"RightMainWheel",[side*1.25,-1.0,.55],.34,.17); }
  }
}
