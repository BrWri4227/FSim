import type {
  MissionObjective,
  MissionOutcome,
  ScenarioDescriptor,
  WinCondition,
} from '../types/mission'

export interface MissionTickState {
  elapsedSec: number
  enemyKills: number
  groundKills: number
  enemiesRemaining: number
  groundRemaining: number
  playerEjected: boolean
  playerKilled: boolean
  /** True when this sortie began on the runway (enables the `takeoff` objective). */
  startedOnRunway?: boolean
  /** Latched true once the aircraft has climbed clear of the ground. */
  hasBeenAirborne?: boolean
  /** True while the aircraft sits on the runway after a survivable landing. */
  landedSafely?: boolean
}

export interface MissionEvaluation {
  outcome: MissionOutcome | null
  completedObjectiveIds: string[]
}

export class MissionTracker {
  private readonly primaryObjectives: MissionObjective[]
  readonly scenario: ScenarioDescriptor
  private readonly initialEnemyCount: number
  private readonly initialGroundCount: number

  constructor(scenario: ScenarioDescriptor, spawnCounts: { enemies: number; groundTargets: number }) {
    this.scenario = scenario
    this.primaryObjectives = scenario.objectives.filter(o => !o.optional)
    this.initialEnemyCount = spawnCounts.enemies
    this.initialGroundCount = spawnCounts.groundTargets
  }

  evaluate(state: MissionTickState): MissionEvaluation {
    const completedObjectiveIds = this.evaluateObjectives(state)

    if (this.scenario.loseConditions.length > 0) {
      if (this.scenario.loseConditions.includes('player_ejected') && state.playerEjected) {
        return { outcome: 'ejected', completedObjectiveIds }
      }
      if (this.scenario.loseConditions.includes('player_killed') && state.playerKilled) {
        return { outcome: 'killed', completedObjectiveIds }
      }
      if (
        this.scenario.loseConditions.includes('time_limit') &&
        this.scenario.timeLimitSec !== undefined &&
        state.elapsedSec >= this.scenario.timeLimitSec
      ) {
        return { outcome: 'failure', completedObjectiveIds }
      }
    }

    if (this.scenario.winConditions.length === 0) {
      return { outcome: null, completedObjectiveIds }
    }

    if (this.checkWin(completedObjectiveIds, state)) {
      return { outcome: 'success', completedObjectiveIds }
    }

    return { outcome: null, completedObjectiveIds }
  }

  getObjectiveLabels(completedIds: readonly string[]): string[] {
    return this.scenario.objectives.map(obj => {
      const done = completedIds.includes(obj.id)
      return `${done ? '[x]' : '[ ]'} ${obj.description}`
    })
  }

  get primaryObjectiveCount(): number {
    return this.primaryObjectives.length
  }

  private evaluateObjectives(state: MissionTickState): string[] {
    const done: string[] = []
    for (const obj of this.scenario.objectives) {
      if (this.isObjectiveComplete(obj, state)) done.push(obj.id)
    }
    return done
  }

  private isObjectiveComplete(obj: MissionObjective, state: MissionTickState): boolean {
    switch (obj.type) {
      case 'destroy_enemies': {
        const need = obj.targetCount ?? this.initialEnemyCount
        return state.enemyKills >= need
      }
      case 'destroy_ground': {
        const need = obj.targetCount ?? this.initialGroundCount
        return state.groundKills >= need
      }
      case 'all_enemies_destroyed':
        return this.initialEnemyCount > 0 && state.enemiesRemaining === 0
      case 'all_ground_destroyed':
        return this.initialGroundCount > 0 && state.groundRemaining === 0
      case 'takeoff':
        return Boolean(state.startedOnRunway) && Boolean(state.hasBeenAirborne)
      case 'land':
        // Must have flown first, then be stopped on the runway intact.
        return Boolean(state.hasBeenAirborne) && Boolean(state.landedSafely)
      default:
        return false
    }
  }

  private checkWin(completedIds: string[], state: MissionTickState): boolean {
    for (const cond of this.scenario.winConditions) {
      if (this.checkWinCondition(cond, completedIds, state)) return true
    }
    return false
  }

  private checkWinCondition(
    cond: WinCondition,
    completedIds: string[],
    state: MissionTickState
  ): boolean {
    switch (cond) {
      case 'primary_objectives_complete':
        return this.primaryObjectives.every(o => completedIds.includes(o.id))
      case 'all_enemies_destroyed':
        return this.initialEnemyCount > 0 && state.enemiesRemaining === 0
      default:
        return false
    }
  }
}
