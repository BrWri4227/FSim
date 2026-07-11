import { DetailedCockpit } from "../core/DetailedCockpit";

export class F22ARaptorCockpit extends DetailedCockpit {
  constructor() {
    super({
      name: "F-22A Raptor Cockpit",

      displays: [
        { name: "LeftMFD", position: [-0.34, 1.06, -0.99], size: [0.42, 0.34] },
        { name: "RightMFD", position: [0.34, 1.06, -0.99], size: [0.42, 0.34] },
        { name: "CenterDisplay", position: [0, 0.72, -1.06], size: [0.48, 0.24] },
      ], sideStick: true, dualThrottle: true, canopyGold: true, consoleRows: 8,
    });
  }
}
