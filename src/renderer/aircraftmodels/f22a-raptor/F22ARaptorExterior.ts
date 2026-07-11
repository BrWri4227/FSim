import * as THREE from "three";
import { Materials, loft, prismXZ, box, cylinder, capsule, verticalFin, canopyWedge, wheel } from "../core/MeshTools";

export interface F22ARaptorExteriorOptions { landingGearDown?: boolean; canopyOpen?: boolean; }

export class F22ARaptorExterior extends THREE.Group {
  constructor(options: F22ARaptorExteriorOptions = {}) {
    super(); this.name = "F-22A Raptor Exterior";
    loft(this,"BlendedFuselage",[
  {z:-8.2,width:.05,height:.05,y:.72},{z:-6.7,width:.45,height:.34,y:.76},{z:-4.6,width:.9,height:.52,y:.78},
  {z:-2.4,width:1.42,height:.48,y:.76},{z:.2,width:1.72,height:.42,y:.7},{z:3.6,width:1.45,height:.38,y:.65},{z:5.2,width:.55,height:.25,y:.65}
],Materials.body,20);
prismXZ(this,"LeftDiamondWing",[[-.9,-1.7],[-6.9,.35],[-5.8,2.25],[-1.05,2.9]],.13,.72,Materials.body);
prismXZ(this,"RightDiamondWing",[[.9,-1.7],[6.9,.35],[5.8,2.25],[1.05,2.9]],.13,.72,Materials.body);
prismXZ(this,"LeftTailplane",[[-.7,2.7],[-3.65,3.45],[-3.0,4.75],[-.8,4.15]],.1,.78,Materials.body);
prismXZ(this,"RightTailplane",[[.7,2.7],[3.65,3.45],[3.0,4.75],[.8,4.15]],.1,.78,Materials.body);
box(this,"LeftDiverterlessIntake",[.72,.54,1.8],[-1.14,.63,-2.05],Materials.bodyDark,[0,.08,0]);
box(this,"RightDiverterlessIntake",[.72,.54,1.8],[1.14,.63,-2.05],Materials.bodyDark,[0,-.08,0]);
box(this,"LeftIntakeMouth",[.56,.36,.03],[-1.23,.63,-2.96],Materials.intake,[0,.08,0]);
box(this,"RightIntakeMouth",[.56,.36,.03],[1.23,.63,-2.96],Materials.intake,[0,-.08,0]);
box(this,"LeftRectangularNozzle",[.72,.34,.72],[-.72,.66,4.82],Materials.exhaust);
box(this,"RightRectangularNozzle",[.72,.34,.72],[.72,.66,4.82],Materials.exhaust);
verticalFin(this,"LeftCantedTail",[[-.65,0],[-.3,2.8],[.35,3.15],[.65,.2]],-1.23,3.25,.12,-.36,Materials.body);
verticalFin(this,"RightCantedTail",[[-.65,0],[-.3,2.8],[.35,3.15],[.65,.2]],1.23,3.25,.12,.36,Materials.body);
canopyWedge(this,"GoldCanopy",2.7,1.02,.72,[0,1.18,-3.0],true);
box(this,"WeaponsBayOutline",[.82,.035,2.55],[0,.17,.8],Materials.bodyDark);
    if (options.landingGearDown ?? true) this.addLandingGear();
    const canopy=this.getObjectByName("GoldCanopy") ?? this.getObjectByName("SinglePieceCanopy") ?? this.getObjectByName("BubbleCanopy") ?? this.getObjectByName("FramedCanopy") ?? this.getObjectByName("ShortCanopy") ?? this.getObjectByName("FacetedCanopy") ?? this.getObjectByName("FlankerCanopy") ?? this.getObjectByName("ModernFlankerCanopy");
    if (options.canopyOpen && canopy) { canopy.rotation.x=-0.48; canopy.position.z += .55; canopy.position.y += .38; }
  }
  private addLandingGear(): void {
    cylinder(this,"NoseGearStrut",.045,.06,1.05,[0,-.48,-3.7],Materials.metal,[0,0,0],14); wheel(this,"NoseWheel",[0,-1.02,-3.7],.22,.13);
    for (const side of [-1,1]) { cylinder(this,side<0?"LeftMainStrut":"RightMainStrut",.06,.085,1.35,[side*1.05,-.35,.55],Materials.metal,[0,0,side*.18],14); wheel(this,side<0?"LeftMainWheel":"RightMainWheel",[side*1.25,-1.0,.55],.34,.17); }
  }
}
