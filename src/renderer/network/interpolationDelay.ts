/**
 * How far in the past to render a remote aircraft.
 *
 * The buffer used a fixed 120 ms, which is right for a LAN and visibly wrong
 * across the internet: to a Raspberry Pi over a home connection, snapshots
 * arrive unevenly, and a delay shorter than the jitter means the interpolator
 * regularly runs out of future to interpolate towards and starts extrapolating.
 * That is what rubber-banding looks like.
 *
 * So measure the arrival pattern and sit just behind it: far enough back that a
 * late packet still lands before it is needed, no further.
 */

/** Below this, even a LAN's own scheduling noise causes stutter. */
export const MIN_INTERP_DELAY_MS = 100
/** Beyond this, hiding jitter costs more in aiming lead than it buys in smoothness. */
export const MAX_INTERP_DELAY_MS = 400
/** Delay used before enough snapshots have arrived to measure anything. */
export const DEFAULT_INTERP_DELAY_MS = 120

/** Arrival gaps kept. ~1.5 s at the 20 Hz send rate — long enough to see a
 *  burst of jitter, short enough to recover quickly when the link settles. */
export const JITTER_WINDOW = 30

/**
 * How many deviations of headroom to allow above the mean gap. Two covers the
 * large majority of late arrivals without parking the aircraft a third of a
 * second in the past on a link that is actually fine.
 */
const JITTER_SAFETY = 2

export function clampInterpDelay(ms: number): number {
  return Math.min(MAX_INTERP_DELAY_MS, Math.max(MIN_INTERP_DELAY_MS, ms))
}

/**
 * Rolling estimate of one peer's snapshot arrival pattern.
 *
 * Deliberately mean-absolute-deviation rather than a standard deviation: it is
 * cheaper, and it is far less swayed by the single 800 ms gap that a brief
 * stall produces — one hiccup should not park every remote aircraft at the
 * maximum delay for the next second and a half.
 */
export class ArrivalJitterTracker {
  private lastArrivalMs: number | null = null
  private readonly gaps: number[] = []

  /** Feed the moment a snapshot arrived. */
  record(nowMs: number): void {
    if (this.lastArrivalMs !== null) {
      const gap = nowMs - this.lastArrivalMs
      // A non-positive gap means duplicate delivery or a clock that went
      // backwards; neither says anything about the link.
      if (gap > 0) {
        this.gaps.push(gap)
        if (this.gaps.length > JITTER_WINDOW) this.gaps.shift()
      }
    }
    this.lastArrivalMs = nowMs
  }

  /** Mean inter-arrival gap in ms, or null before two snapshots have landed. */
  meanGapMs(): number | null {
    if (this.gaps.length === 0) return null
    let total = 0
    for (const g of this.gaps) total += g
    return total / this.gaps.length
  }

  /** Mean absolute deviation of the gaps, in ms. Zero for a perfectly even stream. */
  jitterMs(): number {
    const mean = this.meanGapMs()
    if (mean === null) return 0
    let total = 0
    for (const g of this.gaps) total += Math.abs(g - mean)
    return total / this.gaps.length
  }

  /**
   * The delay to render at. Needs a few samples before it says anything: two
   * gaps is not evidence about a link, and reacting to them makes the picture
   * worse right after a peer appears.
   */
  delayMs(): number {
    const mean = this.meanGapMs()
    if (mean === null || this.gaps.length < 4) return DEFAULT_INTERP_DELAY_MS
    return clampInterpDelay(mean + JITTER_SAFETY * this.jitterMs())
  }

  reset(): void {
    this.lastArrivalMs = null
    this.gaps.length = 0
  }
}
