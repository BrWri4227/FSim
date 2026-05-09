import type { AircraftSpec, ControlInputs } from '../types/aircraft'
import type { Vec3 } from '../types/common'
import type { LoadedStore } from '../types/weapons'
import { Aircraft } from '../entities/Aircraft'
import { Radar } from '../avionics/Radar'
import { makeStateVec, quatFromEulerZYX } from '../utils/MathUtils'
import type * as THREE from 'three'

export type AIBehavior = 'FOLLOW_BEHIND' | 'FOLLOW_IN_FRONT' | 'FLY_STRAIGHT' | 'TURN_CONSTANTLY'

export class AIAircraft extends Aircraft {
  behavior: AIBehavior
  initPositionNED: Vec3
  declare radar: Radar

  constructor(spec: AircraftSpec, stores: LoadedStore[], scene: THREE.Scene, behavior: AIBehavior, spawnPos: Vec3, spawnVel: Vec3) {
    super(spec, stores, scene)
    this.radar = new Radar(spec)
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

  /** Hostile radar vs the player: range-based track + STT when supported (debug-spawn AI). */
  updateRadarVsBandit(dt: number, bandit: Aircraft): void {
    if (this.state.ejected) return
    this.radar.update(dt, this.state, [bandit], false, true)
    const bid = bandit.entityId
    if (!this.radar.getTrack(bid)) return
    this.radar.state.selectedTrackId = bid
    if (this.radar.state.mode !== 'STT') this.radar.lockSTT(bid)
  }

  // Expose missiles for debug overlay
  get missiles(): null { return null }
}
