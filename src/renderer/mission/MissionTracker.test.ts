import { describe, expect, it } from 'vitest'
import { MissionTracker } from './MissionTracker'
import { HEAD_ON_BVR, STRIKE_PACKAGE } from './scenarios'

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
})
