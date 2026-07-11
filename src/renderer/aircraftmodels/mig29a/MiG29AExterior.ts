import * as THREE from "three";
import { Materials, loft, prismXZ, box, cylinder, capsule, verticalFin, canopyWedge, wheel } from "../core/MeshTools";

export interface MiG29AExteriorOptions { landingGearDown?: boolean; canopyOpen?: boolean; }

export class MiG29AExterior extends THREE.Group {
  constructor(options: MiG29AExteriorOptions = {}) {
    super(); this.name = "MiG-29A Fulcrum Exterior";
    loft(this,"CompactForwardBody",[
  {z:-7.2,width:.04,height:.04,y:.72},{z:-5.7,width:.38,height:.32,y:.75},{z:-3.8,width:.75,height:.52,y:.78},
  {z:-1.6,width:1.25,height:.58,y:.68},{z:.9,width:1.35,height:.48,y:.58},{z:3.9,width:.86,height:.38,y:.54},{z:4.8,width:.32,height:.2,y:.54}
],Materials.body,18);
prismXZ(this,"LeftRoundedLERX",[[-.45,-3.0],[-1.85,-1.55],[-2.25,-.3],[-.68,-.9]],.13,.72,Materials.body);
prismXZ(this,"RightRoundedLERX",[[.45,-3.0],[1.85,-1.55],[2.25,-.3],[.68,-.9]],.13,.72,Materials.body);
prismXZ(this,"LeftSweptWing",[[-.72,-.7],[-5.35,.45],[-4.5,2.35],[-.9,2.4]],.13,.7,Materials.body);
prismXZ(this,"RightSweptWing",[[.72,-.7],[5.35,.45],[4.5,2.35],[.9,2.4]],.13,.7,Materials.body);
capsule(this,"LeftEnginePod",.48,4.2,[-.82,.38,1.45],Materials.bodyDark,[1,.8,1]);
capsule(this,"RightEnginePod",.48,4.2,[.82,.38,1.45],Materials.bodyDark,[1,.8,1]);
box(this,"CentralTunnel",[.7,.28,4.0],[0,.18,1.2],Materials.bodyDark);
box(this,"LeftIntake",[.68,.55,.05],[-.84,.3,-1.35],Materials.intake,[0,.08,0]);
box(this,"RightIntake",[.68,.55,.05],[.84,.3,-1.35],Materials.intake,[0,-.08,0]);
for(let i=0;i<5;i++){box(this,'LeftAuxDoor'+i,[.11,.02,.28],[-.82+i*.0,.77,-1.15+i*.24],Materials.bodyDark);box(this,'RightAuxDoor'+i,[.11,.02,.28],[.82,.77,-1.15+i*.24],Materials.bodyDark);}
cylinder(this,"LeftNozzle",.4,.35,.68,[-.82,.4,4.52],Materials.exhaust,[Math.PI/2,0,0],26);
cylinder(this,"RightNozzle",.4,.35,.68,[.82,.4,4.52],Materials.exhaust,[Math.PI/2,0,0],26);
verticalFin(this,"LeftTail",[[-.55,0],[-.25,2.55],[.25,2.82],[.58,.15]],-1.12,2.75,.12,-.2,Materials.body);
verticalFin(this,"RightTail",[[-.55,0],[-.25,2.55],[.25,2.82],[.58,.15]],1.12,2.75,.12,.2,Materials.body);
prismXZ(this,"LeftTailplane",[[-.5,2.45],[-3.1,3.1],[-2.55,4.15],[-.62,3.8]],.1,.67,Materials.body);
prismXZ(this,"RightTailplane",[[.5,2.45],[3.1,3.1],[2.55,4.15],[.62,3.8]],.1,.67,Materials.body);
canopyWedge(this,"ShortCanopy",2.15,.84,.7,[0,1.24,-2.75],false);
    if (options.landingGearDown ?? true) this.addLandingGear();
    const canopy=this.getObjectByName("GoldCanopy") ?? this.getObjectByName("SinglePieceCanopy") ?? this.getObjectByName("BubbleCanopy") ?? this.getObjectByName("FramedCanopy") ?? this.getObjectByName("ShortCanopy") ?? this.getObjectByName("FacetedCanopy") ?? this.getObjectByName("FlankerCanopy") ?? this.getObjectByName("ModernFlankerCanopy");
    if (options.canopyOpen && canopy) { canopy.rotation.x=-0.48; canopy.position.z += .55; canopy.position.y += .38; }
  }
  private addLandingGear(): void {
    cylinder(this,"NoseGearStrut",.045,.06,1.05,[0,-.48,-3.7],Materials.metal,[0,0,0],14); wheel(this,"NoseWheel",[0,-1.02,-3.7],.22,.13);
    for (const side of [-1,1]) { cylinder(this,side<0?"LeftMainStrut":"RightMainStrut",.06,.085,1.35,[side*1.05,-.35,.55],Materials.metal,[0,0,side*.18],14); wheel(this,side<0?"LeftMainWheel":"RightMainWheel",[side*1.25,-1.0,.55],.34,.17); }
  }
}
