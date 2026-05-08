import * as THREE from 'three'
import type { AircraftSpec, AircraftState, ControlInputs } from '../types/aircraft'
import type { LoadedStore, MissileState, GunRoundState } from '../types/weapons'
import type { DamageState } from '../types/damage'
import type { Radar } from '../avionics/Radar'
import { defaultDamageState } from '../types/damage'
import { stepRK4, computeDerivedState } from '../physics/FlightModel'
import { computeTotalMass, computeStoreDrag } from '../physics/MassProperties'
import { createPlaceholderAircraftMesh, createNozzlePoint, applyDamageTint, setGearVisible, setFlapsVisible, getGroundClearance } from '../scene/PlaceholderMeshes'
import { nedToThree, nedQuatToThree, makeStateVec, quatFromEulerZYX } from '../utils/MathUtils'
import { computeFlightPenalties, overallDamage } from '../systems/DamageModel'
import type { FlightPenalties } from '../types/damage'
import { ThrusterEffect } from '../scene/ThrusterEffect'
import { applyFCSLimits } from '../avionics/FCS'

let _entityCounter = 0

export class Aircraft {
  readonly entityId: string
  readonly spec: AircraftSpec
  state: AircraftState
  damage: DamageState
  radar: Radar | null = null

  mesh: THREE.Group
  protected scene: THREE.Scene
  private thrusterEffect: ThrusterEffect

  constructor(spec: AircraftSpec, stores: LoadedStore[], scene: THREE.Scene, entityId?: string) {
    this.entityId = entityId ?? `aircraft_${++_entityCounter}`
    this.spec = spec
    this.scene = scene

    // Initial state
    const q = quatFromEulerZYX(0, 0, 0) // level, north
    const sv = makeStateVec([0,0,-5000], [250,0,0], q, [0,0,0])

    this.state = {
      positionNED: [0,0,-5000],
      velocityNED: [250,0,0],
      attitudeQuat: q,
      angularRateBody: [0,0,0],
      alphaDeg: 2, betaDeg: 0, mach: 0.75,
      iasKts: 485, altitudeM: 5000, gCurrent: 1, gMax: 1,
      headingDeg: 0, pitchDeg: 2, rollDeg: 0, vviMps: 0,
      throttle: 0.3, fuelKg: spec.mass.fuelCapacityKg,
      loadedStores: [...stores],
      totalMassKg: spec.mass.emptyMassKg + spec.mass.fuelCapacityKg,
      onGround: false, ejected: false, invincible: false, gearDown: false, flaps: 0, speedBrake: false,
      sv,
    }

    this.damage = defaultDamageState()
    this.mesh = createPlaceholderAircraftMesh(spec.id, spec.nation)
    scene.add(this.mesh)

    // Attach engine glow to the nozzle point
    const nozzle = createNozzlePoint(this.mesh)
    this.thrusterEffect = new ThrusterEffect(nozzle, 1.8)
  }

