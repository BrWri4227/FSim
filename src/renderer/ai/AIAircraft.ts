import type { AircraftSpec, ControlInputs } from '../types/aircraft'
import type { Vec3 } from '../types/common'
import type { LoadedStore } from '../types/weapons'
import { Aircraft } from '../entities/Aircraft'
import { makeStateVec, quatFromEulerZYX } from '../utils/MathUtils'
import type * as THREE from 'three'

export type AIBehavior = 'FOLLOW_BEHIND' | 'FOLLOW_IN_FRONT' | 'FLY_STRAIGHT' | 'TURN_CONSTANTLY'

export class AIAircraft extends Aircraft {
  behavior: AIBehavior
  initPositionNED: Vec3

  constructor(spec: AircraftSpec, stores: LoadedStore[], scene: THREE.Scene, behavior: AIBehavior, spawnPos: Vec3, spawnVel: Vec3) {
    super(spec, stores, scene)
    this.behavior = behavior
    this.initPositionNED   = [...spawnPos]
    this.state.positionNED = [...spawnPos]
    this.state.velocityNED = [...spawnVel]

    // Derive initial heading from spawn velocity so the mesh faces the right direction.
    const yawRad = Math.atan2(spawnVel[1], spawnVel[0])   // NED: atan2(East, North)
    // Spawn with a small nose-up pitch so the aircraft has positive AoA from frame 1.
    // Without this the initial CL is ~0.12 (insufficient for level flight), causing
    // the aircraft to descend several hundred metres before the altitude-hold kicks in.
    const TRIM_PITCH_RAD = 2.5 * Math.PI / 180
    const q = quatFromEulerZYX(yawRad, TRIM_PITCH_RAD, 0)
    this.state.sv = makeStateVec(spawnPos, spawnVel, q, [0, 0, 0])
    this.state.attitudeQuat = [...q]
  }

  update(controls: ControlInputs, dt: number): void {
    if (this.state.ejected) return
    this.integrate(controls, dt)
  }

  // Expose missiles for debug overlay
  get missiles(): null { return null }
}
