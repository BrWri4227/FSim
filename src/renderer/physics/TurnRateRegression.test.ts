/**
 * Per-aircraft sustained turn-rate regression against turnPerformance reference bands.
 *
 * Uses a standardized 55° bank + moderate pull at ~400 kts / 10 000 ft.
 * Bounds are relaxed (35% of chart min, 120% of chart max) because the sim
 * maneuver is a subset of full EM-chart corner conditions.
 */
import { describe, expect, it } from 'vitest'
import { stepRK4, computeDerivedState } from './FlightModel'
import { AIRCRAFT_ROSTER } from '../data/aircraft/catalog'
import { sustainedTurnRateRefDegS } from '../data/aircraft/turnPerformance'
import { makeStateVec, quatFromEulerZYX } from '../utils/MathUtils'
import type { AircraftSpec } from '../types/aircraft'
import type { ControlInputs } from '../types/aircraft'
import type { FlightPenalties } from '../types/damage'

const NO_DAMAGE: FlightPenalties = {
  thrustMultiplier: 1,
  rollAuthorityMultiplier: 1,
  pitchAuthorityMultiplier: 1,
  asymmetricDragCD: 0,
  fuelLeakMultiplier: 1,
}

const DT = 1 / 60
const BANK_DEG = 55
const ROLL_INPUT = -0.10
const PITCH_INPUT = 0.65
const MIN_REF_FACTOR = 0.35
const MAX_REF_FACTOR = 1.20

function makeControls(): ControlInputs {
  return {
    pitch: PITCH_INPUT, roll: ROLL_INPUT, yaw: 0, throttle: 1,
    fireMissile: false, fireGun: false, cycleMissile: false,
    dispenseFlare: false, dispenseChaff: false, toggleGear: false,
    cycleFlaps: false, brakeHeld: false, speedBrakeToggle: false,
    radarModeNext: false, radarSelectNext: false, radarLockTarget: false,
    radarUnlock: false, ejectRequested: false,
    tgpToggle: false, tgpLock: false, tgpUnlock: false,
    wingmanEngage: false, wingmanCover: false, wingmanRTB: false, wingmanRejoin: false,
  }
}

function meanSustainedTurnRateDegS(spec: AircraftSpec): number {
  const massKg = spec.mass.emptyMassKg + spec.mass.fuelCapacityKg * 0.5
  const q = quatFromEulerZYX(0, 0, BANK_DEG * Math.PI / 180)
  let sv = makeStateVec([0, 0, -3048], [206, 0, 0], q, [0, 0, 0])
  const ctrl = makeControls()

  let prevHdg = computeDerivedState(sv, spec, massKg).headingDeg
  const rates: number[] = []

  for (let i = 0; i < 600; i++) {
    sv = stepRK4(sv, spec, ctrl, massKg, NO_DAMAGE, 0, DT)
    if (i >= 300) {
      const d = computeDerivedState(sv, spec, massKg)
      let dPsi = d.headingDeg - prevHdg
      if (dPsi > 180) dPsi -= 360
      if (dPsi < -180) dPsi += 360
      rates.push(Math.abs(dPsi) / DT)
    }
    prevHdg = computeDerivedState(sv, spec, massKg).headingDeg
  }

  return rates.reduce((s, v) => s + v, 0) / rates.length
}

describe('per-aircraft turn rate regression', () => {
  for (const spec of AIRCRAFT_ROSTER) {
    it(`${spec.id} sustained turn rate stays within reference band`, () => {
      const ref = sustainedTurnRateRefDegS(spec.id)
      expect(ref).toBeDefined()

      const rate = meanSustainedTurnRateDegS(spec)
      expect(rate).toBeGreaterThanOrEqual(ref!.min * MIN_REF_FACTOR)
      expect(rate).toBeLessThanOrEqual(ref!.max * MAX_REF_FACTOR)
    })
  }

  it('F-22 turns faster than F/A-18C under the same maneuver', () => {
    const f22 = AIRCRAFT_ROSTER.find(s => s.id === 'f22')!
    const fa18 = AIRCRAFT_ROSTER.find(s => s.id === 'fa18c')!
    expect(meanSustainedTurnRateDegS(f22)).toBeGreaterThan(meanSustainedTurnRateDegS(fa18))
  })
})
