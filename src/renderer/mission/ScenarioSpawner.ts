import type { ScenarioDescriptor, ScenarioOffsetM } from '../types/mission'
import type { EntityManager } from '../entities/EntityManager'
import type { PlayerAircraft } from '../entities/PlayerAircraft'
import type { Vec3 } from '../types/common'
import type { LoadedStore } from '../types/weapons'
import { getAircraftById } from '../data/aircraft/catalog'
import { GROUND_TARGET_SPECS } from '../data/groundTargets/catalog'
import { R73 } from '../data/weapons/r73'
import { getStoreDragPenalty } from '../data/weapons/catalog'
import { RAD2DEG } from '../utils/MathUtils'
import { getRunwaySpawnNED } from '../scene/Terrain'
import { getGroundClearance } from '../scene/PlaceholderMeshes'

const DEFAULT_IR_STORES: LoadedStore[] = [
  {
    hardpointId: 'W1',
    weaponId: 'r73',
    category: 'IR_MISSILE',
    massKg: R73.massKg,
    dragPenalty: getStoreDragPenalty(R73),
    remainingRounds: 1,
  },
  {
    hardpointId: 'E1',
    weaponId: 'r73',
    category: 'IR_MISSILE',
    massKg: R73.massKg,
    dragPenalty: getStoreDragPenalty(R73),
    remainingRounds: 1,
  },
]

export interface SpawnCounts {
  enemies: number
  groundTargets: number
}

/** Apply scenario player start position/velocity and sync the RK4 state vector. */
export function applyPlayerSpawn(player: PlayerAircraft, scenario: ScenarioDescriptor): void {
  const spawn = scenario.playerSpawn

  if (spawn.onRunway) {
    applyRunwaySpawn(player)
    return
  }

  if (!spawn.positionNED && !spawn.velocityNED) return

  const pos = spawn.positionNED ?? player.state.positionNED
  const vel = spawn.velocityNED ?? player.state.velocityNED
  const q = player.state.attitudeQuat

  player.state.positionNED = [...pos] as Vec3
  player.state.velocityNED = [...vel] as Vec3
  player.state.sv = [
    pos[0], pos[1], pos[2],
    vel[0], vel[1], vel[2],
    q[0], q[1], q[2], q[3],
    0, 0, 0,
  ]
}

/** Cold-and-dark on the south threshold: gear down, takeoff flaps, idle, stationary, facing north. */
function applyRunwaySpawn(player: PlayerAircraft): void {
  const clearanceM = getGroundClearance(player.spec.id, true)
  const { positionNED } = getRunwaySpawnNED(clearanceM)
  const q: [number, number, number, number] = [1, 0, 0, 0]  // level, heading north

  player.state.positionNED = [...positionNED] as Vec3
  player.state.velocityNED = [0, 0, 0]
  player.state.attitudeQuat = q
  player.state.angularRateBody = [0, 0, 0]
  player.state.sv = [
    positionNED[0], positionNED[1], positionNED[2],
    0, 0, 0,
    q[0], q[1], q[2], q[3],
    0, 0, 0,
  ]
  player.state.onGround = true
  player.state.gearDown = true
  player.state.gearCollapsed = false
  player.state.lastTouchdownSinkMS = null
  player.state.flaps = 1
  player.state.throttle = 0
  player.state.speedBrake = false
}

function horizontalBasis(velocityNED: readonly [number, number, number]): {
  uN: number
  uE: number
  rN: number
  rE: number
  speed: number
} {
  const speed = Math.hypot(velocityNED[0], velocityNED[1], velocityNED[2]) || 250
  const uN = velocityNED[0] / speed
  const uE = velocityNED[1] / speed
  return { uN, uE, rN: uE, rE: -uN, speed }
}

function offsetToWorld(
  origin: readonly [number, number, number],
  basis: ReturnType<typeof horizontalBasis>,
  offset: ScenarioOffsetM
): Vec3 {
  const up = offset.up ?? 0
  return [
    origin[0] + basis.uN * offset.forward + basis.rN * offset.right,
    origin[1] + basis.uE * offset.forward + basis.rE * offset.right,
    origin[2] + up,
  ]
}

export interface SpawnOptions {
  /**
   * Suppress AI aircraft and ground targets.
   *
   * AI is not replicated: each client runs its own copy from the same
   * descriptor, diverging within seconds. Two players in the same lobby would
   * be shooting at private ghosts and reporting kills nobody else saw, and
   * mission objectives counted against those local spawns would complete at
   * different times on each machine.
   */
  suppressAI?: boolean
}

/** Spawn all scenario entities relative to the player's current position/heading. */
export function spawnScenario(
  scenario: ScenarioDescriptor,
  entityManager: EntityManager,
  player: PlayerAircraft,
  options: SpawnOptions = {}
): SpawnCounts {
  const ps = player.state.positionNED
  const vel = player.state.velocityNED
  const basis = horizontalBasis(vel)

  if (options.suppressAI) {
    return { enemies: 0, groundTargets: 0 }
  }

  for (const wingman of scenario.wingmen) {
    const spec =
      wingman.aircraftId === 'player_match'
        ? player.spec
        : getAircraftById(wingman.aircraftId)
    if (!spec) continue
    const spawnPos = offsetToWorld(ps, basis, wingman.offsetM)
    entityManager.spawnWingman(spec, [], spawnPos, [...vel] as Vec3)
  }

  for (const enemy of scenario.enemies) {
    const spec = getAircraftById(enemy.aircraftId)
    if (!spec) continue
    const spawnPos = offsetToWorld(ps, basis, enemy.offsetM)
    let spawnVel: Vec3
    if (enemy.headOn) {
      const speed = enemy.speedMS ?? 220
      spawnVel = [-basis.uN * speed, -basis.uE * speed, 0]
    } else {
      const speed = enemy.speedMS ?? basis.speed
      spawnVel = [basis.uN * speed, basis.uE * speed, 0]
    }
    entityManager.spawnEnemy(spec, DEFAULT_IR_STORES, enemy.behavior, spawnPos, spawnVel)
  }

  for (const gt of scenario.groundTargets) {
    const spec = GROUND_TARGET_SPECS[gt.targetId]
    if (!spec) continue
    const spawnPos = offsetToWorld(ps, basis, { ...gt.offsetM, up: 0 })
    const headingDeg = gt.headingDeg ?? Math.atan2(basis.uE, basis.uN) * RAD2DEG
    entityManager.spawnGroundTarget(spec, spawnPos, headingDeg)
  }

  return {
    enemies: scenario.enemies.length,
    groundTargets: scenario.groundTargets.length,
  }
}
