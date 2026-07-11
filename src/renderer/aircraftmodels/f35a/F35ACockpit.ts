import { ProceduralFighterCockpit } from "../core/ProceduralFighterCockpit";
import type { CockpitConfig } from "../core/types";

export const F35ACockpitConfig: CockpitConfig = {
  displayName: "F-35A Lightning II", className: "F35A", tubWidth: 1.3, tubLength: 2.9, panelAngle: -0.1, screenLayout: "panoramic",
  centerStick: false, sideStick: true, twinThrottle: false, hud: false, canopyBow: false, seatColor: 0x303533, accentColor: 0xffa000,
};

export class F35ACockpit extends ProceduralFighterCockpit {
  constructor() { super(F35ACockpitConfig); }
}
