import { ProceduralFighterCockpit } from "../core/ProceduralFighterCockpit";
import type { CockpitConfig } from "../core/types";

export const F22ARaptorCockpitConfig: CockpitConfig = {
  displayName: "F-22A Raptor", className: "F22ARaptor", tubWidth: 1.35, tubLength: 3.0, panelAngle: -0.1, screenLayout: "panoramic",
  centerStick: true, sideStick: false, twinThrottle: true, hud: true, canopyBow: false, seatColor: 0x303533, accentColor: 0xffa000,
};

export class F22ARaptorCockpit extends ProceduralFighterCockpit {
  constructor() { super(F22ARaptorCockpitConfig); }
}
