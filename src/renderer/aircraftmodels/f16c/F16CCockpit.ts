import { ProceduralFighterCockpit } from "../core/ProceduralFighterCockpit";
import type { CockpitConfig } from "../core/types";

export const F16CCockpitConfig: CockpitConfig = {
  displayName: "F-16C Fighting Falcon", className: "F16C", tubWidth: 1.2, tubLength: 2.8, panelAngle: -0.11, screenLayout: "mixed",
  centerStick: false, sideStick: true, twinThrottle: false, hud: true, canopyBow: false, seatColor: 0x303533, accentColor: 0xffa000,
};

export class F16CCockpit extends ProceduralFighterCockpit {
  constructor() { super(F16CCockpitConfig); }
}
