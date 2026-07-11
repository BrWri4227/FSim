import type { AircraftState } from '../types/aircraft'
import { getAGLM } from '../scene/Terrain'
import { mToFt } from '../utils/Units'

export class GPWS {
  private lastAglFt = 0
  private warningCooldown = 0
  private readonly WARN_INTERVAL = 3.0

  update(state: AircraftState, dt: number, audioCallback: (event: 'PULL_UP' | 'PULL_UP_URGENT') => void): void {
    if (this.warningCooldown > 0) {
      this.warningCooldown -= dt
    }

    const aglFt = mToFt(getAGLM(state.positionNED))
    const climbRateFtMin = (aglFt - this.lastAglFt) / dt * 60
    this.lastAglFt = aglFt

    const descending = climbRateFtMin < -200

    if (this.warningCooldown <= 0) {
      if (aglFt < 200 && descending) {
        audioCallback('PULL_UP_URGENT')
        this.warningCooldown = 1.5
      } else if (aglFt < 500 && descending) {
        audioCallback('PULL_UP')
        this.warningCooldown = this.WARN_INTERVAL
      }
    }
  }
}
