import type { AircraftState } from '../types/aircraft'
import { mToFt } from '../utils/Units'

export class GPWS {
  private lastAltFt = 0
  private warningCooldown = 0
  private readonly WARN_INTERVAL = 3.0

  update(state: AircraftState, dt: number, audioCallback: (event: 'PULL_UP' | 'PULL_UP_URGENT') => void): void {
    if (this.warningCooldown > 0) {
      this.warningCooldown -= dt
    }

    const altFt = mToFt(-state.positionNED[2])
    const climbRateFtMin = (altFt - this.lastAltFt) / dt * 60
    this.lastAltFt = altFt

    const descending = climbRateFtMin < -200

    if (this.warningCooldown <= 0) {
      if (altFt < 200 && descending) {
        audioCallback('PULL_UP_URGENT')
        this.warningCooldown = 1.5
      } else if (altFt < 500 && descending) {
        audioCallback('PULL_UP')
        this.warningCooldown = this.WARN_INTERVAL
      }
    }
  }
}
