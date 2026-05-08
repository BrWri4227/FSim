import type { RWRState, RWRThreat } from '../types/radar'
import type { AircraftState } from '../types/aircraft'
import type { Aircraft } from '../entities/Aircraft'
import { v3sub, v3len, RAD2DEG, quatRotateVec, quatConjugate } from '../utils/MathUtils'

export class RWR {
  state: RWRState = { threats: [], hasMissileLaunch: false }
  private seenMissileIds = new Set<string>()

  update(enemies: Aircraft[], ownState: AircraftState, ownId = 'player'): void {
    this.state.threats = []
    this.state.hasMissileLaunch = false  // reset each tick; addMissileThreats may set it

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
        priority: isSTT ? 4 : isTracked ? 3 : 1,
      })
    }
  }

  addMissileThreats(
    missiles: Array<{ id: string; positionNED: [number, number, number] }>,
    ownState: AircraftState,
  ): void {
    const currentIds = new Set(missiles.map(m => m.id))

    for (const m of missiles) {
      const toMissile = v3sub(m.positionNED, ownState.positionNED)
      const bodyVec = quatRotateVec(quatConjugate(ownState.attitudeQuat), toMissile)
      const azDeg = Math.atan2(bodyVec[1], bodyVec[0]) * RAD2DEG
      const distanceM = v3len(toMissile)

      // Detect new launches — flag so AudioManager can trigger voice callout
      if (!this.seenMissileIds.has(m.id)) {
        this.state.hasMissileLaunch = true
      }

      this.state.threats.push({
        entityId: m.id,
        azimuthDeg: azDeg,
        type: 'MISSILE',
        priority: 5,
        distanceM,
      })
    }

    // Expire IDs for missiles that are no longer active
    this.seenMissileIds = currentIds
  }
}
