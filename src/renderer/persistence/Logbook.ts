/**
 * Pilot logbook — an append-only list of completed sorties plus a derived career
 * summary shown on the debrief screen. Backed by [Storage]; capped so it can
 * never grow without bound.
 */
import { readJSON, writeJSON } from './Storage'
import type { MissionOutcome } from '../types/mission'
import { EMPTY_SORTIE_STATS, type SortieStatsResult } from '../mission/SortieStats'

const KEY = 'logbook'
const MAX_RECORDS = 200

export interface SortieRecord {
  /** epoch ms — supplied by the caller (keeps this module free of `Date.now`). */
  timestamp: number
  missionName: string
  aircraftName: string
  outcome: MissionOutcome
  kills: number
  groundKills: number
  deaths: number
  flightTimeSec: number
  landingSinkMS: number | null
  stats: SortieStatsResult
}

export interface CareerTotals {
  sorties: number
  wins: number
  kills: number
  groundKills: number
  deaths: number
  killDeathRatio: number
  flightHours: number
  missilePk: number
  bestLandingSinkMS: number | null
}

/** Pure: append a record and trim to the cap. Does not persist. */
export function appendSortie(log: SortieRecord[], record: SortieRecord): SortieRecord[] {
  const next = [...log, record]
  return next.length > MAX_RECORDS ? next.slice(next.length - MAX_RECORDS) : next
}

/** Pure: fold a logbook into career totals. */
export function summariseCareer(log: SortieRecord[]): CareerTotals {
  let kills = 0
  let groundKills = 0
  let deaths = 0
  let wins = 0
  let flightSec = 0
  let missilesFired = 0
  let missileHits = 0
  let bestLandingSinkMS: number | null = null

  for (const r of log) {
    kills += r.kills
    groundKills += r.groundKills
    deaths += r.deaths
    flightSec += r.flightTimeSec
    if (r.outcome === 'success') wins++
    const s = r.stats ?? EMPTY_SORTIE_STATS
    missilesFired += s.missilesFired
    missileHits += s.missileHits
    if (r.landingSinkMS !== null && (bestLandingSinkMS === null || r.landingSinkMS < bestLandingSinkMS)) {
      bestLandingSinkMS = r.landingSinkMS
    }
  }

  return {
    sorties: log.length,
    wins,
    kills,
    groundKills,
    deaths,
    killDeathRatio: deaths > 0 ? kills / deaths : kills,
    flightHours: flightSec / 3600,
    missilePk: missilesFired > 0 ? missileHits / missilesFired : 0,
    bestLandingSinkMS,
  }
}

export function loadLogbook(): SortieRecord[] {
  const raw = readJSON<SortieRecord[]>(KEY, [])
  return Array.isArray(raw) ? raw : []
}

/** Persisted read-append-write. Returns the updated logbook. */
export function recordSortie(record: SortieRecord): SortieRecord[] {
  const next = appendSortie(loadLogbook(), record)
  writeJSON(KEY, next)
  return next
}
