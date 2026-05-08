import type { Vec3 } from '../types/common'
import type { DataLinkContact } from '../types/radar'
import type { Aircraft } from '../entities/Aircraft'
import { v3dist } from '../utils/MathUtils'

const ORBIT_RADIUS_M = 80000
const ORBIT_ALT_M    = 10000
const ORBIT_SPEED    = 0.012  // rad/s at ~850 km/h ground speed approximation
const RADAR_RANGE_M  = 300000
const BROADCAST_HZ   = 0.5   // every 2 seconds

export class AWACS {
  positionNED: Vec3 = [0, ORBIT_RADIUS_M, -ORBIT_ALT_M]
  picture: DataLinkContact[] = []

  private orbitAngle = 0
  private broadcastTimer = 0

  update(dt: number, allAircraft: Aircraft[], playerEntityId: string): void {
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
    for (const ac of allAircraft) {
      if (ac.entityId === playerEntityId) continue
      const dist = v3dist(this.positionNED, ac.state.positionNED)
      if (dist > RADAR_RANGE_M) continue

      contacts.push({
        entityId:       ac.entityId,
        positionNED:    [...ac.state.positionNED],
        velocityNED:    [...ac.state.velocityNED],
        classification: ac.spec.nation === 'RUS' ? 'HOSTILE' : 'FRIENDLY',
        confidence:     1.0,
        lastUpdateSec:  0
      })
    }
    this.picture = contacts
  }
}
