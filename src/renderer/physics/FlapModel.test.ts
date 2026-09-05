/**
 * Flap model: increment shape, airspeed blow-back, and integrated effect on
 * the F-16C flight model (extra lift, nose-down pitch, no speed lockout).
 */
import { describe, it, expect } from 'vitest'
import { computeFlapAero, FLAP_PLACARD_KTS } from './FlapModel'
import { stepRK4, computeDerivedState } from './FlightModel'
import { F16C } from '../data/aircraft/f16c'
import { makeStateVec, quatFromEulerZYX } from '../utils/MathUtils'
import type { ControlInputs } from '../types/aircraft'
import type { FlightPenalties } from '../types/damage'
import { neutralControls } from '../input/neutralControls'

const NO_DAMAGE: FlightPenalties = {
  thrustMultiplier: 1,
  rollAuthorityMultiplier: 1,
  pitchAuthorityMultiplier: 1,
  asymmetricDragCD: 0,
  fuelLeakMultiplier: 1,
}

const DT = 1 / 60
const MASS_KG = F16C.mass.emptyMassKg + F16C.mass.fuelCapacityKg * 0.5
const FUEL_KG = F16C.mass.fuelCapacityKg * 0.5

function makeControls(overrides: Partial<ControlInputs> = {}): ControlInputs {
  return neutralControls({ throttle: 0.6, ...overrides })
}

/**
 * Integrate the F-16C for `steps` ticks from level flight at `speedMS` and 1500 m,
 * with the given flap position, and return the final derived state + raw sv.
 */
function run(flaps: 0 | 1 | 2, speedMS: number, steps: number, ctrlOverrides: Partial<ControlInputs> = {}) {
  const q = quatFromEulerZYX(0, 0, 0)
  let sv = makeStateVec([0, 0, -1500], [speedMS, 0, 0], q, [0, 0, 0])
  const ctrl = makeControls(ctrlOverrides)
  for (let i = 0; i < steps; i++) {
    const ias = computeDerivedState(sv, F16C, MASS_KG).iasKts
    const { flapCL, flapCD, flapCm } = computeFlapAero(flaps, ias)
    // Positional call: flapCL/flapCD at 8/9, fuelKg at 11, flapCm last.
    sv = stepRK4(sv, F16C, ctrl, MASS_KG, NO_DAMAGE, 0, DT, flapCL, flapCD, 0, FUEL_KG, undefined, undefined, flapCm)
  }
  return { sv, derived: computeDerivedState(sv, F16C, MASS_KG) }
}

describe('computeFlapAero — increment shape', () => {
  it('flaps up contributes nothing', () => {
    expect(computeFlapAero(0, 150)).toEqual({ flapCL: 0, flapCD: 0, flapCm: 0, blownBack: false })
  })

  it('lift and drag increase from takeoff to landing setting', () => {
    const to = computeFlapAero(1, 150)
    const ldg = computeFlapAero(2, 150)
    expect(to.flapCL).toBeGreaterThan(0)
    expect(ldg.flapCL).toBeGreaterThan(to.flapCL)
    expect(ldg.flapCD).toBeGreaterThan(to.flapCD)
  })

  it('produces a nose-down (negative) pitching moment that stays smaller than full elevator authority', () => {
    const ldg = computeFlapAero(2, 150)
    expect(ldg.flapCm).toBeLessThan(0)
    // Full stabilator authority is ~|CMde| * maxDefl ≈ 0.14 * 0.49 ≈ 0.068; the
    // flap moment must be trimmable, i.e. a fraction of that.
    expect(Math.abs(ldg.flapCm)).toBeLessThan(0.04)
  })
})

describe('computeFlapAero — airspeed blow-back', () => {
  it('is at full effectiveness below the placard speed', () => {
    const below = computeFlapAero(2, FLAP_PLACARD_KTS[2] - 20)
    const ref = computeFlapAero(2, 50)
    expect(below.flapCL).toBeCloseTo(ref.flapCL)
    expect(below.blownBack).toBe(false)
  })

  it('loses effectiveness monotonically above the placard speed', () => {
    const atPlacard = computeFlapAero(2, FLAP_PLACARD_KTS[2])
    const over = computeFlapAero(2, FLAP_PLACARD_KTS[2] + 120)
    const wayOver = computeFlapAero(2, FLAP_PLACARD_KTS[2] + 400)
    expect(over.flapCL).toBeLessThan(atPlacard.flapCL)
    expect(wayOver.flapCL).toBeLessThan(over.flapCL)
    expect(over.blownBack).toBe(true)
  })

  it('never blows back to exactly zero (residual hinge-gap effect)', () => {
    const extreme = computeFlapAero(2, 900)
    expect(extreme.flapCL).toBeGreaterThan(0)
    expect(extreme.flapCL).toBeLessThan(computeFlapAero(2, 50).flapCL * 0.2)
  })
})

describe('flaps in the flight model', () => {
  it('landing flaps generate more lift than clean at approach speed', () => {
    const SPEED = 105  // ~185 kt IAS at 1500 m — below the pos-2 placard
    const clean = run(0, SPEED, 90)
    const flapped = run(2, SPEED, 90)
    // NED vz: negative = climbing. Extra flap lift → less sink / more climb.
    expect(flapped.sv[5]).toBeLessThan(clean.sv[5])
  })

  it('landing flaps pitch the nose down relative to clean (neutral stick)', () => {
    const SPEED = 105
    const clean = run(0, SPEED, 30)
    const flapped = run(2, SPEED, 30)
    expect(flapped.derived.pitch).toBeLessThan(clean.derived.pitch)
  })

  it('are not speed-locked: selecting landing flaps at 500 kt barely perturbs the trajectory', () => {
    const SPEED = 250  // ~440 kt IAS at 1500 m — far past the placard
    const clean = run(0, SPEED, 60)
    const flapped = run(2, SPEED, 60)
    // Blow-back means almost no lift/drag delta — the run completes normally
    // (no lockout, no blow-up) and stays close to the clean trajectory.
    expect(Number.isFinite(flapped.sv[5])).toBe(true)
    expect(Math.abs(flapped.sv[5] - clean.sv[5])).toBeLessThan(6)
  })
})
