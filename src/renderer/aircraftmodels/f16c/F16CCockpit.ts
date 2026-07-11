import { DetailedCockpit } from "../core/DetailedCockpit";

export class F16CCockpit extends DetailedCockpit {
  constructor() {
    super({
      name: "F-16C Cockpit",

      displays: [
        { name: "LeftMFD", position: [-0.33, 0.98, -0.99], size: [0.35, 0.3] },
        { name: "RightMFD", position: [0.33, 0.98, -0.99], size: [0.35, 0.3] },
      ], gauges: [
        { position: [-0.48, 0.70, -1.11] }, { position: [-0.36, 0.68, -1.11] },
        { position: [0.36, 0.68, -1.11] }, { position: [0.48, 0.70, -1.11] },
      ], sideStick: true, dualThrottle: false, canopyHeight: 1.15, canopyLength: 2.8,
    });
  }
}
