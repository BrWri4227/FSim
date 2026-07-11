import { ProceduralFighterExterior } from "../core/ProceduralFighterExterior";
import type { FighterExteriorConfig, FighterOptions } from "../core/types";

export const Su27ExteriorConfig: FighterExteriorConfig = {
  displayName: "Su-27 Flanker", className: "Su27", length: 21.9, fuselageRadius: 0.86, fuselageY: 0.85, noseLength: 4.6, bodyLength: 9.8,
  wing: { rootLeadingZ: -1.6, rootTrailingZ: 3.0, tipLeadingZ: -0.35, tipTrailingZ: 2.25, halfSpan: 7.35, thickness: 0.14, y: 0.74 },
  horizontalTail: { rootLeadingZ: 3.9, rootTrailingZ: 5.5, tipLeadingZ: 4.35, tipTrailingZ: 5.25, halfSpan: 4.35, thickness: 0.11, y: 0.86, xOffset: 0.8 },
  twinEngine: true, engineSpacing: 0.8, engineRadius: 0.56, engineZ: 1.72, intakeZ: -1.45, intakeSpacing: 1.02, intakeWidth: 0.78, intakeHeight: 0.58,
  twinTail: true, tailSpacing: 1.18, tailHeight: 3.2, tailSweep: 0.04, tailCant: 0.2, stealth: false,
  canards: false, lerx: true, dorsalSpine: true, ventralFins: true,
};

export class Su27Exterior extends ProceduralFighterExterior {
  constructor(options: FighterOptions = {}) { super(Su27ExteriorConfig, options); }
}
