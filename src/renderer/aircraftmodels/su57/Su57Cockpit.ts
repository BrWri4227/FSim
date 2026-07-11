import { DetailedCockpit } from "../core/DetailedCockpit";

export class Su57Cockpit extends DetailedCockpit {
  constructor() {
    super({
      name: "Su-57 Cockpit",

      displays: [
        { name: "LeftLargeDisplay", position: [-0.27, 1.02, -0.99], size: [0.46, 0.42], buttons: false },
        { name: "RightLargeDisplay", position: [0.27, 1.02, -0.99], size: [0.46, 0.42], buttons: false },
      ], russianStyle: true, sideStick: true, dualThrottle: true, canopyGold: true, consoleRows: 7,
    });
  }
}
