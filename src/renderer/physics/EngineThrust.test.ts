/**
 * Engine thrust-map + supercruise regression.
 *
 * The throttle→thrust curve must reach BOTH endpoints:
 *  - at the afterburner detent (throttle === abMin) the engine makes its full
 *    rated military (dry) thrust,
 *  - at throttle 1 it makes full wet thrust.
 * The old single ramp capped dry thrust at `abMin` of its rated value, which made
 * military power — and therefore F-22 supercruise — unreachable.
 */
import { describe, it, expect } from 'vitest'
import { stepRK4, computeDerivedState, computeCommandedThrustN } from './FlightModel'
import { F22 } from '../data/aircraft/f22'
import { AIRCRAFT_ROSTER } from '../data/aircraft/catalog'
import { makeStateVec, quatFromEulerZYX, clamp } from '../utils/MathUtils'
import type { ControlInputs } from '../types/aircraft'
import type { FlightPenalties } from '../types/damage'

const NO_DAMAGE: FlightPenalties = {
  thrustMultiplier: 1, rollAuthorityMultiplier: 1, pitchAuthorityMultiplier: 1,
  asymmetricDragCD: 0, fuelLeakMultiplier: 1,
}
const DT = 1 / 120

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

describe('thrust map endpoints', () => {
  for (const spec of AIRCRAFT_ROSTER) {
    it(`${spec.id}: military detent → full dry, throttle 1 → full wet`, () => {
      const { maxThrustDryN, maxThrustWetN, afterburnerThrottleMin, idleThrustN } = spec.engine
      expect(computeCommandedThrustN(spec, afterburnerThrottleMin)).toBeCloseTo(maxThrustDryN, -2)
      expect(computeCommandedThrustN(spec, 1)).toBeCloseTo(maxThrustWetN, -2)
      expect(computeCommandedThrustN(spec, 0)).toBeCloseTo(idleThrustN, -2)
      // Monotonic across the detent — no discontinuity.
      const justBelow = computeCommandedThrustN(spec, afterburnerThrottleMin - 0.01)
      const justAbove = computeCommandedThrustN(spec, afterburnerThrottleMin + 0.01)
      expect(justAbove).toBeGreaterThan(justBelow)
      expect(justAbove - justBelow).toBeLessThan(maxThrustDryN * 0.15)
    })
  }
})

describe('F-22 supercruise', () => {
  it('sustains > M1.3 at 30 000 ft on military power (no afterburner)', () => {
    const massKg = F22.mass.emptyMassKg + F22.mass.fuelCapacityKg * 0.6
    const altM = 30000 * 0.3048
    const aSound = Math.sqrt(1.4 * 287.05 * (288.15 - 0.0065 * Math.min(altM, 11000)))
    let sv = makeStateVec([0, 0, -altM], [0.8 * aSound, 0, 0], quatFromEulerZYX(0, 0, 0), [0, 0, 0])
    // Military power = just below the afterburner detent.
    const throttle = F22.engine.afterburnerThrottleMin - 0.01

    for (let i = 0; i < 120 * 200; i++) {
      const d = computeDerivedState(sv, F22, massKg, makeControls(), 0)
      const pitchHold = clamp(-d.vviMps * 0.03 + (altM - d.altitudeM) * 0.0008, -0.5, 0.7)
      sv = stepRK4(sv, F22, makeControls({ throttle, pitch: pitchHold }), massKg, NO_DAMAGE, 0, DT, 0, 0, 0, F22.mass.fuelCapacityKg * 0.6)
    }
    const d = computeDerivedState(sv, F22, massKg, makeControls(), 0)
    expect(d.mach).toBeGreaterThan(1.3)
    expect(d.altitudeM).toBeGreaterThan(altM - 600)  // held altitude, didn't zoom-climb
  })
})
