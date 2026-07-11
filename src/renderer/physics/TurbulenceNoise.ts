/** Global turbulence clock advanced once per RK4 step (deterministic gust field). */
let _turbClockSec = 0

export function advanceTurbulenceClock(dt: number): void {
  _turbClockSec += dt
}

/** Reset for tests or session restarts. */
export function resetTurbulenceClock(): void {
  _turbClockSec = 0
}

/**
 * Deterministic band-limited gust sample in approximately [-1, 1].
 * Three orthogonal channels use golden-angle phase offsets so axes stay decorrelated.
 */
export function sampleTurbulenceAxis(channel: 0 | 1 | 2): number {
  const t = _turbClockSec
  const phase = channel * 2.399963229728653
  return (
    Math.sin(t * 1.73 + phase) * 0.48 +
    Math.sin(t * 2.41 + phase * 1.31) * 0.32 +
    Math.sin(t * 3.19 + phase * 0.71) * 0.20
  )
}
