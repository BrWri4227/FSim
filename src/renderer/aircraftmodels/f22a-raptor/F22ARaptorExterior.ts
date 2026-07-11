import { ProceduralFighterExterior } from "../core/ProceduralFighterExterior";
import type { FighterExteriorConfig, FighterOptions } from "../core/types";

export const F22ARaptorExteriorConfig: FighterExteriorConfig = {
  displayName: "F-22A Raptor", className: "F22ARaptor", length: 18.9, fuselageRadius: 0.8, fuselageY: 0.8, noseLength: 4.0, bodyLength: 8.4,
  wing: { rootLeadingZ: -1.3, rootTrailingZ: 2.7, tipLeadingZ: -0.2, tipTrailingZ: 2.0, halfSpan: 6.75, thickness: 0.13, y: 0.72 },
  horizontalTail: { rootLeadingZ: 3.1, rootTrailingZ: 4.6, tipLeadingZ: 3.5, tipTrailingZ: 4.55, halfSpan: 3.9, thickness: 0.11, y: 0.84, xOffset: 0.7 },
  twinEngine: true, engineSpacing: 0.72, engineRadius: 0.52, engineZ: 1.4, intakeZ: -1.2, intakeSpacing: 1.0, intakeWidth: 0.72, intakeHeight: 0.52,
  twinTail: true, tailSpacing: 1.15, tailHeight: 2.8, tailSweep: 0.04, tailCant: 0.32, stealth: true,
  canards: false, lerx: true, dorsalSpine: true, ventralFins: false,
};

export class F22ARaptorExterior extends ProceduralFighterExterior {
  constructor(options: FighterOptions = {}) { super(F22ARaptorExteriorConfig, options); }
}
