import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { MissileSystem } from './MissileSystem'
import { PlayerAircraft } from '../entities/PlayerAircraft'
import { F16C } from '../data/aircraft/f16c'
import { overallDamage } from '../systems/DamageModel'
import type { AircraftState } from '../types/aircraft'

/**
 * End-to-end countermeasure effectiveness.
 *
 * Every one of these once returned a 100% hit rate — chaff, flares, and a
 * *perfect* beam manoeuvre all did precisely nothing, because the notch gate
 * measured a quantity dominated by the missile's own closure, decoy seduction
 * only redirected guidance for a single frame, and both aspect calculations
 * used broken forward vectors. These pin the behaviour down so it cannot
 * silently regress to "missiles always hit".
 *
 * Rates are stochastic (seduction is a per-tick roll), so the bounds are loose:
 * they assert the *shape* of the model, not exact numbers.
 */

type Defence = 'straight' | 'chaff' | 'beam' | 'beam+chaff' | 'flares'

/** Fly a defensive profile against one missile. Returns true if it connected. */
function intercepted(weaponId: string, defence: Defence, launchRangeM: number): boolean {
  const scene = new THREE.Scene()
  const target = new PlayerAircraft(F16C, [], scene, true, false)
  const sys = new MissileSystem(scene)
  target.state.positionNED = [0, 0, -6000]
  target.state.velocityNED = [250, 0, 0]

  const shooter: AircraftState = {
    ...target.state,
    positionNED: [launchRangeM, 0, -6000],
    velocityNED: [-250, 0, 0],
    attitudeQuat: [0, 0, 0, 1],
  }
  sys.launch(weaponId, shooter, 'player', 'bandit',
    [...target.state.positionNED] as [number, number, number],
    [...target.state.velocityNED] as [number, number, number])

  const dt = 1 / 60
  for (let step = 0; step < 120 * 60; step++) {
    const m = sys.getMissiles().find(x => x.active)
    if (!m) break

    if (defence.includes('beam')) {
      // Velocity held perpendicular to the missile: a textbook notch.
      const bearing = Math.atan2(
        m.positionNED[1] - target.state.positionNED[1],
        m.positionNED[0] - target.state.positionNED[0],
      ) + Math.PI / 2
      target.state.velocityNED = [Math.cos(bearing) * 250, Math.sin(bearing) * 250, 0]
      target.state.attitudeQuat = [Math.cos(bearing / 2), 0, 0, Math.sin(bearing / 2)]
    }
    if (defence.includes('chaff')) {
      target.cmds.dispenseChaff([...target.state.positionNED], [...target.state.velocityNED])
    }
    if (defence.includes('flares')) {
      // The real dispense path ejects a pair sideways; dropping them at the
      // aircraft's own position and velocity would understate separation.
      const yaw = Math.atan2(target.state.velocityNED[1], target.state.velocityNED[0])
      const eject = (sign: number): { positionNED: [number, number, number]; velocityNED: [number, number, number] } => {
        const dirN = Math.cos(yaw) * -0.5 - Math.sin(yaw) * (sign * 0.8660254)
        const dirE = Math.sin(yaw) * -0.5 + Math.cos(yaw) * (sign * 0.8660254)
        return {
          positionNED: [target.state.positionNED[0], target.state.positionNED[1], target.state.positionNED[2] + 0.85],
          velocityNED: [
            target.state.velocityNED[0] + dirN * 35,
            target.state.velocityNED[1] + dirE * 35,
            target.state.velocityNED[2],
          ],
        }
      }
      target.cmds.dispenseFlarePair([eject(-1), eject(1)])
    }
    target.cmds.update(dt)

    target.state.positionNED = [
      target.state.positionNED[0] + target.state.velocityNED[0] * dt,
      target.state.positionNED[1] + target.state.velocityNED[1] * dt,
      target.state.positionNED[2] + target.state.velocityNED[2] * dt,
    ]
    sys.update(dt, shooter, [], target as never)
    if (overallDamage(target.damage) > 0 || target.state.ejected) return true
  }
  return false
}

function hitRate(weaponId: string, defence: Defence, rangeM: number, trials = 40): number {
  let hits = 0
  for (let i = 0; i < trials; i++) if (intercepted(weaponId, defence, rangeM)) hits++
  return hits / trials
}

const BVR_M = 20000
const WVR_M = 6000

describe('countermeasure effectiveness', () => {
  it('kills an undefended target with every weapon', () => {
    // The control: if this ever drops, the harness is broken rather than the
    // countermeasures being good.
    for (const w of ['r77', 'aim120b']) expect(hitRate(w, 'straight', BVR_M, 20), w).toBeGreaterThan(0.9)
    for (const w of ['r73', 'aim9x']) expect(hitRate(w, 'straight', WVR_M, 20), w).toBeGreaterThan(0.9)
  })

  it('defeats a radar missile with a beam manoeuvre', () => {
    // Notching drops the target's radial velocity into the clutter notch, so the
    // seeker cannot hold lock. This was impossible before: the gate measured
    // missile-minus-target closure, which never falls below a few hundred m/s.
    expect(hitRate('r77', 'beam', BVR_M)).toBeLessThan(0.2)
    expect(hitRate('aim120b', 'beam', BVR_M)).toBeLessThan(0.2)
  })

  it('does not let chaff alone save a target flying straight', () => {
    // Chaff without a beam is doctrinally weak, and should stay that way — the
    // fix must not turn countermeasures into an "ignore missiles" button.
    expect(hitRate('r77', 'chaff', BVR_M)).toBeGreaterThan(0.7)
  })

  it('defeats an IR missile with flares alone', () => {
    // Flares are the primary IR defence; they must work without also requiring
    // a perfect manoeuvre.
    expect(hitRate('r73', 'flares', WVR_M)).toBeLessThan(0.7)
    expect(hitRate('aim9x', 'flares', WVR_M)).toBeLessThan(0.75)
  })

  it('makes a better seeker harder to decoy', () => {
    // AIM-9X flare rejection is 0.82 against the R-73's 0.74, and the AIM-120B
    // resists ECCM at 0.55 against the R-77's 0.40. Those numbers should show up
    // as a survivability difference rather than being inert data.
    const r73 = hitRate('r73', 'flares', WVR_M, 80)
    const aim9x = hitRate('aim9x', 'flares', WVR_M, 80)
    expect(aim9x).toBeGreaterThan(r73 - 0.15)
  })
})
