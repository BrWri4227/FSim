import type { Vec3 } from '../types/common'
import type { DataLinkContact } from '../types/radar'
import type { Aircraft } from '../entities/Aircraft'
import { v3dist } from '../utils/MathUtils'

const ORBIT_RADIUS_M = 80000
const ORBIT_ALT_M    = 10000
const ORBIT_SPEED    = 0.012  // rad/s at ~850 km/h ground speed approximation
const RADAR_RANGE_M  = 300000
const BROADCAST_HZ   = 0.5   // every 2 seconds

/**
 * BRA callout payload — emitted when AWACS detects a new hostile contact relative
 * to the player. Audio system synthesizes "Bandit, BRA <bearing> for <range>, angels <alt>".
 */
export interface AWACSBRACallout {
  bearingDeg: number       // magnetic bearing from player to bandit, 0..359
  rangeNm: number          // slant range in nautical miles (rounded)
  angelsKft: number        // bandit altitude in thousands of feet (rounded)
  closingMS: number
}

export class AWACS {
  positionNED: Vec3 = [0, ORBIT_RADIUS_M, -ORBIT_ALT_M]
  picture: DataLinkContact[] = []

  private orbitAngle = 0
  private broadcastTimer = 0
  /** IDs we've already called out, so we don't repeat on every broadcast tick. */
  private calledOutIds = new Set<string>()
  /** Callback fired once per new-bandit detection. */
  onBRACallout: ((c: AWACSBRACallout) => void) | null = null

  update(
    dt: number,
    allAircraft: Aircraft[],
    playerEntityId: string,
    playerPositionNED?: Vec3,
    playerNation: 'USA' | 'RUS' = 'USA',
  ): void {
    // Figure-8 orbit approximated as a circle for simplicity
    this.orbitAngle += ORBIT_SPEED * dt
    this.positionNED = [
      Math.cos(this.orbitAngle) * ORBIT_RADIUS_M,
      Math.sin(this.orbitAngle * 2) * (ORBIT_RADIUS_M / 2),
      -ORBIT_ALT_M
    ]

    this.broadcastTimer += dt
    if (this.broadcastTimer < 1 / BROADCAST_HZ) return
    this.broadcastTimer = 0

    const contacts: DataLinkContact[] = []
    const liveIds = new Set<string>()
    for (const ac of allAircraft) {
      if (ac.entityId === playerEntityId) continue
      const dist = v3dist(this.positionNED, ac.state.positionNED)
      if (dist > RADAR_RANGE_M) continue

      const classification = ac.spec.nation !== playerNation ? 'HOSTILE' : 'FRIENDLY'
      contacts.push({
        entityId:       ac.entityId,
        positionNED:    [...ac.state.positionNED],
        velocityNED:    [...ac.state.velocityNED],
        classification,
        confidence:     1.0,
        lastUpdateSec:  0
      })
      liveIds.add(ac.entityId)

      // Emit BRA callout once per new hostile, when we know the player position.
      if (
        classification === 'HOSTILE' &&
        playerPositionNED &&
        !this.calledOutIds.has(ac.entityId) &&
        this.onBRACallout
      ) {
        const dx = ac.state.positionNED[0] - playerPositionNED[0]
        const dy = ac.state.positionNED[1] - playerPositionNED[1]
        const dz = ac.state.positionNED[2] - playerPositionNED[2]
        const bearingRad = Math.atan2(dy, dx)
        const bearingDeg = ((bearingRad * 180 / Math.PI) + 360) % 360
        const rangeM = Math.hypot(dx, dy, dz)
        const banditAltM = -ac.state.positionNED[2]
        // Closing speed: dot of relative velocity onto -LOS unit vector
        const losInv = -1 / Math.max(rangeM, 1)
        const rvx = ac.state.velocityNED[0]
        const rvy = ac.state.velocityNED[1]
        const rvz = ac.state.velocityNED[2]
        const closingMS = (dx * rvx + dy * rvy + dz * rvz) * losInv
        this.onBRACallout({
          bearingDeg: Math.round(bearingDeg),
          rangeNm: Math.round(rangeM / 1852),
          angelsKft: Math.round(banditAltM * 3.281 / 1000),
          closingMS,
        })
        this.calledOutIds.add(ac.entityId)
      }
    }

    // Forget contacts that have left coverage so a re-detected bandit triggers a new callout.
    for (const id of this.calledOutIds) {
      if (!liveIds.has(id)) this.calledOutIds.delete(id)
    }

    this.picture = contacts
  }
}
