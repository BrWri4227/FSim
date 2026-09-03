import type { Vec3, Quat } from '../../types/common'
import { quatConjugate, quatRotateVec, RAD2DEG } from '../../utils/MathUtils'

/**
 * Project a world point into aircraft-boresight angle space for a collimated
 * HUD combiner. The combiner texture is body-fixed (it does not follow head
 * look), so symbology only needs azimuth / elevation relative to the nose —
 * no camera required.
 */
export interface BoresightAngles {
  /** Azimuth right of the nose (deg). */
  azDeg: number
  /** Elevation above the nose (deg). */
  elDeg: number
  /** Slant range own→point (m). */
  rangeM: number
  /** False when the point is at or behind the wing line (az/el then clamped to ±90). */
  ahead: boolean
}

export function boresightAngles(ownPos: Vec3, ownQuat: Quat, worldPos: Vec3): BoresightAngles {
  const rel: Vec3 = [worldPos[0] - ownPos[0], worldPos[1] - ownPos[1], worldPos[2] - ownPos[2]]
  const rangeM = Math.hypot(rel[0], rel[1], rel[2])
  // Body frame: x forward, y right, z down.
  const body = quatRotateVec(quatConjugate(ownQuat), rel)
  const fwd = body[0]
  const ahead = fwd > 1e-3
  const horiz = Math.max(1e-3, Math.hypot(fwd, body[1]))
  const azDeg = Math.atan2(body[1], ahead ? fwd : 1e-3) * RAD2DEG
  const elDeg = Math.atan2(-body[2], ahead ? horiz : 1e-3) * RAD2DEG
  return { azDeg, elDeg, rangeM, ahead }
}

/** Maps boresight az/el (deg) to combiner-texture pixels for a given FOV. */
export class HudProjection {
  readonly w: number
  readonly h: number
  readonly cx: number
  readonly cy: number
  readonly pxPerDegH: number
  readonly pxPerDegV: number
  readonly fovHDeg: number
  readonly fovVDeg: number

  constructor(w: number, h: number, fovHDeg: number, fovVDeg: number) {
    this.w = w
    this.h = h
    this.cx = w / 2
    this.cy = h / 2
    this.fovHDeg = fovHDeg
    this.fovVDeg = fovVDeg
    this.pxPerDegH = (w / 2) / fovHDeg
    this.pxPerDegV = (h / 2) / fovVDeg
  }

  /** az/el (deg) → texture pixel. */
  toPx(azDeg: number, elDeg: number): { x: number; y: number } {
    return { x: this.cx + azDeg * this.pxPerDegH, y: this.cy - elDeg * this.pxPerDegV }
  }

  /** True when az/el fall inside the visible glass rectangle (with optional margin in deg). */
  inFov(azDeg: number, elDeg: number, marginDeg = 0): boolean {
    return (
      Math.abs(azDeg) <= this.fovHDeg - marginDeg &&
      Math.abs(elDeg) <= this.fovVDeg - marginDeg
    )
  }

  /** Clamp a point to the glass edge and report the edge angle for a locator caret. */
  clampToEdge(azDeg: number, elDeg: number): { x: number; y: number; angleRad: number } {
    const a = Math.atan2(-elDeg, azDeg)
    const hx = this.fovHDeg * this.pxPerDegH
    const hy = this.fovVDeg * this.pxPerDegV
    // Scale the direction vector so it lands on the tighter axis.
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const sx = dx !== 0 ? hx / Math.abs(dx) : Infinity
    const sy = dy !== 0 ? hy / Math.abs(dy) : Infinity
    const s = Math.min(sx, sy)
    return { x: this.cx + dx * s, y: this.cy + dy * s, angleRad: a }
  }
}
