import { describe, it, expect } from 'vitest'
import type { Vec3 } from '../types/common'
import {
  dragCoefficient,
  stepProjectile,
  solveGunLead,
  type ProjectileBallistics,
} from './Ballistics'

const M61: ProjectileBallistics = {
  roundMassKg: 0.1,
  roundDiameterM: 0.02,
  ballisticCd: 0.3,
}
const MUZZLE_MS = 1030

const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2])

describe('dragCoefficient', () => {
  it('is positive and grows with drag coefficient', () => {
    const k = dragCoefficient(M61)
    expect(k).toBeGreaterThan(0)
    expect(dragCoefficient({ ...M61, ballisticCd: 0.6 })).toBeCloseTo(k * 2, 10)
  })

  it('shrinks as the round gets heavier', () => {
    expect(dragCoefficient({ ...M61, roundMassKg: 0.2 })).toBeLessThan(dragCoefficient(M61))
  })
})

describe('stepProjectile', () => {
  it('bleeds speed to drag on a horizontal shot', () => {
    const k = dragCoefficient(M61)
    let pos: Vec3 = [0, 0, -5000]
    let vel: Vec3 = [MUZZLE_MS, 0, 0]
    for (let i = 0; i < 120; i++) {
      const n = stepProjectile(pos, vel, k, 1 / 120)
      pos = n.positionNED
      vel = n.velocityNED
    }
    // ~1 s later the round is well below muzzle speed and has fallen under gravity.
    expect(len(vel)).toBeLessThan(MUZZLE_MS * 0.8)
    expect(len(vel)).toBeGreaterThan(400)
    expect(pos[2]).toBeGreaterThan(-5000) // dropped (z = down)
    expect(pos[0]).toBeLessThan(MUZZLE_MS) // fell short of the drag-free 1030 m
  })

  it('keeps speed constant with zero drag apart from gravity', () => {
    let pos: Vec3 = [0, 0, -1000]
    let vel: Vec3 = [800, 0, 0]
    for (let i = 0; i < 60; i++) {
      const n = stepProjectile(pos, vel, 0, 1 / 60)
      pos = n.positionNED
      vel = n.velocityNED
    }
    expect(vel[0]).toBeCloseTo(800, 6)
    expect(vel[2]).toBeCloseTo(9.80665, 1) // ~1 s of gravity
  })
})

const own = {
  positionNED: [0, 0, -5000] as Vec3,
  velocityNED: [250, 0, 0] as Vec3,
}

describe('solveGunLead', () => {
  it('returns null when the target is on top of you', () => {
    expect(
      solveGunLead({
        ownPositionNED: own.positionNED,
        ownVelocityNED: own.velocityNED,
        targetPositionNED: own.positionNED,
        targetVelocityNED: [0, 0, 0],
        muzzleVelocityMS: MUZZLE_MS,
        ballistics: M61,
      }),
    ).toBeNull()
  })

  it('needs almost no lead for a target dead ahead in a tail chase', () => {
    const sol = solveGunLead({
      ownPositionNED: own.positionNED,
      ownVelocityNED: own.velocityNED,
      targetPositionNED: [1200, 0, -5000],
      targetVelocityNED: [200, 0, 0],
      muzzleVelocityMS: MUZZLE_MS,
      ballistics: M61,
    })!
    expect(sol).not.toBeNull()
    expect(sol.leadAngleDeg).toBeLessThan(1.5) // only gravity-drop compensation
    expect(sol.converged).toBe(true)
  })

  it('time of flight is longer than the drag-free estimate', () => {
    const rangeM = 1500
    const sol = solveGunLead({
      ownPositionNED: own.positionNED,
      ownVelocityNED: own.velocityNED,
      targetPositionNED: [rangeM, 0, -5000],
      targetVelocityNED: [0, 0, 0],
      muzzleVelocityMS: MUZZLE_MS,
      ballistics: M61,
    })!
    const dragFreeToF = rangeM / MUZZLE_MS
    expect(sol.timeOfFlightSec).toBeGreaterThan(dragFreeToF * 1.15)
    expect(sol.impactSpeedMS).toBeLessThan(MUZZLE_MS)
  })

  it('leads a fast crossing target well ahead of its current position', () => {
    const sol = solveGunLead({
      ownPositionNED: own.positionNED,
      ownVelocityNED: own.velocityNED,
      targetPositionNED: [1000, 0, -5000],
      targetVelocityNED: [0, 250, 0], // pure crossing
      muzzleVelocityMS: MUZZLE_MS,
      ballistics: M61,
    })!
    expect(sol.leadAngleDeg).toBeGreaterThan(8)
    // aim point is displaced toward the target's travel direction (+East)
    expect(sol.aimPointNED[1]).toBeGreaterThan(120)
  })

  it('produces an aim direction that actually strikes the predicted target', () => {
    const targetPos: Vec3 = [1100, 40, -5020]
    const targetVel: Vec3 = [-40, 220, 5]
    const sol = solveGunLead({
      ownPositionNED: own.positionNED,
      ownVelocityNED: own.velocityNED,
      targetPositionNED: targetPos,
      targetVelocityNED: targetVel,
      muzzleVelocityMS: MUZZLE_MS,
      ballistics: M61,
    })!
    expect(sol.converged).toBe(true)

    const aimDir: Vec3 = [
      (sol.aimPointNED[0] - own.positionNED[0]) / sol.slantRangeM,
      (sol.aimPointNED[1] - own.positionNED[1]) / sol.slantRangeM,
      (sol.aimPointNED[2] - own.positionNED[2]) / sol.slantRangeM,
    ]
    const k = dragCoefficient(M61)
    let pos: Vec3 = [...own.positionNED]
    let vel: Vec3 = [
      own.velocityNED[0] + aimDir[0] * MUZZLE_MS,
      own.velocityNED[1] + aimDir[1] * MUZZLE_MS,
      own.velocityNED[2] + aimDir[2] * MUZZLE_MS,
    ]
    const steps = Math.round(sol.timeOfFlightSec * 120)
    for (let i = 0; i < steps; i++) {
      const n = stepProjectile(pos, vel, k, 1 / 120)
      pos = n.positionNED
      vel = n.velocityNED
    }
    const predTgt: Vec3 = [
      targetPos[0] + targetVel[0] * sol.timeOfFlightSec,
      targetPos[1] + targetVel[1] * sol.timeOfFlightSec,
      targetPos[2] + targetVel[2] * sol.timeOfFlightSec,
    ]
    const miss = Math.hypot(pos[0] - predTgt[0], pos[1] - predTgt[1], pos[2] - predTgt[2])
    expect(miss).toBeLessThan(5)
  })
})
