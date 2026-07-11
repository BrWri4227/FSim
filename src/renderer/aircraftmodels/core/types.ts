import * as THREE from "three";

export type WingPlanform = {
  rootLeadingZ: number;
  rootTrailingZ: number;
  tipLeadingZ: number;
  tipTrailingZ: number;
  halfSpan: number;
  thickness: number;
  y: number;
};

export type TailPlanform = WingPlanform & {
  xOffset: number;
};

export interface FighterExteriorConfig {
  displayName: string;
  className: string;
  length: number;
  fuselageRadius: number;
  fuselageY: number;
  noseLength: number;
  bodyLength: number;
  wing: WingPlanform;
  horizontalTail: TailPlanform;
  twinEngine: boolean;
  engineSpacing: number;
  engineRadius: number;
  engineZ: number;
  intakeZ: number;
  intakeSpacing: number;
  intakeWidth: number;
  intakeHeight: number;
  twinTail: boolean;
  tailSpacing: number;
  tailHeight: number;
  tailSweep: number;
  tailCant: number;
  stealth: boolean;
  canards?: boolean;
  lerx?: boolean;
  dorsalSpine?: boolean;
  ventralFins?: boolean;
}

export interface CockpitConfig {
  displayName: string;
  className: string;
  tubWidth: number;
  tubLength: number;
  panelAngle: number;
  screenLayout: "three-mfd" | "panoramic" | "mixed" | "analog-heavy";
  centerStick: boolean;
  sideStick: boolean;
  twinThrottle: boolean;
  hud: boolean;
  canopyBow: boolean;
  seatColor: number;
  accentColor: number;
}

export interface FighterOptions {
  landingGearDown?: boolean;
  canopyOpen?: boolean;
  showStores?: boolean;
}

export const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
