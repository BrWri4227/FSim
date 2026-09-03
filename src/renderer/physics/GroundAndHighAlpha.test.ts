/**
 * Regression tests for:
 *  - the landing-gear ground reaction (no uncommanded nose-up while parked;
 *    takeoff rotation still works)
 *  - the post-stall aero extension (alpha can exceed the table edge, drag bleeds
 *    energy, nose-down break recovers)
 *  - thrust-vectoring low-speed pitch authority
 */
import { describe, it, expect } from 'vitest'
import { stepRK4, computeDerivedState } from './FlightModel'
import { F16C } from '../data/aircraft/f16c'
import { F15C } from '../data/aircraft/f15c'
import { SU35 } from '../data/aircraft/su35'
import { makeStateVec, quatFromEulerZYX } from '../utils/MathUtils'
import type { FlightPenalties } from '../types/damage'
import type { ControlInputs, AircraftSpec } from '../types/aircraft'

const NO_DAMAGE: FlightPenalties = {
  thrustMultiplier: 1,
  rollAuthorityMultiplier: 1,
  pitchAuthorityMultiplier: 1,
  asymmetricDragCD: 0,
  fuelLeakMultiplier: 1,
}

const DT = 1 / 60

function makeControls(o: Partial<ControlInputs> = {}): ControlInputs {
  return {
    pitch: 0, roll: 0, yaw: 0, throttle: 0,
    fireMissile: false, fireGun: false, cycleMissile: false,
    dispenseFlare: false, dispenseChaff: false, toggleGear: false,
    cycleFlaps: false, brakeHeld: false, speedBrakeToggle: false,
    radarModeNext: false, radarSelectNext: false, radarLockTarget: false,
    radarUnlock: false, ejectRequested: false,
    tgpToggle: false, tgpLock: false, tgpUnlock: false,
    wingmanEngage: false, wingmanCover: false, wingmanRTB: false, wingmanRejoin: false,
    ...o,
  }
}

const GROUND_CLEAR_M = 1.5  // approximate gear clearance; minAltM in the test frame

function fullFuelMass(spec: AircraftSpec): number {
  return spec.mass.emptyMassKg + spec.mass.fuelCapacityKg
}

describe('landing-gear ground reaction', () => {
  it('a parked jet does not pitch up on its own', () => {
    const massKg = fullFuelMass(F16C)
    const q = quatFromEulerZYX(0, 0, 0)
    let sv = makeStateVec([0, 0, -GROUND_CLEAR_M], [0, 0, 0], q, [0, 0, 0])
    const ctrl = makeControls({ throttle: 0 })

    // 60 s parked at idle, neutral stick
    for (let i = 0; i < 3600; i++) {
      sv = stepRK4(sv, F16C, ctrl, massKg, NO_DAMAGE, 0, DT, 0, 0, GROUND_CLEAR_M, F16C.mass.fuelCapacityKg)
    }
    const d = computeDerivedState(sv, F16C, massKg)
    expect(Math.abs(d.pitch)).toBeLessThan(4)
    expect(Math.abs(d.roll)).toBeLessThan(4)
  })

  it('a normal takeoff still rotates and lifts off', () => {
    const massKg = fullFuelMass(F16C)
    const q = quatFromEulerZYX(0, 0, 0)
    let sv = makeStateVec([0, 0, -GROUND_CLEAR_M], [0, 0, 0], q, [0, 0, 0])

    let maxPitch = -Infinity
    let maxAlt = -Infinity
    for (let i = 0; i < 3600; i++) {  // 60 s
      const speedMS = Math.hypot(sv[3]!, sv[4]!)
      // Progressive rotation: ease in aft stick past ~60 kt, as a pilot would.
      const pitch = speedMS > 30 ? 0.55 : 0
      sv = stepRK4(sv, F16C, makeControls({ pitch, throttle: 1 }), massKg, NO_DAMAGE, 0, DT, 0.5, 0.02, GROUND_CLEAR_M, F16C.mass.fuelCapacityKg)
      const d = computeDerivedState(sv, F16C, massKg)
      maxPitch = Math.max(maxPitch, d.pitch)
      maxAlt = Math.max(maxAlt, d.altitudeM)
    }
    // Nose came up and the jet climbed away.
    expect(maxPitch).toBeGreaterThan(8)
    expect(maxAlt).toBeGreaterThan(GROUND_CLEAR_M + 100)
  })
})

describe('post-stall aero extension', () => {
  it('alpha can exceed the table edge and then recovers nose-down', () => {
    const massKg = F16C.mass.emptyMassKg + F16C.mass.fuelCapacityKg * 0.4
    // ~150 kt at 5000 ft, wings level
    const q = quatFromEulerZYX(0, 0, 0)
    let sv = makeStateVec([0, 0, -1524], [77, 0, 0], q, [0, 0, 0])
    const ctrl = makeControls({ pitch: 1, throttle: 0.5 })

    let peakAlpha = -Infinity
    for (let i = 0; i < 240; i++) {  // 4 s hard pull
      sv = stepRK4(sv, F16C, ctrl, massKg, NO_DAMAGE, 0, DT, 0, 0, 0, F16C.mass.fuelCapacityKg * 0.4)
      peakAlpha = Math.max(peakAlpha, computeDerivedState(sv, F16C, massKg).alphaDeg)
    }
    // Got well past the 30° table edge (post-stall regime reached).
    expect(peakAlpha).toBeGreaterThan(33)

    // Release stick — nose-down break should bring alpha back to flying range.
    const relax = makeControls({ pitch: 0, throttle: 0.5 })
    for (let i = 0; i < 360; i++) {  // 6 s
      sv = stepRK4(sv, F16C, relax, massKg, NO_DAMAGE, 0, DT, 0, 0, 0, F16C.mass.fuelCapacityKg * 0.4)
    }
    expect(computeDerivedState(sv, F16C, massKg).alphaDeg).toBeLessThan(20)
  })
})

describe('thrust vectoring', () => {
  it('a TVC jet out-points a non-TVC jet at very low speed', () => {
    const pitchRateAfter = (spec: AircraftSpec): number => {
      const massKg = spec.mass.emptyMassKg + spec.mass.fuelCapacityKg * 0.3
      const q = quatFromEulerZYX(0, 0, 0)
      let sv = makeStateVec([0, 0, -3048], [70, 0, 0], q, [0, 0, 0])  // ~135 kt
      const ctrl = makeControls({ pitch: 1, throttle: 1 })
      for (let i = 0; i < 60; i++) {  // 1 s
        sv = stepRK4(sv, spec, ctrl, massKg, NO_DAMAGE, 0, DT, 0, 0, 0, spec.mass.fuelCapacityKg * 0.3)
      }
      return Math.abs(computeDerivedState(sv, spec, massKg).pitch)
    }
    expect(pitchRateAfter(SU35)).toBeGreaterThan(pitchRateAfter(F15C))
  })
})
