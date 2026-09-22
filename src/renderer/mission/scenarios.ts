import type { ScenarioDescriptor } from '../types/mission'

/**
 * How far ahead a hostile fighter spawns in a PvE scenario.
 *
 * These used to start at 15–25 km. Head-on, with both sides doing ~250 m/s,
 * that is a ~30 second run straight into the merge — and the AI's only missile
 * is the IR shot `wvrEngage` takes at 3.5 km, from the front quarter, with a
 * few seconds of flight time. There was no window in which to do anything
 * about it: no time to work the radar, no shot of your own, no chance to
 * change the geometry before the missile was already inside minimum range.
 *
 * At 40 km the engagement opens where the avionics are actually useful. The
 * bandit is inside detection range on contact (a MiG-29's 5 m² head-on return
 * is visible to ~65 km) and inside the AIM-120's 50 km Rmax, so the player
 * gets to shoot first, crank, and choose whether to merge at all.
 *
 * Tune here rather than per scenario — the reason is the same in all of them.
 */
const BVR_SPAWN_RANGE_M = 40000

/**
 * Lateral split within a hostile pair.
 *
 * The radar beam is 3° wide, so the old ±800 m put both bandits inside roughly
 * one beam at range and they painted as a single contact. This separates them
 * by ~4° at spawn, so a pair reads as a pair.
 */
const PAIR_SPLIT_M = 1500

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
  description: 'Two bandits at 40 km — win the radar fight before the merge.',
  timeOfDay: 'DUSK',
  briefing:
    'Hostile MiG-29 pair inbound head-on at 40 km. You will see them long before ' +
    'they can shoot: work the radar, take the first shot, and pick your merge. ' +
    'Destroy both bandits. Wingmen: none. RTB via ESC when complete.',
  playerSpawn: {
    positionNED: [0, 0, -5000],
    velocityNED: [250, 0, 0],
  },
  enemies: [
    {
      aircraftId: 'mig29',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: BVR_SPAWN_RANGE_M, right: -PAIR_SPLIT_M },
      headOn: true,
    },
    {
      aircraftId: 'mig29',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: BVR_SPAWN_RANGE_M, right: PAIR_SPLIT_M },
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
    'Maintain CAP with your wingman off the left wing. Two Su-57 contacts at 40 km — ' +
    'they are low-observable, so AWACS will call them well before your own radar ' +
    'picks them up. Destroy all bandits. Use wingman commands (HUD) to coordinate.',
  playerSpawn: {
    positionNED: [0, 0, -6000],
    velocityNED: [230, 0, 0],
  },
  enemies: [
    {
      aircraftId: 'su57',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: BVR_SPAWN_RANGE_M, right: -PAIR_SPLIT_M },
      headOn: true,
    },
    {
      aircraftId: 'su57',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: BVR_SPAWN_RANGE_M, right: PAIR_SPLIT_M },
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
  description: 'Destroy ground targets 8 km ahead; one F-16 CAP bandit at 40 km.',
  briefing:
    'Strike two ground targets (T-90 and SA-10) 8 km along your route. ' +
    'Expect a hostile F-16 CAP at 40 km — it reaches you after the strike, not ' +
    'during it. Destroy all targets and survive.',
  playerSpawn: {
    positionNED: [0, 0, -4000],
    velocityNED: [220, 0, 0],
  },
  enemies: [
    {
      aircraftId: 'f16c',
      behavior: 'BVR_ENGAGE',
      offsetM: { forward: BVR_SPAWN_RANGE_M, right: 0 },
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

/**
 * The multiplayer scenario. No AI, no objectives — the mission is the other
 * players, so there is nothing to complete and no win condition. Everything
 * that makes a session end (respawn, scoring) is driven by the LAN layer.
 *
 * Every other scenario spawns AI on all clients independently, with no
 * replication, so each player fights their own private copy of the same
 * bandits. This one is what a LAN dogfight should select.
 */
export const DOGFIGHT: ScenarioDescriptor = {
  id: 'dogfight',
  name: 'Dogfight (Multiplayer)',
  description: 'LAN free-for-all — no AI, no objectives, just the other players.',
  briefing:
    'Free-for-all against the other pilots in the lobby. There are no AI bandits ' +
    'and no objectives: every contact is a real player. You respawn a few seconds ' +
    'after being shot down, so the session continues until everyone quits. Hold N ' +
    'for the scoreboard.',
  playerSpawn: {
    positionNED: [0, 0, -5000],
    velocityNED: [250, 0, 0],
  },
  enemies: [],
  wingmen: [],
  groundTargets: [],
  objectives: [],
  winConditions: [],
  loseConditions: ['player_killed', 'player_ejected'],
  timeOfDay: 'DAY',
  weather: 'CLEAR',
}

export const SCENARIO_CATALOG: ScenarioDescriptor[] = [
  TRAFFIC_PATTERN,
  FREE_FLIGHT,
  DOGFIGHT,
  HEAD_ON_BVR,
  CAP_WITH_WINGMAN,
  STRIKE_PACKAGE,
]

export function getScenarioById(id: string): ScenarioDescriptor | null {
  return SCENARIO_CATALOG.find(s => s.id === id) ?? null
}

export const DEFAULT_SCENARIO = HEAD_ON_BVR
