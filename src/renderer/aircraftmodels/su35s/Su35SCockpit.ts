import { DetailedCockpit } from "../core/DetailedCockpit";

export class Su35SCockpit extends DetailedCockpit {
  constructor() {
    super({
      name: "Su-35S Cockpit",

      displays: [
        { name: "LeftMFD", position: [-0.28, 1.02, -0.99], size: [0.43, 0.38] },
        { name: "RightMFD", position: [0.28, 1.02, -0.99], size: [0.43, 0.38] },
      ], gauges: [{ position: [-0.47, 0.70, -1.09] }, { position: [0.47, 0.70, -1.09] }],
      russianStyle: true, sideStick: false, dualThrottle: true, consoleRows: 8,
    });
  }
}
