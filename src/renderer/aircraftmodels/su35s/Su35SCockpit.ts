import { ProceduralFighterCockpit } from "../core/ProceduralFighterCockpit";
import type { CockpitConfig } from "../core/types";

export const Su35SCockpitConfig: CockpitConfig = {
  displayName: "Su-35S Flanker-E", className: "Su35S", tubWidth: 1.42, tubLength: 3.15, panelAngle: -0.1, screenLayout: "mixed",
  centerStick: true, sideStick: false, twinThrottle: true, hud: true, canopyBow: true, seatColor: 0x303533, accentColor: 0xffa000,
};

export class Su35SCockpit extends ProceduralFighterCockpit {
  constructor() { super(Su35SCockpitConfig); }
}
