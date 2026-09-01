/**
 * Per-sortie telemetry collector. Fed by [FlightSession] from callbacks that
 * already exist on `PlayerAircraft` (missile launch, target hit, decoy success)
 * plus a per-tick sample. `finalize` produces the immutable summary shown on the
 * debrief and stored in the pilot logbook.
 */

export interface SortieTickSample {
  gCurrent: number
  mach: number
  iasKts: number
}

export interface SortieStatsResult {
  missilesFired: number
  missileHits: number
  /** hits / max(1, fired), 0..1 */
  missilePk: number
  gunRoundsFired: number
  gunHits: number
  flares: number
  chaff: number
  decoyDefeats: number
  incomingMissiles: number
  maxG: number
  minAglM: number
  maxMach: number
  topSpeedKts: number
  timeToFirstKillSec: number | null
}

export const EMPTY_SORTIE_STATS: SortieStatsResult = {
  missilesFired: 0,
  missileHits: 0,
  missilePk: 0,
  gunRoundsFired: 0,
  gunHits: 0,
  flares: 0,
  chaff: 0,
  decoyDefeats: 0,
  incomingMissiles: 0,
  maxG: 1,
  minAglM: Infinity,
  maxMach: 0,
  topSpeedKts: 0,
  timeToFirstKillSec: null,
}

export class SortieStats {
  private missilesFired = 0
  private missileHits = 0
  private gunHits = 0
  private decoyDefeats = 0
  private incomingMissiles = 0
  private maxG = 1
  private minAglM = Infinity
  private maxMach = 0
  private topSpeedKts = 0
  private lastKillCount = 0
  private timeToFirstKillSec: number | null = null

  onMissileLaunch(): void {
    this.missilesFired++
  }

  onWeaponHit(weapon: 'GUN' | 'MISSILE'): void {
    if (weapon === 'GUN') this.gunHits++
    else this.missileHits++
  }

  onDecoySuccess(): void {
    this.decoyDefeats++
  }

  onIncomingMissile(count = 1): void {
    this.incomingMissiles += count
  }

  onTick(sample: SortieTickSample, aglM: number, elapsedSec: number, killCount: number): void {
    this.maxG = Math.max(this.maxG, Math.abs(sample.gCurrent))
    this.maxMach = Math.max(this.maxMach, sample.mach)
    this.topSpeedKts = Math.max(this.topSpeedKts, sample.iasKts)
    if (Number.isFinite(aglM) && aglM >= 0) this.minAglM = Math.min(this.minAglM, aglM)
    if (killCount > this.lastKillCount && this.timeToFirstKillSec === null) {
      this.timeToFirstKillSec = elapsedSec
    }
    this.lastKillCount = killCount
  }

  finalize(totals: { gunRoundsFired: number; flaresUsed: number; chaffUsed: number }): SortieStatsResult {
    return {
      missilesFired: this.missilesFired,
      missileHits: this.missileHits,
      missilePk: this.missilesFired > 0 ? this.missileHits / this.missilesFired : 0,
      gunRoundsFired: Math.max(0, Math.round(totals.gunRoundsFired)),
      gunHits: this.gunHits,
      flares: Math.max(0, Math.round(totals.flaresUsed)),
      chaff: Math.max(0, Math.round(totals.chaffUsed)),
      decoyDefeats: this.decoyDefeats,
      incomingMissiles: this.incomingMissiles,
      maxG: this.maxG,
      minAglM: Number.isFinite(this.minAglM) ? this.minAglM : 0,
      maxMach: this.maxMach,
      topSpeedKts: this.topSpeedKts,
      timeToFirstKillSec: this.timeToFirstKillSec,
    }
  }
}
