import { ProceduralFighterExterior } from "../core/ProceduralFighterExterior";
import type { FighterExteriorConfig, FighterOptions } from "../core/types";

export const F15CExteriorConfig: FighterExteriorConfig = {
  displayName: "F-15C Eagle", className: "F15C", length: 19.4, fuselageRadius: 0.8, fuselageY: 0.85, noseLength: 4.2, bodyLength: 8.6,
  wing: { rootLeadingZ: -1.2, rootTrailingZ: 2.3, tipLeadingZ: -0.15, tipTrailingZ: 1.9, halfSpan: 6.55, thickness: 0.14, y: 0.72 },
  horizontalTail: { rootLeadingZ: 3.3, rootTrailingZ: 4.8, tipLeadingZ: 3.7, tipTrailingZ: 4.65, halfSpan: 3.8, thickness: 0.11, y: 0.84, xOffset: 0.72 },
  twinEngine: true, engineSpacing: 0.78, engineRadius: 0.53, engineZ: 1.5, intakeZ: -1.35, intakeSpacing: 1.0, intakeWidth: 0.76, intakeHeight: 0.58,
  twinTail: true, tailSpacing: 1.1, tailHeight: 3.2, tailSweep: 0.02, tailCant: 0.08, stealth: false,
  canards: false, lerx: false, dorsalSpine: true, ventralFins: false,
};

export class F15CExterior extends ProceduralFighterExterior {
  constructor(options: FighterOptions = {}) { super(F15CExteriorConfig, options); }
}
