import { DetailedCockpit } from "../core/DetailedCockpit";

export class F15CCockpit extends DetailedCockpit {
  constructor() {
    super({
      name: "F-15C Cockpit",

      displays: [
        { name: "RadarScope", position: [0, 0.98, -1.0], size: [0.39, 0.34] },
      ], gauges: [
        { position: [-0.48, 1.18, -1.0] }, { position: [-0.36, 1.18, -1.0] },
        { position: [0.36, 1.18, -1.0] }, { position: [0.48, 1.18, -1.0] },
        { position: [-0.46, 0.72, -1.09] }, { position: [-0.32, 0.70, -1.09] },
        { position: [0.32, 0.70, -1.09] }, { position: [0.46, 0.72, -1.09] },
      ], sideStick: false, dualThrottle: true, consoleRows: 10,
    });
  }
}
