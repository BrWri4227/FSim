import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { EntityManager } from '../entities/EntityManager'
import { PlayerAircraft } from '../entities/PlayerAircraft'
import { F22 } from '../data/aircraft/f22'
import { HEAD_ON_BVR, CAP_WITH_WINGMAN, STRIKE_PACKAGE } from './scenarios'
import { applyPlayerSpawn, spawnScenario } from './ScenarioSpawner'
import { neutralControls } from '../input/neutralControls'
import { launchEnvelopeM } from '../ai/behaviors/BVREngage'
import { GROUND_TARGET_SPECS } from '../data/groundTargets/catalog'
import type { ScenarioDescriptor } from '../types/mission'

/**
 * How the PvE scenarios actually open.
 *
 * A player reported that the bandits' missiles were impossible to dodge. They
 * were: the pairs spawned 15–25 km out, and the AI took its first radar shot on
 * the frame it spawned — so the opening move of the mission was an inbound
 * missile launched from inside its own no-escape zone, before the player had
 * looked at the radar.
 *
 * These lock in the two things that fixed the *reaction window*: bandits start
 * far enough out that the shot has to fly, and nobody launches on tick zero.
 */
interface Opening {
  firstWarningSec: number
  firstWarningRangeKm: number
}

function simulateOpening(scenario: ScenarioDescriptor, seconds = 30): Opening {
  const scene = new THREE.Scene()
  const player = new PlayerAircraft(F22, [], scene, true, false)
  const em = new EntityManager(scene, player)
  applyPlayerSpawn(player, scenario)
  spawnScenario(scenario, em, player)

  const dt = 1 / 60
  const level = neutralControls({ throttle: 1 })
  for (let step = 0; step <= seconds * 60; step++) {
    player.update(dt, level, em.getHostiles(), undefined, em.getGroundTargets())
    em.update(dt, player)
    const inbound = em.getInboundMissiles(['player'])
    if (inbound.length > 0) {
      const bandit = em.getHostiles()[0]
      const p = player.state.positionNED
      const q = bandit ? bandit.state.positionNED : p
      return {
        firstWarningSec: step * dt,
        firstWarningRangeKm: Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / 1000,
      }
    }
  }
  return { firstWarningSec: Infinity, firstWarningRangeKm: Infinity }
}

const COMBAT_SCENARIOS = [HEAD_ON_BVR, CAP_WITH_WINGMAN, STRIKE_PACKAGE]

/** Run a scenario with the player flying straight, reporting what got shot at it. */
function simulateVolley(scenario: ScenarioDescriptor, seconds: number): {
  fired: number
  maxSimultaneous: number
} {
  const scene = new THREE.Scene()
  const player = new PlayerAircraft(F22, [], scene, true, false)
  const em = new EntityManager(scene, player)
  applyPlayerSpawn(player, scenario)
  spawnScenario(scenario, em, player)

  const dt = 1 / 60
  const level = neutralControls({ throttle: 1 })
  const seen = new Set<string>()
  let fired = 0
  let maxSimultaneous = 0
  for (let step = 0; step <= seconds * 60; step++) {
    const inbound = em.getInboundMissiles(['player'])
    for (const m of inbound) if (!seen.has(m.id)) { seen.add(m.id); fired++ }
    maxSimultaneous = Math.max(maxSimultaneous, inbound.length)
    player.update(dt, level, em.getHostiles(), undefined, em.getGroundTargets())
    em.update(dt, player)
    if (player.state.ejected) break
  }
  return { fired, maxSimultaneous }
}

describe('PvE scenario openings', () => {
  it('starts every hostile fighter far enough out to be seen coming', () => {
    for (const scenario of COMBAT_SCENARIOS) {
      for (const enemy of scenario.enemies) {
        expect(enemy.offsetM.forward, `${scenario.id}`).toBeGreaterThanOrEqual(35_000)
      }
    }
  })

  it('separates a hostile pair by more than one radar beam width', () => {
    // The scan beam is 3° wide. Two bandits closer together than that at spawn
    // paint as a single contact, so the player cannot tell it is a pair.
    for (const scenario of COMBAT_SCENARIOS) {
      if (scenario.enemies.length < 2) continue
      const rights = scenario.enemies.map(e => e.offsetM.right ?? 0)
      const separationM = Math.max(...rights) - Math.min(...rights)
      const rangeM = scenario.enemies[0]!.offsetM.forward
      const separationDeg = (Math.atan2(separationM, rangeM) * 180) / Math.PI
      expect(separationDeg, `${scenario.id}`).toBeGreaterThan(3)
    }
  })

  it('never launches on the spawn frame, and gives the player time to react', () => {
    for (const scenario of COMBAT_SCENARIOS) {
      const opening = simulateOpening(scenario)
      // Nothing may be in the air before the player has oriented.
      expect(opening.firstWarningSec, `${scenario.id} first warning`).toBeGreaterThan(3)
      // And the shot must be taken from far enough out that it has to fly to us,
      // rather than appearing already inside its no-escape zone.
      expect(opening.firstWarningRangeKm, `${scenario.id} launch range`).toBeGreaterThan(20)
    }
  })
})

/**
 * AI launch discipline.
 *
 * A pair of bandits used to empty their rails the moment the player crossed the
 * missile's paper max range: six shots airborne at once, from 50 km, most with
 * no energy left to manoeuvre by arrival. No countermeasure model can survive
 * that — a defender can beam one bearing, not six — so it read to players as
 * "the missiles are impossible to dodge" even after the seeker fixes landed.
 */
/** Everything in a scenario that can shoot at the player: fighters plus SAM sites. */
function countShooters(scenario: ScenarioDescriptor): number {
  const sams = scenario.groundTargets.filter(
    g => GROUND_TARGET_SPECS[g.targetId]?.category === 'SAM_SITE',
  ).length
  return scenario.enemies.length + sams
}

describe('AI launch discipline', () => {
  it('commits one missile at a time per shooter', () => {
    for (const scenario of COMBAT_SCENARIOS) {
      const shooters = countShooters(scenario)
      const { maxSimultaneous } = simulateVolley(scenario, 60)
      expect(maxSimultaneous, `${scenario.id} simultaneous inbound`).toBeLessThanOrEqual(shooters)
    }
  })

  it('does not empty the rails in the opening engagement', () => {
    // Four ARH rounds per bandit are available; spending them all in the first
    // half-minute is the behaviour being guarded against.
    for (const scenario of COMBAT_SCENARIOS) {
      const shooters = countShooters(scenario)
      const { fired } = simulateVolley(scenario, 30)
      expect(fired, `${scenario.id} missiles fired in 30s`).toBeLessThanOrEqual(shooters)
    }
  })

  it('opens the launch envelope for a closing target and collapses it for a fleeing one', () => {
    // A head-on target flies into the missile; one running away has to be chased
    // down, and the shot is worth far less.
    const headOn = launchEnvelopeM(500)
    const beam = launchEnvelopeM(0)
    const fleeing = launchEnvelopeM(-500)
    expect(headOn).toBeGreaterThan(beam)
    expect(beam).toBeGreaterThan(fleeing)
    // And none of them reach the missile's straight-line paper range.
    expect(headOn).toBeLessThan(40_000)
  })
})
