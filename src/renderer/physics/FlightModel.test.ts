/**
 * Physics integration tests for FlightModel.
 *
 * Tests simulate steady maneuvers on the F-16C and assert that the
 * flight model produces stable, physically plausible outputs after the
 * control-feedback fixes (accurate G, no SAS rate hunting, bank-gated beta).
 */
import { describe, it, expect } from 'vitest'
import { stepRK4, computeDerivedState } from './FlightModel'
import { F16C } from '../data/aircraft/f16c'
import { makeStateVec, quatFromEulerZYX } from '../utils/MathUtils'
import type { FlightPenalties } from '../types/damage'
import type { ControlInputs } from '../types/aircraft'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NO_DAMAGE: FlightPenalties = {
  thrustMultiplier: 1,
  rollAuthorityMultiplier: 1,
  pitchAuthorityMultiplier: 1,
  asymmetricDragCD: 0,
  fuelLeakMultiplier: 1,
}

function makeControls(overrides: Partial<ControlInputs> = {}): ControlInputs {
  return {
    pitch: 0, roll: 0, yaw: 0, throttle: 0.7,
    fireMissile: false, fireGun: false, cycleMissile: false,
    dispenseFlare: false, dispenseChaff: false, toggleGear: false,
    cycleFlaps: false, brakeHeld: false, speedBrakeToggle: false,
    radarModeNext: false, radarSelectNext: false, radarLockTarget: false,
    radarUnlock: false, ejectRequested: false,
    tgpToggle: false, tgpLock: false, tgpUnlock: false,
    wingmanEngage: false, wingmanCover: false, wingmanRTB: false, wingmanRejoin: false,
    ...overrides,
  }
}

/** Standard deviation of a number array. */
function stddev(arr: number[]): number {
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

/**
 * Trim state: F-16 heading north, wings-level, ~400 kts IAS at 10 000 ft.
 * v = 206 m/s north, alt = 3048 m → z = -3048 in NED.
 */
function trimmedSV() {
  const q = quatFromEulerZYX(0, 0, 0)
  return makeStateVec([0, 0, -3048], [206, 0, 0], q, [0, 0, 0])
}

/**
 * Pre-banked trim state: F-16 at 45° right bank, heading north.
 * Velocity is still northward — the test only cares about the turn dynamics,
 * not starting exactly on-speed for sustained flight.
 */
function bankedSV() {
  const DEG2RAD = Math.PI / 180
  const q = quatFromEulerZYX(0, 0, 45 * DEG2RAD)  // 45° right bank
  return makeStateVec([0, 0, -3048], [206, 0, 0], q, [0, 0, 0])
}

const MASS_KG = F16C.mass.emptyMassKg + F16C.mass.fuelCapacityKg * 0.5  // half fuel
const DT = 1 / 60

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('G accuracy', () => {
  it('reads near 1G in wings-level cruise', () => {
    let sv = trimmedSV()
    // Minimal pitch to avoid altitude loss; do not pull.
    const ctrl = makeControls({ pitch: 0.03, throttle: 0.65 })
    for (let i = 0; i < 300; i++) sv = stepRK4(sv, F16C, ctrl, MASS_KG, NO_DAMAGE, 0, DT)
    const d = computeDerivedState(sv, F16C, MASS_KG, ctrl, 0)
    expect(d.gCurrent).toBeGreaterThan(0.5)
    expect(d.gCurrent).toBeLessThan(3.0)
  })

  it('gCurrent with controls differs from table-only in a way consistent with elevator convention', () => {
    // The elevator (stabilator) convention in this model: pull → pitchRad < 0 →
    // dCL = CLde * (negative) = slight negative contribution (tail downforce for
    // nose-up moment reduces total CL). G still rises because alpha increases.
    // Verify: (a) both paths produce > 1G in a pull, (b) the difference is small
    // (< 1G), confirming the elevator term is plausible rather than dominating.
    let sv = trimmedSV()
    const ctrl = makeControls({ pitch: 0.65, throttle: 0.9 })
    for (let i = 0; i < 120; i++) sv = stepRK4(sv, F16C, ctrl, MASS_KG, NO_DAMAGE, 0, DT)

    const full     = computeDerivedState(sv, F16C, MASS_KG, ctrl, 0)
    const tableOnly = computeDerivedState(sv, F16C, MASS_KG)

    // Both must register meaningful G — the aircraft is pulling hard.
    expect(full.gCurrent).toBeGreaterThan(1)
    expect(tableOnly.gCurrent).toBeGreaterThan(1)
    // The two estimates must be close — elevator ΔCL is a small correction.
    expect(Math.abs(full.gCurrent - tableOnly.gCurrent)).toBeLessThan(1.0)
  })
})

describe('sustained turn stability', () => {
  /**
   * Pure pitch pull — no rolling — for 8 seconds.  Tests that G does not
   * oscillate due to the FCS G-limit feedback loop.  Collect G and pitch rate
   * over the last 4 seconds and assert low variance.
   */
  it('G does not oscillate during a sustained pitch pull', () => {
    let sv = trimmedSV()
    const ctrl = makeControls({ pitch: 0.55, throttle: 0.9 })

    const gHistory: number[] = []
    for (let i = 0; i < 480; i++) {          // 8 s
      sv = stepRK4(sv, F16C, ctrl, MASS_KG, NO_DAMAGE, 0, DT)
      if (i >= 240) {                         // last 4 s
        const d = computeDerivedState(sv, F16C, MASS_KG, ctrl, 0)
        gHistory.push(d.gCurrent)
      }
    }
    const gStddev = stddev(gHistory)
    // G should be steady — no limit-cycle hunting.
    expect(gStddev).toBeLessThan(0.5)
    // G must be clearly above 1 (aircraft is pulling).
    const gMean = gHistory.reduce((s, v) => s + v, 0) / gHistory.length
    expect(gMean).toBeGreaterThan(1.5)
  })
})

describe('turn rate sanity', () => {
  /**
   * Start the aircraft at a pre-banked 45° attitude and apply a light pitch
   * pull + minimal aileron to maintain the bank.  After 10 s, the aircraft
   * must be turning at > 5 °/s (proves it is actually turning) and the
   * heading rate must not wag excessively (stddev < 8 °/s).
   */
  it('aircraft turns coherently from a pre-banked state', () => {
    let sv = bankedSV()
    // Small negative roll to resist gravity roll-on at 45° bank;
    // positive pitch to maintain altitude and load in the turn.
    const ctrl = makeControls({ roll: -0.08, pitch: 0.45, throttle: 0.9 })

    const headingRates: number[] = []
    let prevHdg = computeDerivedState(sv, F16C, MASS_KG).headingDeg

    for (let i = 0; i < 600; i++) {           // 10 s
      sv = stepRK4(sv, F16C, ctrl, MASS_KG, NO_DAMAGE, 0, DT)
      const d = computeDerivedState(sv, F16C, MASS_KG)
      if (i >= 300) {                          // last 5 s
        let dPsi = d.headingDeg - prevHdg
        if (dPsi >  180) dPsi -= 360
        if (dPsi < -180) dPsi += 360
        headingRates.push(Math.abs(dPsi) / DT)
      }
      prevHdg = d.headingDeg
    }

    const meanRate = headingRates.reduce((s, v) => s + v, 0) / headingRates.length
    const rateStddev = stddev(headingRates)

    // Aircraft must actually be turning.
    expect(meanRate).toBeGreaterThan(5)
    // And the turn must not wag wildly.
    expect(rateStddev).toBeLessThan(8)
  })
})
