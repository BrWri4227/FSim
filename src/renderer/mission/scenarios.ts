import type { ScenarioDescriptor } from '../types/mission'

export const FREE_FLIGHT: ScenarioDescriptor = {
  id: 'free_flight',
  name: 'Free Flight',
  description: 'Empty skies — practice flight and weapons with no objectives.',
  briefing:
    'Airborne at 5,000 m with no hostiles and nothing to shoot at. Good place to ' +
    'learn the aircraft: try the controls, find the stall, and get a feel for how ' +
    'much speed a hard turn costs you. Nothing here can end the mission except ' +
    'the ground. Press Esc for the pause menu and the full control list.',
  playerSpawn: {
    positionNED: [0, 0, -5000],
    velocityNED: [250, 0, 0],
  },
  enemies: [],
  wingmen: [],
  groundTargets: [],
  objectives: [],
  winConditions: [],
  loseConditions: [],
}

export const TRAFFIC_PATTERN: ScenarioDescriptor = {
  id: 'traffic_pattern',
  name: 'Traffic Pattern',
  description: 'Runway start — take off, fly the circuit, and land. No hostiles.',
  briefing:
    'Cold start on RWY 36. Advance the throttle, rotate around 150 kts, gear up, ' +
    'and climb out. Fly a left-hand circuit, then configure (gear + full flaps) and ' +
    'land back on the runway. A gentle touchdown (under ~3 m/s sink) with the gear ' +
    'intact completes the mission.',
  playerSpawn: { onRunway: true },
  enemies: [],
  wingmen: [],
  groundTargets: [],
  objectives: [
    { id: 'takeoff', description: 'Take off from the runway', type: 'takeoff' },
    { id: 'land', description: 'Land back on the runway (gear intact)', type: 'land' },
  ],
  winConditions: ['primary_objectives_complete'],
  loseConditions: ['player_killed', 'player_ejected'],
  timeOfDay: 'DAY',
  weather: 'CLEAR',
}

export const HEAD_ON_BVR: ScenarioDescriptor = {
  id: 'head_on_bvr',
  name: 'Head-On BVR',
  description: 'Two bandits at 15 km — merge and engage before they do.',
  timeOfDay: 'DUSK',
  briefing:
    'Hostile MiG-29 pair inbound head-on at 15 km. Destroy both bandits. ' +
    'Wingmen: none. RTB via ESC when complete.',
  playerSpawn: {
    positionNED: [0, 0, -5000],
    velocityNED: [250, 0, 0],
  },
  enemies: [
    {
      aircraftId: 'mig29',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: 15000, right: -800 },
      headOn: true,
    },
    {
      aircraftId: 'mig29',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: 15000, right: 800 },
      headOn: true,
    },
  ],
  wingmen: [],
  groundTargets: [],
  objectives: [
    {
      id: 'kill_bandits',
      description: 'Destroy both bandits',
      type: 'destroy_enemies',
      targetCount: 2,
    },
  ],
  winConditions: ['primary_objectives_complete'],
  loseConditions: ['player_killed', 'player_ejected'],
}

export const CAP_WITH_WINGMAN: ScenarioDescriptor = {
  id: 'cap_wingman',
  name: 'CAP with Wingman',
  description: 'Combat air patrol — wingman on your left, two Su-57 bandits ahead.',
  briefing:
    'Maintain CAP with your wingman off the left wing. Two Su-57 contacts at 20 km — ' +
    'destroy all bandits. Use wingman commands (HUD) to coordinate.',
  playerSpawn: {
    positionNED: [0, 0, -6000],
    velocityNED: [230, 0, 0],
  },
  enemies: [
    {
      aircraftId: 'su57',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: 20000, right: -1200 },
      headOn: true,
    },
    {
      aircraftId: 'su57',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: 20000, right: 1200 },
      headOn: true,
    },
  ],
  wingmen: [
    {
      aircraftId: 'player_match',
      offsetM: { forward: -80, right: -200 },
    },
  ],
  groundTargets: [],
  objectives: [
    {
      id: 'kill_su57',
      description: 'Destroy both Su-57 bandits',
      type: 'destroy_enemies',
      targetCount: 2,
    },
  ],
  winConditions: ['primary_objectives_complete'],
  loseConditions: ['player_killed', 'player_ejected'],
}

export const STRIKE_PACKAGE: ScenarioDescriptor = {
  id: 'strike_package',
  name: 'Strike Package',
  description: 'Destroy ground targets 8 km ahead; one F-16 CAP bandit at 25 km.',
  briefing:
    'Strike two ground targets (T-90 and SA-10) 8 km along your route. ' +
    'Expect a hostile F-16 CAP at 25 km. Destroy all targets and survive.',
  playerSpawn: {
    positionNED: [0, 0, -4000],
    velocityNED: [220, 0, 0],
  },
  enemies: [
    {
      aircraftId: 'f16c',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: 25000, right: 0 },
      headOn: true,
    },
  ],
  wingmen: [],
  groundTargets: [
    { targetId: 't90', offsetM: { forward: 8000, right: -400 } },
    { targetId: 'sa10', offsetM: { forward: 8200, right: 600 } },
  ],
  objectives: [
    {
      id: 'strike_ground',
      description: 'Destroy both ground targets',
      type: 'destroy_ground',
      targetCount: 2,
    },
    {
      id: 'kill_cap',
      description: 'Destroy CAP bandit',
      type: 'destroy_enemies',
      targetCount: 1,
    },
  ],
  winConditions: ['primary_objectives_complete'],
  loseConditions: ['player_killed', 'player_ejected', 'time_limit'],
  timeLimitSec: 900,
}

export const SCENARIO_CATALOG: ScenarioDescriptor[] = [
  TRAFFIC_PATTERN,
  FREE_FLIGHT,
  HEAD_ON_BVR,
  CAP_WITH_WINGMAN,
  STRIKE_PACKAGE,
]

export function getScenarioById(id: string): ScenarioDescriptor | null {
  return SCENARIO_CATALOG.find(s => s.id === id) ?? null
}

export const DEFAULT_SCENARIO = HEAD_ON_BVR
