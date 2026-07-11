import { ProceduralFighterExterior } from "../core/ProceduralFighterExterior";
import type { FighterExteriorConfig, FighterOptions } from "../core/types";

export const F35AExteriorConfig: FighterExteriorConfig = {
  displayName: "F-35A Lightning II", className: "F35A", length: 15.7, fuselageRadius: 0.76, fuselageY: 0.8, noseLength: 3.4, bodyLength: 7.2,
  wing: { rootLeadingZ: -0.9, rootTrailingZ: 2.4, tipLeadingZ: 0.0, tipTrailingZ: 1.8, halfSpan: 5.35, thickness: 0.13, y: 0.72 },
  horizontalTail: { rootLeadingZ: 2.7, rootTrailingZ: 4.0, tipLeadingZ: 3.0, tipTrailingZ: 3.9, halfSpan: 3.1, thickness: 0.1, y: 0.82, xOffset: 0.58 },
  twinEngine: false, engineSpacing: 0, engineRadius: 0.58, engineZ: 1.2, intakeZ: -1.05, intakeSpacing: 0.84, intakeWidth: 0.68, intakeHeight: 0.55,
  twinTail: true, tailSpacing: 0.92, tailHeight: 2.35, tailSweep: 0.03, tailCant: 0.3, stealth: true,
  canards: false, lerx: true, dorsalSpine: true, ventralFins: false,
};

export class F35AExterior extends ProceduralFighterExterior {
  constructor(options: FighterOptions = {}) { super(F35AExteriorConfig, options); }
}
