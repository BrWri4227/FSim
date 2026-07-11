import { DetailedCockpit } from "../core/DetailedCockpit";

export class F35ACockpit extends DetailedCockpit {
  constructor() {
    super({
      name: "F-35A Cockpit",

      displays: [], panoramicDisplay: true, ufc: false, sideStick: true, dualThrottle: false,
      canopyGold: true, canopyHeight: 1.05, canopyLength: 2.7, consoleRows: 6, hud: false,
    });
  }
}
