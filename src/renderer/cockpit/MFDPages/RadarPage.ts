import type { RadarState } from '../../types/radar'
import type { Vec3, Quat } from '../../types/common'
import { drawRadarScope, type RadarDLZ } from '../../ui/HUDElements/RadarScope'

/**
 * Full-fidelity B-scope on the MFD — shares the HUD's `drawRadarScope` renderer
 * so the MFD gets leader lines, altitude tags, coast fade, TWS/GMTI symbology
 * and the DLZ staple.
 */
export function drawRadarPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  radar: RadarState,
  ownPos: Vec3,
  ownAttitudeQuat?: Quat,
  ownVelNED?: Vec3,
  dlz?: RadarDLZ,
): void {
  ctx.fillStyle = '#001100'
  ctx.fillRect(0, 0, w, h)
  drawRadarScope(ctx, 4, 18, w - 8, h - 26, radar, ownPos, ownAttitudeQuat, ownVelNED, dlz)
}
