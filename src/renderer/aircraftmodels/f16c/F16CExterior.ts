import { ProceduralFighterExterior } from "../core/ProceduralFighterExterior";
import type { FighterExteriorConfig, FighterOptions } from "../core/types";

export const F16CExteriorConfig: FighterExteriorConfig = {
  displayName: "F-16C Fighting Falcon", className: "F16C", length: 15.1, fuselageRadius: 0.62, fuselageY: 0.75, noseLength: 3.6, bodyLength: 6.8,
  wing: { rootLeadingZ: -0.6, rootTrailingZ: 2.0, tipLeadingZ: 0.3, tipTrailingZ: 1.65, halfSpan: 4.75, thickness: 0.11, y: 0.68 },
  horizontalTail: { rootLeadingZ: 2.7, rootTrailingZ: 3.8, tipLeadingZ: 3.1, tipTrailingZ: 3.65, halfSpan: 2.6, thickness: 0.09, y: 0.76, xOffset: 0.45 },
  twinEngine: false, engineSpacing: 0, engineRadius: 0.5, engineZ: 1.15, intakeZ: -1.05, intakeSpacing: 0, intakeWidth: 0.82, intakeHeight: 0.5,
  twinTail: false, tailSpacing: 0, tailHeight: 2.8, tailSweep: 0, tailCant: 0, stealth: false,
  canards: false, lerx: true, dorsalSpine: true, ventralFins: true,
};

export class F16CExterior extends ProceduralFighterExterior {
  constructor(options: FighterOptions = {}) { super(F16CExteriorConfig, options); }
}
