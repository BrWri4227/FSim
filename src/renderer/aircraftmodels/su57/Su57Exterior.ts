import { ProceduralFighterExterior } from "../core/ProceduralFighterExterior";
import type { FighterExteriorConfig, FighterOptions } from "../core/types";

export const Su57ExteriorConfig: FighterExteriorConfig = {
  displayName: "Su-57 Felon", className: "Su57", length: 20.1, fuselageRadius: 0.86, fuselageY: 0.82, noseLength: 4.4, bodyLength: 9.0,
  wing: { rootLeadingZ: -1.55, rootTrailingZ: 2.9, tipLeadingZ: -0.4, tipTrailingZ: 2.15, halfSpan: 7.15, thickness: 0.13, y: 0.72 },
  horizontalTail: { rootLeadingZ: 3.5, rootTrailingZ: 5.0, tipLeadingZ: 3.95, tipTrailingZ: 4.8, halfSpan: 4.1, thickness: 0.1, y: 0.84, xOffset: 0.75 },
  twinEngine: true, engineSpacing: 0.78, engineRadius: 0.55, engineZ: 1.55, intakeZ: -1.35, intakeSpacing: 1.05, intakeWidth: 0.78, intakeHeight: 0.5,
  twinTail: true, tailSpacing: 1.2, tailHeight: 2.25, tailSweep: 0.03, tailCant: 0.36, stealth: true,
  canards: false, lerx: true, dorsalSpine: true, ventralFins: false,
};

export class Su57Exterior extends ProceduralFighterExterior {
  constructor(options: FighterOptions = {}) { super(Su57ExteriorConfig, options); }
}
