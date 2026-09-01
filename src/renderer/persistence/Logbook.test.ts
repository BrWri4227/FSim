import { describe, expect, it, beforeEach } from 'vitest'
import { setStorageBackend, createMemoryBackend } from './Storage'
import { appendSortie, summariseCareer, loadLogbook, recordSortie, type SortieRecord } from './Logbook'
import { EMPTY_SORTIE_STATS } from '../mission/SortieStats'

function rec(patch: Partial<SortieRecord> = {}): SortieRecord {
  return {
    timestamp: 1_000,
    missionName: 'Test',
    aircraftName: 'F-16C',
    outcome: 'success',
    kills: 1,
    groundKills: 0,
    deaths: 0,
    flightTimeSec: 600,
    landingSinkMS: null,
    stats: EMPTY_SORTIE_STATS,
    ...patch,
  }
}

describe('Logbook', () => {
  beforeEach(() => setStorageBackend(createMemoryBackend()))

  it('appendSortie caps the history at 200 records', () => {
    let log: SortieRecord[] = []
    for (let i = 0; i < 250; i++) log = appendSortie(log, rec({ timestamp: i }))
    expect(log).toHaveLength(200)
    expect(log[0]!.timestamp).toBe(50)
    expect(log[199]!.timestamp).toBe(249)
  })

  it('summariseCareer folds kills, deaths and K/D', () => {
    const log = [
      rec({ kills: 2, deaths: 1, outcome: 'success' }),
      rec({ kills: 1, deaths: 1, outcome: 'killed' }),
      rec({ kills: 0, groundKills: 3, deaths: 0, outcome: 'aborted' }),
    ]
    const c = summariseCareer(log)
    expect(c.sorties).toBe(3)
    expect(c.wins).toBe(1)
    expect(c.kills).toBe(3)
    expect(c.groundKills).toBe(3)
    expect(c.deaths).toBe(2)
    expect(c.killDeathRatio).toBeCloseTo(1.5)
  })

  it('tracks the best (lowest) landing sink rate', () => {
    const c = summariseCareer([
      rec({ landingSinkMS: 4.2 }),
      rec({ landingSinkMS: 1.1 }),
      rec({ landingSinkMS: null }),
    ])
    expect(c.bestLandingSinkMS).toBeCloseTo(1.1)
  })

  it('recordSortie persists and reloads', () => {
    recordSortie(rec({ kills: 5 }))
    const reloaded = loadLogbook()
    expect(reloaded).toHaveLength(1)
    expect(reloaded[0]!.kills).toBe(5)
  })

  it('degrades to an empty logbook with no backend', () => {
    setStorageBackend(null)
    // jsdom-less node: globalThis.localStorage is undefined → no throw, empty result
    expect(loadLogbook()).toEqual([])
  })
})
