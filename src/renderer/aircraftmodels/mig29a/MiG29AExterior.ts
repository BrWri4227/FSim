import { ProceduralFighterExterior } from "../core/ProceduralFighterExterior";
import type { FighterExteriorConfig, FighterOptions } from "../core/types";

export const MiG29AExteriorConfig: FighterExteriorConfig = {
  displayName: "MiG-29A Fulcrum", className: "MiG29A", length: 17.3, fuselageRadius: 0.78, fuselageY: 0.82, noseLength: 3.7, bodyLength: 7.6,
  wing: { rootLeadingZ: -1.25, rootTrailingZ: 2.2, tipLeadingZ: -0.2, tipTrailingZ: 1.85, halfSpan: 5.65, thickness: 0.13, y: 0.72 },
  horizontalTail: { rootLeadingZ: 3.0, rootTrailingZ: 4.25, tipLeadingZ: 3.35, tipTrailingZ: 4.1, halfSpan: 3.35, thickness: 0.1, y: 0.82, xOffset: 0.65 },
  twinEngine: true, engineSpacing: 0.72, engineRadius: 0.52, engineZ: 1.35, intakeZ: -1.25, intakeSpacing: 0.94, intakeWidth: 0.72, intakeHeight: 0.57,
  twinTail: true, tailSpacing: 1.02, tailHeight: 2.8, tailSweep: 0.04, tailCant: 0.22, stealth: false,
  canards: false, lerx: true, dorsalSpine: true, ventralFins: true,
};

export class MiG29AExterior extends ProceduralFighterExterior {
  constructor(options: FighterOptions = {}) { super(MiG29AExteriorConfig, options); }
}
