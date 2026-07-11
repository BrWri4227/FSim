import { ProceduralFighterCockpit } from "../core/ProceduralFighterCockpit";
import type { CockpitConfig } from "../core/types";

export const Su27CockpitConfig: CockpitConfig = {
  displayName: "Su-27 Flanker", className: "Su27", tubWidth: 1.4, tubLength: 3.15, panelAngle: -0.1, screenLayout: "analog-heavy",
  centerStick: true, sideStick: false, twinThrottle: true, hud: true, canopyBow: true, seatColor: 0x303533, accentColor: 0xffa000,
};

export class Su27Cockpit extends ProceduralFighterCockpit {
  constructor() { super(Su27CockpitConfig); }
}
