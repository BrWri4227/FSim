import { describe, expect, it } from 'vitest'
import {
  ArrivalJitterTracker,
  DEFAULT_INTERP_DELAY_MS,
  JITTER_WINDOW,
  MAX_INTERP_DELAY_MS,
  MIN_INTERP_DELAY_MS,
  clampInterpDelay,
} from './interpolationDelay'

/** Feed a run of arrivals spaced by `gaps`, starting at t=0. */
function feed(tracker: ArrivalJitterTracker, gaps: number[]): void {
  let t = 0
  tracker.record(t)
  for (const gap of gaps) {
    t += gap
    tracker.record(t)
  }
}

describe('ArrivalJitterTracker', () => {
  it('uses the default until it has seen enough to judge', () => {
    const tracker = new ArrivalJitterTracker()
    expect(tracker.delayMs()).toBe(DEFAULT_INTERP_DELAY_MS)

    // Two or three gaps is not evidence about a link.
    feed(tracker, [50, 50])
    expect(tracker.delayMs()).toBe(DEFAULT_INTERP_DELAY_MS)
  })

  it('sits at the floor for a clean 20 Hz LAN stream', () => {
    const tracker = new ArrivalJitterTracker()
    feed(tracker, Array<number>(20).fill(50))

    expect(tracker.meanGapMs()).toBeCloseTo(50, 5)
    expect(tracker.jitterMs()).toBeCloseTo(0, 5)
    // mean 50 + 0 jitter is below the floor, so the floor wins.
    expect(tracker.delayMs()).toBe(MIN_INTERP_DELAY_MS)
  })

  it('backs further off as arrivals get less even', () => {
    const steady = new ArrivalJitterTracker()
    feed(steady, Array<number>(20).fill(50))

    const jittery = new ArrivalJitterTracker()
    // Same average rate, wildly uneven delivery.
    feed(jittery, Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 10 : 90)))

    expect(jittery.meanGapMs()).toBeCloseTo(steady.meanGapMs()!, 5)
    expect(jittery.jitterMs()).toBeGreaterThan(steady.jitterMs())
    expect(jittery.delayMs()).toBeGreaterThan(steady.delayMs())
  })

  it('never exceeds the ceiling, however bad the link', () => {
    const tracker = new ArrivalJitterTracker()
    feed(tracker, [20, 900, 25, 1200, 30, 1500, 20, 1100])
    expect(tracker.delayMs()).toBeLessThanOrEqual(MAX_INTERP_DELAY_MS)
    expect(tracker.delayMs()).toBe(MAX_INTERP_DELAY_MS)
  })

  it('recovers once the link settles', () => {
    const tracker = new ArrivalJitterTracker()
    feed(tracker, [20, 700, 25, 800, 30, 900])
    const duringTrouble = tracker.delayMs()
    expect(duringTrouble).toBeGreaterThan(MIN_INTERP_DELAY_MS)

    // A full window of clean arrivals pushes the bad ones out entirely.
    for (let i = 0; i < JITTER_WINDOW + 5; i++) tracker.record(10_000 + i * 50)
    expect(tracker.delayMs()).toBeLessThan(duringTrouble)
    expect(tracker.delayMs()).toBe(MIN_INTERP_DELAY_MS)
  })

  it('ignores duplicate and out-of-order arrivals', () => {
    const tracker = new ArrivalJitterTracker()
    let t = 0
    tracker.record(t)
    for (let i = 0; i < 10; i++) {
      t += 50
      tracker.record(t)
      tracker.record(t)      // same instant — says nothing about the link
      tracker.record(t - 10) // clock went backwards
    }
    // Gaps recorded should still average out to the real 50 ms cadence rather
    // than being dragged toward zero by the duplicates.
    expect(tracker.meanGapMs()).toBeGreaterThan(20)
    expect(tracker.delayMs()).toBe(MIN_INTERP_DELAY_MS)
  })

  it('forgets everything on reset', () => {
    const tracker = new ArrivalJitterTracker()
    feed(tracker, Array<number>(20).fill(400))
    expect(tracker.delayMs()).toBeGreaterThan(DEFAULT_INTERP_DELAY_MS)

    tracker.reset()
    expect(tracker.meanGapMs()).toBeNull()
    expect(tracker.delayMs()).toBe(DEFAULT_INTERP_DELAY_MS)
  })
})

describe('clampInterpDelay', () => {
  it('holds the delay inside the usable band', () => {
    expect(clampInterpDelay(0)).toBe(MIN_INTERP_DELAY_MS)
    expect(clampInterpDelay(10_000)).toBe(MAX_INTERP_DELAY_MS)
    expect(clampInterpDelay(250)).toBe(250)
  })
})
