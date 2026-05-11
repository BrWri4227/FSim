import type { AircraftSpec, ControlInputs } from '../types/aircraft'
import type { Vec3 } from '../types/common'
import type { LoadedStore } from '../types/weapons'
import { Aircraft } from '../entities/Aircraft'
import { Radar } from '../avionics/Radar'
import { CMDS } from '../avionics/CMDS'
import { MissileSystem } from '../weapons/MissileSystem'
import { getMissileSpec, getStoreDragPenalty } from '../data/weapons/catalog'
import { makeStateVec, quatFromEulerZYX } from '../utils/MathUtils'
import type * as THREE from 'three'

export type AIBehavior = 'FOLLOW_BEHIND' | 'FOLLOW_IN_FRONT' | 'FLY_STRAIGHT' | 'TURN_CONSTANTLY' | 'BVR_ENGAGE'
export type AISide = 'HOSTILE' | 'WINGMAN'

export class AIAircraft extends Aircraft {
  behavior: AIBehavior
  side: AISide = 'HOSTILE'
  initPositionNED: Vec3
  declare radar: Radar
  readonly cmds: CMDS
  readonly missiles: MissileSystem
  /** Cooldown (sec) until next BVR shot is allowed. Decremented in update. */
  bvrFireCooldownSec = 0

  constructor(spec: AircraftSpec, stores: LoadedStore[], scene: THREE.Scene, behavior: AIBehavior, spawnPos: Vec3, spawnVel: Vec3) {
    super(spec, stores, scene)
    this.radar = new Radar(spec)
    this.cmds = new CMDS(spec.cmdsFlareCount, spec.cmdsChaffCount)
    this.missiles = new MissileSystem(scene)
    this.behavior = behavior
    this.initPositionNED   = [...spawnPos]
    this.state.positionNED = [...spawnPos]
    this.state.velocityNED = [...spawnVel]

    // If the spawner didn't supply ARH stores, give the AI 4 nation-default rounds so
    // BVR engage actually has missiles to shoot.
    if (!stores.some(s => s.category === 'ARH_MISSILE')) {
      const arhId = spec.nation === 'USA' ? 'aim120b' : 'r77'
      const arhSpec = getMissileSpec(arhId)
      if (arhSpec) {
        const hps = spec.hardpoints.filter(h => h.compatibleTypes.includes('ARH_MISSILE')).slice(0, 4)
        for (const hp of hps) {
          this.state.loadedStores.push({
            hardpointId: hp.id,
            weaponId: arhId,
            category: 'ARH_MISSILE',
            massKg: arhSpec.massKg,
            dragPenalty: getStoreDragPenalty(arhSpec),
            remainingRounds: 1,
          })
        }
      }
    }

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
    this.cmds.update(dt)
    if (this.bvrFireCooldownSec > 0) this.bvrFireCooldownSec = Math.max(0, this.bvrFireCooldownSec - dt)

    // Honour CMDS dispense flags from the brain. Spawn from the aircraft body offset
    // (rear of the fuselage); velocity matches aircraft so flares "fall away".
    if (controls.dispenseFlare) {
      this.cmds.dispenseFlare(
        [this.state.positionNED[0] - 1.5, this.state.positionNED[1], this.state.positionNED[2] + 0.5],
        [this.state.velocityNED[0], this.state.velocityNED[1], this.state.velocityNED[2] + 4],
      )
    }
    if (controls.dispenseChaff) {
      this.cmds.dispenseChaff(
        [this.state.positionNED[0] - 1.5, this.state.positionNED[1], this.state.positionNED[2] + 0.5],
        [this.state.velocityNED[0], this.state.velocityNED[1], this.state.velocityNED[2] + 2],
      )
    }
  }

  /** Number of unfired ARH missiles still on rails. Read by BVR brain. */
  getRemainingARH(): number {
    let n = 0
    for (const s of this.state.loadedStores) {
      if (s.category === 'ARH_MISSILE' && s.remainingRounds > 0) n++
    }
    return n
  }

  /**
   * Launch one ARH missile at the supplied target. Picks the first available
   * ARH store, decrements its rounds, and routes through the AI's MissileSystem.
   * Returns true if a missile was actually launched.
   */
  fireBVRMissile(target: Aircraft): boolean {
    const store = this.state.loadedStores.find(s => s.category === 'ARH_MISSILE' && s.remainingRounds > 0)
    if (!store) return false
    const hpDef = this.spec.hardpoints.find(h => h.id === store.hardpointId)
    const hpBody = hpDef?.posBodyM as [number, number, number] | undefined
    this.missiles.launch(
      store.weaponId,
      this.state,
      target.entityId,
      this.entityId,
      [...target.state.positionNED] as [number, number, number],
      [...target.state.velocityNED] as [number, number, number],
      hpBody,
    )
    store.remainingRounds = 0
    return true
  }

  /** Step AI missiles forward each tick. Caller passes the player + ground targets list. */
  updateMissiles(dt: number, player: Aircraft, groundTargets: import('../entities/GroundTarget').GroundTarget[] = []): void {
    this.missiles.update(dt, this.state, [player], player, undefined, undefined, groundTargets)
  }

  override dispose(): void {
    this.missiles.dispose()
    super.dispose()
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

}
