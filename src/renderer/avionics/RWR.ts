import type { RWRState, RWRThreat } from '../types/radar'
import type { AircraftState } from '../types/aircraft'
import type { Aircraft } from '../entities/Aircraft'
import { v3sub, RAD2DEG, quatRotateVec, quatConjugate } from '../utils/MathUtils'

export class RWR {
  state: RWRState = { threats: [] }

  update(enemies: Aircraft[], ownState: AircraftState, ownId = 'player'): void {
    this.state.threats = []
    for (const enemy of enemies) {
      const toEnemy = v3sub(enemy.state.positionNED, ownState.positionNED)
      const bodyVec = quatRotateVec(quatConjugate(ownState.attitudeQuat), toEnemy)
      const azDeg = Math.atan2(bodyVec[1], bodyVec[0]) * RAD2DEG

      const ri = enemy.getRadarInfo()
      const isTracked = ri !== null && ri.tracksPlayer(ownId)
      const isSTT = isTracked && ri!.mode === 'STT'

      this.state.threats.push({
        entityId: enemy.entityId,
        azimuthDeg: azDeg,
        type: isSTT || isTracked ? 'TRACK' : 'SEARCH',
        priority: isSTT || isTracked ? 3 : 1,
      })
    }
  }

  addMissileThreats(missiles: Array<{ id: string; positionNED: [number, number, number] }>, ownState: AircraftState): void {
    for (const m of missiles) {
      const toMissile = v3sub(m.positionNED, ownState.positionNED)
      const bodyVec = quatRotateVec(quatConjugate(ownState.attitudeQuat), toMissile)
      const azDeg = Math.atan2(bodyVec[1], bodyVec[0]) * RAD2DEG
      this.state.threats.push({
        entityId: m.id,
        azimuthDeg: azDeg,
        type: 'MISSILE',
        priority: 3
      })
    }
  }
}
