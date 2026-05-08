import type { HMSState } from '../types/ir'
import type { AircraftState } from '../types/aircraft'

export class HMS {
  state: HMSState = {
    cursorAzDeg: 0, cursorElDeg: 0,
    locked: false, lockedEntityId: null, enabled: true
  }

  update(ownState: AircraftState): void {
    // HMS cursor follows cockpit camera head-look direction
    // Actual update driven by CockpitCamera via head az/el
  }

  setHeadDir(azDeg: number, elDeg: number): void {
    this.state.cursorAzDeg = azDeg
    this.state.cursorElDeg = elDeg
  }

  lockOn(entityId: string): void {
    this.state.locked = true
    this.state.lockedEntityId = entityId
  }

  breakLock(): void {
    this.state.locked = false
    this.state.lockedEntityId = null
  }
}
