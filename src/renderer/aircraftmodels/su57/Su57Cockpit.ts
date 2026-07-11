import { ProceduralFighterCockpit } from "../core/ProceduralFighterCockpit";
import type { CockpitConfig } from "../core/types";

export const Su57CockpitConfig: CockpitConfig = {
  displayName: "Su-57 Felon", className: "Su57", tubWidth: 1.38, tubLength: 3.1, panelAngle: -0.1, screenLayout: "mixed",
  centerStick: true, sideStick: false, twinThrottle: true, hud: true, canopyBow: false, seatColor: 0x303533, accentColor: 0xffa000,
};

export class Su57Cockpit extends ProceduralFighterCockpit {
  constructor() { super(Su57CockpitConfig); }
}
