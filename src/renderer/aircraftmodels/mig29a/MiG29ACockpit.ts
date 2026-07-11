import { ProceduralFighterCockpit } from "../core/ProceduralFighterCockpit";
import type { CockpitConfig } from "../core/types";

export const MiG29ACockpitConfig: CockpitConfig = {
  displayName: "MiG-29A Fulcrum", className: "MiG29A", tubWidth: 1.3, tubLength: 2.95, panelAngle: -0.1, screenLayout: "analog-heavy",
  centerStick: true, sideStick: false, twinThrottle: true, hud: true, canopyBow: true, seatColor: 0x303533, accentColor: 0xffa000,
};

export class MiG29ACockpit extends ProceduralFighterCockpit {
  constructor() { super(MiG29ACockpitConfig); }
}
