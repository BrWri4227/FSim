import type { RWRState, RWRThreat } from '../types/radar'
import type { AircraftState } from '../types/aircraft'
import type { Aircraft } from '../entities/Aircraft'
import { v3sub, v3norm, v3dot, RAD2DEG, quatRotateVec, quatConjugate } from '../utils/MathUtils'

export class RWR {
  state: RWRState = { threats: [] }

  update(enemies: Aircraft[], ownState: AircraftState): void {
    this.state.threats = []
    for (const enemy of enemies) {
      if (!enemy.radar?.state || enemy.radar.state.mode === 'OFF') continue

      const rs = enemy.radar.state
      const toEnemy = v3sub(enemy.state.positionNED, ownState.positionNED)
      const bodyVec = quatRotateVec(quatConjugate(ownState.attitudeQuat), toEnemy)
      const azDeg = Math.atan2(bodyVec[1], bodyVec[0]) * RAD2DEG

      const isTracked = rs.tracks.some((t: import('../types/radar').RadarTrack) => t.entityId === 'player')
      const isSTT     = rs.mode === 'STT' && rs.sttTargetId === 'player'

      this.state.threats.push({
        entityId: enemy.entityId,
        azimuthDeg: azDeg,
        type: isSTT ? 'TRACK' : 'SEARCH',
        priority: isSTT ? 3 : 1
      })
    }
  }
}
