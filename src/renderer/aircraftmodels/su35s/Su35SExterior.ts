import { ProceduralFighterExterior } from "../core/ProceduralFighterExterior";
import type { FighterExteriorConfig, FighterOptions } from "../core/types";

export const Su35SExteriorConfig: FighterExteriorConfig = {
  displayName: "Su-35S Flanker-E", className: "Su35S", length: 21.9, fuselageRadius: 0.88, fuselageY: 0.86, noseLength: 4.6, bodyLength: 9.8,
  wing: { rootLeadingZ: -1.6, rootTrailingZ: 3.0, tipLeadingZ: -0.35, tipTrailingZ: 2.25, halfSpan: 7.35, thickness: 0.14, y: 0.74 },
  horizontalTail: { rootLeadingZ: 3.9, rootTrailingZ: 5.5, tipLeadingZ: 4.35, tipTrailingZ: 5.25, halfSpan: 4.35, thickness: 0.11, y: 0.86, xOffset: 0.8 },
  twinEngine: true, engineSpacing: 0.82, engineRadius: 0.57, engineZ: 1.72, intakeZ: -1.45, intakeSpacing: 1.04, intakeWidth: 0.8, intakeHeight: 0.58,
  twinTail: true, tailSpacing: 1.2, tailHeight: 3.15, tailSweep: 0.04, tailCant: 0.22, stealth: false,
  canards: false, lerx: true, dorsalSpine: true, ventralFins: true,
};

export class Su35SExterior extends ProceduralFighterExterior {
  constructor(options: FighterOptions = {}) { super(Su35SExteriorConfig, options); }
}
