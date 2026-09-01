import { describe, expect, it } from 'vitest'
import { MissionTracker } from './MissionTracker'
import { HEAD_ON_BVR, STRIKE_PACKAGE, TRAFFIC_PATTERN } from './scenarios'

const BASE = {
  elapsedSec: 60,
  enemyKills: 0,
  groundKills: 0,
  enemiesRemaining: 0,
  groundRemaining: 0,
  playerEjected: false,
  playerKilled: false,
}

describe('MissionTracker', () => {
  it('reports success when primary objectives are met', () => {
    const tracker = new MissionTracker(HEAD_ON_BVR, { enemies: 2, groundTargets: 0 })
    const result = tracker.evaluate({
      elapsedSec: 120,
      enemyKills: 2,
      groundKills: 0,
      enemiesRemaining: 0,
      groundRemaining: 0,
      playerEjected: false,
      playerKilled: false,
    })
    expect(result.outcome).toBe('success')
  })

  it('reports failure when time limit expires', () => {
    const tracker = new MissionTracker(STRIKE_PACKAGE, { enemies: 1, groundTargets: 2 })
    const result = tracker.evaluate({
      elapsedSec: 901,
      enemyKills: 0,
      groundKills: 0,
      enemiesRemaining: 1,
      groundRemaining: 2,
      playerEjected: false,
      playerKilled: false,
    })
    expect(result.outcome).toBe('failure')
  })

  it('reports ejected on voluntary eject lose condition', () => {
    const tracker = new MissionTracker(HEAD_ON_BVR, { enemies: 2, groundTargets: 0 })
    const result = tracker.evaluate({
      elapsedSec: 30,
      enemyKills: 0,
      groundKills: 0,
      enemiesRemaining: 2,
      groundRemaining: 0,
      playerEjected: true,
      playerKilled: false,
    })
    expect(result.outcome).toBe('ejected')
  })

  it('takeoff objective completes only after leaving the ground from a runway start', () => {
    const tracker = new MissionTracker(TRAFFIC_PATTERN, { enemies: 0, groundTargets: 0 })

    // Sitting on the runway — nothing done yet.
    let e = tracker.evaluate({ ...BASE, startedOnRunway: true })
    expect(e.completedObjectiveIds).not.toContain('takeoff')

    // Airborne — takeoff satisfied, landing not yet.
    e = tracker.evaluate({ ...BASE, startedOnRunway: true, hasBeenAirborne: true })
    expect(e.completedObjectiveIds).toContain('takeoff')
    expect(e.completedObjectiveIds).not.toContain('land')
    expect(e.outcome).toBeNull()
  })

  it('land objective needs a prior flight plus a safe touchdown; both complete → success', () => {
    const tracker = new MissionTracker(TRAFFIC_PATTERN, { enemies: 0, groundTargets: 0 })

    // On the runway "landed" but never flew — not a landing.
    let e = tracker.evaluate({ ...BASE, startedOnRunway: true, landedSafely: true })
    expect(e.completedObjectiveIds).not.toContain('land')

    e = tracker.evaluate({
      ...BASE,
      startedOnRunway: true,
      hasBeenAirborne: true,
      landedSafely: true,
    })
    expect(e.completedObjectiveIds).toEqual(expect.arrayContaining(['takeoff', 'land']))
    expect(e.outcome).toBe('success')
  })
})
