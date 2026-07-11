import { DetailedCockpit } from "../core/DetailedCockpit";

export class MiG29ACockpit extends DetailedCockpit {
  constructor() {
    super({
      name: "MiG-29A Cockpit",

      displays: [
        { name: "RadarDisplay", position: [0, 1.02, -1.0], size: [0.34, 0.28] },
      ], gauges: [
        { position: [-0.48, 1.20, -1.0] }, { position: [-0.36, 1.18, -1.0] },
        { position: [0.36, 1.18, -1.0] }, { position: [0.48, 1.20, -1.0] },
        { position: [-0.46, 0.72, -1.09] }, { position: [-0.32, 0.70, -1.09] },
        { position: [0.32, 0.70, -1.09] }, { position: [0.46, 0.72, -1.09] },
      ], russianStyle: true, sideStick: false, dualThrottle: true, consoleRows: 10,
    });
  }
}
