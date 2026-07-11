import { ProceduralFighterCockpit } from "../core/ProceduralFighterCockpit";
import type { CockpitConfig } from "../core/types";

export const F15CCockpitConfig: CockpitConfig = {
  displayName: "F-15C Eagle", className: "F15C", tubWidth: 1.36, tubLength: 3.05, panelAngle: -0.1, screenLayout: "analog-heavy",
  centerStick: true, sideStick: false, twinThrottle: true, hud: true, canopyBow: true, seatColor: 0x303533, accentColor: 0xffa000,
};

export class F15CCockpit extends ProceduralFighterCockpit {
  constructor() { super(F15CCockpitConfig); }
}
