import * as THREE from "three";
import { Materials, loft, prismXZ, box, cylinder, capsule, verticalFin, canopyWedge, wheel } from "../core/MeshTools";

export interface Su57ExteriorOptions { landingGearDown?: boolean; canopyOpen?: boolean; }

export class Su57Exterior extends THREE.Group {
  constructor(options: Su57ExteriorOptions = {}) {
    super(); this.name = "Su-57 Felon Exterior";
    loft(this,"FlattenedBlendedBody",[
  {z:-9.2,width:.04,height:.04,y:.68},{z:-7.2,width:.5,height:.28,y:.7},{z:-4.8,width:1.0,height:.42,y:.72},
  {z:-2.2,width:1.8,height:.48,y:.66},{z:.6,width:2.15,height:.42,y:.58},{z:4.2,width:1.75,height:.34,y:.54},{z:5.6,width:.6,height:.22,y:.54}
],Materials.body,22);
prismXZ(this,"LeftBroadStealthWing",[[-.75,-1.75],[-7.25,.0],[-6.1,2.85],[-1.0,3.25]],.13,.66,Materials.body);
prismXZ(this,"RightBroadStealthWing",[[.75,-1.75],[7.25,.0],[6.1,2.85],[1.0,3.25]],.13,.66,Materials.body);
prismXZ(this,"LeftLEVCON",[[-.5,-3.5],[-2.4,-2.05],[-2.0,-.65],[-.68,-1.2]],.1,.72,Materials.bodyDark);
prismXZ(this,"RightLEVCON",[[.5,-3.5],[2.4,-2.05],[2.0,-.65],[.68,-1.2]],.1,.72,Materials.bodyDark);
capsule(this,"LeftEngineNacelle",.55,5.0,[-1.02,.35,1.65],Materials.bodyDark,[1,.65,1]);
capsule(this,"RightEngineNacelle",.55,5.0,[1.02,.35,1.65],Materials.bodyDark,[1,.65,1]);
box(this,"LeftAngularIntake",[.82,.52,1.8],[-1.15,.45,-1.85],Materials.bodyDark,[0,.12,0]);
box(this,"RightAngularIntake",[.82,.52,1.8],[1.15,.45,-1.85],Materials.bodyDark,[0,-.12,0]);
box(this,"LeftIntakeMouth",[.62,.35,.04],[-1.25,.46,-2.77],Materials.intake,[0,.12,0]);
box(this,"RightIntakeMouth",[.62,.35,.04],[1.25,.46,-2.77],Materials.intake,[0,-.12,0]);
cylinder(this,"LeftRoundNozzle",.47,.4,.7,[-1.02,.38,5.2],Materials.exhaust,[Math.PI/2,0,0],28);
cylinder(this,"RightRoundNozzle",.47,.4,.7,[1.02,.38,5.2],Materials.exhaust,[Math.PI/2,0,0],28);
verticalFin(this,"LeftSmallTail",[[-.48,0],[-.2,2.25],[.22,2.52],[.5,.12]],-1.42,3.45,.1,-.35,Materials.body);
verticalFin(this,"RightSmallTail",[[-.48,0],[-.2,2.25],[.22,2.52],[.5,.12]],1.42,3.45,.1,.35,Materials.body);
prismXZ(this,"LeftAllMovingTail",[[-.7,3.05],[-3.75,3.55],[-3.1,4.85],[-.8,4.35]],.1,.67,Materials.body);
prismXZ(this,"RightAllMovingTail",[[.7,3.05],[3.75,3.55],[3.1,4.85],[.8,4.35]],.1,.67,Materials.body);
canopyWedge(this,"FacetedCanopy",2.75,1.0,.75,[0,1.2,-3.25],true);
box(this,"TailSting",[.32,.28,2.1],[0,.62,5.15],Materials.bodyDark);
    if (options.landingGearDown ?? true) this.addLandingGear();
    const canopy=this.getObjectByName("GoldCanopy") ?? this.getObjectByName("SinglePieceCanopy") ?? this.getObjectByName("BubbleCanopy") ?? this.getObjectByName("FramedCanopy") ?? this.getObjectByName("ShortCanopy") ?? this.getObjectByName("FacetedCanopy") ?? this.getObjectByName("FlankerCanopy") ?? this.getObjectByName("ModernFlankerCanopy");
    if (options.canopyOpen && canopy) { canopy.rotation.x=-0.48; canopy.position.z += .55; canopy.position.y += .38; }
  }
  private addLandingGear(): void {
    cylinder(this,"NoseGearStrut",.045,.06,1.05,[0,-.48,-3.7],Materials.metal,[0,0,0],14); wheel(this,"NoseWheel",[0,-1.02,-3.7],.22,.13);
    for (const side of [-1,1]) { cylinder(this,side<0?"LeftMainStrut":"RightMainStrut",.06,.085,1.35,[side*1.05,-.35,.55],Materials.metal,[0,0,side*.18],14); wheel(this,side<0?"LeftMainWheel":"RightMainWheel",[side*1.25,-1.0,.55],.34,.17); }
  }
}
