import * as THREE from "three";
import { Materials, loft, prismXZ, box, cylinder, capsule, verticalFin, canopyWedge, wheel } from "../core/MeshTools";

export interface Su27ExteriorOptions { landingGearDown?: boolean; canopyOpen?: boolean; }

export class Su27Exterior extends THREE.Group {
  constructor(options: Su27ExteriorOptions = {}) {
    super(); this.name = "Su-27 Flanker Exterior";
    loft(this,"LongFlankerForwardBody",[
  {z:-10.0,width:.03,height:.03,y:.72},{z:-8.0,width:.36,height:.3,y:.74},{z:-5.5,width:.72,height:.48,y:.76},
  {z:-3.1,width:1.05,height:.56,y:.7},{z:-1.0,width:1.45,height:.5,y:.62},{z:2.8,width:1.55,height:.4,y:.54},{z:5.1,width:.62,height:.25,y:.53}
],Materials.bodyLight,20);
prismXZ(this,"LeftCurvedLERX",[[-.4,-4.3],[-1.6,-3.0],[-2.65,-.9],[-.75,-1.5]],.13,.69,Materials.bodyLight);
prismXZ(this,"RightCurvedLERX",[[.4,-4.3],[1.6,-3.0],[2.65,-.9],[.75,-1.5]],.13,.69,Materials.bodyLight);
prismXZ(this,"LeftFlankerWing",[[-.75,-1.4],[-7.25,.45],[-6.25,3.0],[-1.0,3.15]],.14,.67,Materials.bodyLight);
prismXZ(this,"RightFlankerWing",[[.75,-1.4],[7.25,.45],[6.25,3.0],[1.0,3.15]],.14,.67,Materials.bodyLight);
capsule(this,"LeftUnderslungEngine",.56,5.2,[-1.0,.26,1.8],Materials.bodyDark,[1,.7,1]);
capsule(this,"RightUnderslungEngine",.56,5.2,[1.0,.26,1.8],Materials.bodyDark,[1,.7,1]);
box(this,"DeepCentralTunnel",[.85,.28,4.8],[0,.0,1.65],Materials.bodyDark);
box(this,"LeftIntake",[.78,.62,.05],[-1.02,.22,-1.45],Materials.intake);
box(this,"RightIntake",[.78,.62,.05],[1.02,.22,-1.45],Materials.intake);
cylinder(this,"LeftNozzle",.44,.38,.75,[-1.0,.3,5.25],Materials.exhaust,[Math.PI/2,0,0],28);
cylinder(this,"RightNozzle",.44,.38,.75,[1.0,.3,5.25],Materials.exhaust,[Math.PI/2,0,0],28);
verticalFin(this,"LeftTallTail",[[-.58,0],[-.28,2.95],[.26,3.25],[.6,.14]],-1.28,3.0,.13,-.12,Materials.bodyLight);
verticalFin(this,"RightTallTail",[[-.58,0],[-.28,2.95],[.26,3.25],[.6,.14]],1.28,3.0,.13,.12,Materials.bodyLight);
prismXZ(this,"LeftTailplane",[[-.62,3.0],[-3.85,3.7],[-3.2,5.0],[-.72,4.45]],.11,.64,Materials.bodyLight);
prismXZ(this,"RightTailplane",[[.62,3.0],[3.85,3.7],[3.2,5.0],[.72,4.45]],.11,.64,Materials.bodyLight);
box(this,"LongTailBoom",[.38,.3,2.4],[0,.5,5.35],Materials.bodyLight);
canopyWedge(this,"FlankerCanopy",2.65,.9,.76,[0,1.22,-3.75],false);
    if (options.landingGearDown ?? true) this.addLandingGear();
    const canopy=this.getObjectByName("GoldCanopy") ?? this.getObjectByName("SinglePieceCanopy") ?? this.getObjectByName("BubbleCanopy") ?? this.getObjectByName("FramedCanopy") ?? this.getObjectByName("ShortCanopy") ?? this.getObjectByName("FacetedCanopy") ?? this.getObjectByName("FlankerCanopy") ?? this.getObjectByName("ModernFlankerCanopy");
    if (options.canopyOpen && canopy) { canopy.rotation.x=-0.48; canopy.position.z += .55; canopy.position.y += .38; }
  }
  private addLandingGear(): void {
    cylinder(this,"NoseGearStrut",.045,.06,1.05,[0,-.48,-3.7],Materials.metal,[0,0,0],14); wheel(this,"NoseWheel",[0,-1.02,-3.7],.22,.13);
    for (const side of [-1,1]) { cylinder(this,side<0?"LeftMainStrut":"RightMainStrut",.06,.085,1.35,[side*1.05,-.35,.55],Materials.metal,[0,0,side*.18],14); wheel(this,side<0?"LeftMainWheel":"RightMainWheel",[side*1.25,-1.0,.55],.34,.17); }
  }
}