  protected integrate(controls: ControlInputs, dt: number): void {
    const penalties = computeFlightPenalties(this.damage)
    const storeDrag = computeStoreDrag(this.state.loadedStores)
    const massKg    = computeTotalMass(this.spec, this.state.fuelKg, this.state.loadedStores)

    const gearDrag = this.state.gearDown ? 0.05 : 0
    const speedBrakeDrag = this.state.speedBrake ? 0.12 : 0
    const FLAP_CL = [0, 0.5, 1.0] as const
    const FLAP_CD = [0, 0.02, 0.08] as const
    const flapCL = FLAP_CL[this.state.flaps]
    const flapCD = FLAP_CD[this.state.flaps]
    const fcsControls = applyFCSLimits(controls, this.state, this.spec)
    const groundClearM = getGroundClearance(this.spec.id, this.state.gearDown)
    const newSV = stepRK4(this.state.sv, this.spec, fcsControls, massKg, penalties, storeDrag + gearDrag + speedBrakeDrag, dt, flapCL, flapCD, groundClearM)

    // Update state from SV
    this.state.sv = newSV
    this.state.positionNED    = [newSV[0], newSV[1], newSV[2]]
    this.state.velocityNED    = [newSV[3], newSV[4], newSV[5]]
    this.state.attitudeQuat   = [newSV[6], newSV[7], newSV[8], newSV[9]]
    this.state.angularRateBody = [newSV[10], newSV[11], newSV[12]]

    // Derived
    const d = computeDerivedState(newSV, this.spec)
    this.state.alphaDeg   = d.alphaDeg
    this.state.betaDeg    = d.betaDeg
    this.state.mach       = d.mach
    this.state.iasKts     = d.iasKts
    this.state.altitudeM  = d.altitudeM
    this.state.gCurrent   = d.gCurrent
    this.state.gMax       = Math.max(this.state.gMax, Math.abs(d.gCurrent))
    this.state.headingDeg = d.headingDeg
    this.state.pitchDeg   = d.pitch
    this.state.rollDeg    = d.roll
    this.state.vviMps     = d.vviMps
    this.state.throttle   = controls.throttle
    this.state.totalMassKg = massKg

    // Ground clamp
    this.state.onGround = this.state.altitudeM <= groundClearM + 0.1

    // Wheel brakes: friction deceleration ~4 m/s² when on ground with gear down
    if (controls.brakeHeld && this.state.onGround && this.state.gearDown) {
      const vN = this.state.velocityNED[0], vE = this.state.velocityNED[1]
      const gs = Math.sqrt(vN * vN + vE * vE)
      if (gs > 0.1) {
        const scale = Math.max(0, gs - 4.0 * dt) / gs
        this.state.velocityNED[0] = vN * scale
        this.state.velocityNED[1] = vE * scale
      } else {
        this.state.velocityNED[0] = 0
        this.state.velocityNED[1] = 0
      }
      this.state.sv[3] = this.state.velocityNED[0]
      this.state.sv[4] = this.state.velocityNED[1]
    }

    // Fuel burn
    const isAB = controls.throttle >= this.spec.engine.afterburnerThrottleMin
    const sfc  = isAB ? this.spec.engine.sfcWet : this.spec.engine.sfcDry
    const thrustEst = isAB ? this.spec.engine.maxThrustWetN : this.spec.engine.maxThrustDryN
    const burn = sfc * thrustEst * dt * penalties.fuelLeakMultiplier
    this.state.fuelKg = Math.max(0, this.state.fuelKg - burn)
  }

  updateMesh(dt = 0.016): void {
    if (this.state.ejected) { this.mesh.visible = false; return }
    const pos  = nedToThree(this.state.positionNED)
    const quat = nedQuatToThree(this.state.attitudeQuat)
    // PlaceholderMesh fuselage runs along local +X; we need it to face Three.js -Z (NED North).
    // nedQuatToThree(identity) = identity, so add a +90° Y-bias to rotate +X → -Z.
    // This mirrors the group.rotation.y = π/2 in PlaceholderMeshes but is applied
    // AFTER the attitude quaternion so it isn't silently overwritten.
    const meshBias = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), Math.PI / 2
    )
    this.mesh.position.copy(pos)
    this.mesh.quaternion.copy(quat.multiply(meshBias))

    // Engine glow: extinguished when engine is failed
    const thrThrottle = this.damage.engineFailed ? 0 : this.state.throttle
    this.thrusterEffect.update(thrThrottle, dt)

    // Visual damage: tint mesh based on accumulated damage
    applyDamageTint(this.mesh, overallDamage(this.damage), this.damage.onFire)

    // Gear and flap visibility
    setGearVisible(this.mesh, this.state.gearDown)
    setFlapsVisible(this.mesh, this.state.flaps > 0)
  }

  /** Returns the minimal radar info the RWR needs. Overridden by NetworkAircraft. */
  getRadarInfo(): { mode: string; sttTargetId: string | null; tracksPlayer: (id: string) => boolean } | null {
    const rs = this.radar?.state
    if (!rs || rs.mode === 'OFF') return null
    return {
      mode: rs.mode,
      sttTargetId: rs.sttTargetId,
      tracksPlayer: (id) => rs.tracks.some(t => t.entityId === id),
    }
  }

  dispose(): void {
    this.scene.remove(this.mesh)
  }
}
