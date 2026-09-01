import { describe, expect, it } from 'vitest'
import { SortieStats } from './SortieStats'

describe('SortieStats', () => {
  it('computes missile Pk from launches and hits', () => {
    const s = new SortieStats()
    s.onMissileLaunch()
    s.onMissileLaunch()
    s.onMissileLaunch()
    s.onMissileLaunch()
    s.onWeaponHit('MISSILE')
    s.onWeaponHit('MISSILE')
    s.onWeaponHit('GUN')
    const r = s.finalize({ gunRoundsFired: 120, flaresUsed: 6, chaffUsed: 2 })
    expect(r.missilesFired).toBe(4)
    expect(r.missileHits).toBe(2)
    expect(r.missilePk).toBeCloseTo(0.5)
    expect(r.gunHits).toBe(1)
    expect(r.gunRoundsFired).toBe(120)
    expect(r.flares).toBe(6)
    expect(r.chaff).toBe(2)
  })

  it('records time to first kill and the flight envelope extremes', () => {
    const s = new SortieStats()
    s.onTick({ gCurrent: 1, mach: 0.4, iasKts: 250 }, 500, 0, 0)
    s.onTick({ gCurrent: 7.5, mach: 1.6, iasKts: 620 }, 120, 42, 0)
    s.onTick({ gCurrent: 3, mach: 0.9, iasKts: 400 }, 80, 61, 1)   // first kill at t=61
    s.onTick({ gCurrent: 2, mach: 0.8, iasKts: 380 }, 300, 75, 1)
    const r = s.finalize({ gunRoundsFired: 0, flaresUsed: 0, chaffUsed: 0 })
    expect(r.maxG).toBeCloseTo(7.5)
    expect(r.maxMach).toBeCloseTo(1.6)
    expect(r.topSpeedKts).toBe(620)
    expect(r.minAglM).toBe(80)
    expect(r.timeToFirstKillSec).toBe(61)
  })

  it('leaves time to first kill null when nothing is killed', () => {
    const s = new SortieStats()
    s.onTick({ gCurrent: 1, mach: 0.5, iasKts: 300 }, 1000, 10, 0)
    expect(s.finalize({ gunRoundsFired: 0, flaresUsed: 0, chaffUsed: 0 }).timeToFirstKillSec).toBeNull()
  })
})
