import * as THREE from "three";
import { Materials, loft, prismXZ, box, cylinder, capsule, verticalFin, canopyWedge, wheel } from "../core/MeshTools";

export interface F15CExteriorOptions { landingGearDown?: boolean; canopyOpen?: boolean; }

export class F15CExterior extends THREE.Group {
  constructor(options: F15CExteriorOptions = {}) {
    super(); this.name = "F-15C Eagle Exterior";
    loft(this,"LongNose",[
  {z:-8.8,width:.03,height:.03,y:.72},{z:-7.0,width:.35,height:.32,y:.75},{z:-4.4,width:.72,height:.52,y:.78},{z:-2.6,width:.85,height:.62,y:.74}
],Materials.bodyLight,18);
box(this,"RectangularCenterFuselage",[2.2,1.08,5.5],[0,.65,.3],Materials.bodyLight);
prismXZ(this,"LeftBroadWing",[[-.85,-1.4],[-6.6,-.15],[-5.75,2.6],[-1.05,2.55]],.14,.76,Materials.bodyLight);
prismXZ(this,"RightBroadWing",[[.85,-1.4],[6.6,-.15],[5.75,2.6],[1.05,2.55]],.14,.76,Materials.bodyLight);
box(this,"LeftVariableRampIntake",[.95,.9,2.25],[-1.28,.62,-1.8],Materials.bodyDark);
box(this,"RightVariableRampIntake",[.95,.9,2.25],[1.28,.62,-1.8],Materials.bodyDark);
box(this,"LeftIntakeMouth",[.72,.62,.04],[-1.3,.63,-2.95],Materials.intake);
box(this,"RightIntakeMouth",[.72,.62,.04],[1.3,.63,-2.95],Materials.intake);
capsule(this,"LeftEngineNacelle",.52,4.0,[-.78,.46,1.4],Materials.bodyDark,[1,.85,1]);
capsule(this,"RightEngineNacelle",.52,4.0,[.78,.46,1.4],Materials.bodyDark,[1,.85,1]);
cylinder(this,"LeftNozzle",.46,.4,.75,[-.78,.47,4.55],Materials.exhaust,[Math.PI/2,0,0],28);
cylinder(this,"RightNozzle",.46,.4,.75,[.78,.47,4.55],Materials.exhaust,[Math.PI/2,0,0],28);
prismXZ(this,"LeftTailplane",[[-.55,2.75],[-3.35,3.25],[-2.85,4.55],[-.65,4.05]],.11,.72,Materials.bodyLight);
prismXZ(this,"RightTailplane",[[.55,2.75],[3.35,3.25],[2.85,4.55],[.65,4.05]],.11,.72,Materials.bodyLight);
verticalFin(this,"LeftUprightTail",[[-.62,0],[-.3,2.85],[.2,3.15],[.62,.12]],-1.02,3.0,.13,-.08,Materials.bodyLight);
verticalFin(this,"RightUprightTail",[[-.62,0],[-.3,2.85],[.2,3.15],[.62,.12]],1.02,3.0,.13,.08,Materials.bodyLight);
canopyWedge(this,"FramedCanopy",2.5,.94,.7,[0,1.35,-3.2],false);
box(this,"CanopyRearDeck",[1.05,.25,1.3],[0,1.14,-1.65],Materials.bodyDark);
    if (options.landingGearDown ?? true) this.addLandingGear();
    const canopy=this.getObjectByName("GoldCanopy") ?? this.getObjectByName("SinglePieceCanopy") ?? this.getObjectByName("BubbleCanopy") ?? this.getObjectByName("FramedCanopy") ?? this.getObjectByName("ShortCanopy") ?? this.getObjectByName("FacetedCanopy") ?? this.getObjectByName("FlankerCanopy") ?? this.getObjectByName("ModernFlankerCanopy");
    if (options.canopyOpen && canopy) { canopy.rotation.x=-0.48; canopy.position.z += .55; canopy.position.y += .38; }
  }
  private addLandingGear(): void {
    cylinder(this,"NoseGearStrut",.045,.06,1.05,[0,-.48,-3.7],Materials.metal,[0,0,0],14); wheel(this,"NoseWheel",[0,-1.02,-3.7],.22,.13);
    for (const side of [-1,1]) { cylinder(this,side<0?"LeftMainStrut":"RightMainStrut",.06,.085,1.35,[side*1.05,-.35,.55],Materials.metal,[0,0,side*.18],14); wheel(this,side<0?"LeftMainWheel":"RightMainWheel",[side*1.25,-1.0,.55],.34,.17); }
  }
}
