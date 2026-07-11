import type { AIBehavior } from '../ai/AIAircraft'

export type MissionOutcome = 'success' | 'failure' | 'aborted' | 'ejected' | 'killed'

export type ObjectiveType =
  | 'destroy_enemies'
  | 'destroy_ground'
  | 'all_enemies_destroyed'
  | 'all_ground_destroyed'

export interface MissionObjective {
  id: string
  description: string
  type: ObjectiveType
  /** Required count for destroy_* objectives; defaults to all spawned of that type. */
  targetCount?: number
  optional?: boolean
}

export interface ScenarioOffsetM {
  forward: number
  right: number
  up?: number
}

export interface ScenarioEnemySpawn {
  aircraftId: string
  behavior: AIBehavior
  offsetM: ScenarioOffsetM
  /** Closing speed for head-on spawns; default 220 m/s toward player. */
  headOn?: boolean
  speedMS?: number
}

export interface ScenarioWingmanSpawn {
  /** Use player's aircraft type when set to `player_match`. */
  aircraftId: string
  offsetM: ScenarioOffsetM
}

export interface ScenarioGroundSpawn {
  targetId: string
  offsetM: Omit<ScenarioOffsetM, 'up'>
  headingDeg?: number
}

export type WinCondition = 'primary_objectives_complete' | 'all_enemies_destroyed'
export type LoseCondition = 'player_killed' | 'player_ejected' | 'time_limit'

export interface ScenarioDescriptor {
  id: string
  name: string
  description: string
  briefing: string
  playerSpawn: {
    positionNED?: [number, number, number]
    velocityNED?: [number, number, number]
  }
  enemies: ScenarioEnemySpawn[]
  wingmen: ScenarioWingmanSpawn[]
  groundTargets: ScenarioGroundSpawn[]
  objectives: MissionObjective[]
  winConditions: WinCondition[]
  loseConditions: LoseCondition[]
  timeLimitSec?: number
}

export interface FlightResult {
  kills: number
  groundKills: number
  deaths: number
  flightTimeSec: number
  aircraftName: string
  missionName: string
  outcome: MissionOutcome
  objectivesCompleted: number
  objectivesTotal: number
  objectiveLabels: string[]
}
