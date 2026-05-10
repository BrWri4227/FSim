import * as THREE from 'three'
import type { AircraftSpec, AircraftState, ControlInputs } from '../types/aircraft'
import type { LoadedStore, MissileState, GunRoundState } from '../types/weapons'
import type { DamageState } from '../types/damage'
import type { Radar } from '../avionics/Radar'
import { defaultDamageState } from '../types/damage'
import { stepRK4, computeDerivedState, computeActualThrustN } from '../physics/FlightModel'
import { computeTotalMass, computeStoreDrag } from '../physics/MassProperties'
import { createPlaceholderAircraftMesh, createNozzlePoint, applyDamageTint, setGearVisible, setFlapsVisible, getGroundClearance } from '../scene/PlaceholderMeshes'
import { nedToThree, nedQuatToThree, makeStateVec, quatFromEulerZYX, clamp, MESH_BIAS_QUAT, RAD2DEG } from '../utils/MathUtils'
import { computeFlightPenalties, overallDamage } from '../systems/DamageModel'
import type { FlightPenalties } from '../types/damage'
import { ThrusterEffect } from '../scene/ThrusterEffect'
import { applyFCSLimits } from '../avionics/FCS'

let _entityCounter = 0

export class Aircraft {
  readonly type = 'AIRCRAFT' as const
  readonly entityId: string
  readonly spec: AircraftSpec
  state: AircraftState
  damage: DamageState
  radar: Radar | null = null

  mesh: THREE.Group
  protected scene: THREE.Scene
  private thrusterEffect: ThrusterEffect
  private shapedAxes = { pitch: 0, roll: 0, yaw: 0 }

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
      headingDeg: 0, headingRateDegPerSec: 0, pitchDeg: 2, rollDeg: 0, vviMps: 0,
      throttle: 0.3, fuelKg: spec.mass.fuelCapacityKg,
      loadedStores: [...stores],
      totalMassKg: spec.mass.emptyMassKg + spec.mass.fuelCapacityKg,
      onGround: false, ejected: false, invincible: false,
      gearDown: false, gearCollapsed: false, lastTouchdownSinkMS: null,
      flaps: 0, speedBrake: false, brakeHeld: false,
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

    const prevVN = this.state.velocityNED[0]
    const prevVE = this.state.velocityNED[1]
    // Sink rate captured BEFORE the integrator's ground clamp zeros vz on contact.
    // NED: +z = down, so positive vz means descending.
    const preSinkMS = Math.max(0, this.state.velocityNED[2])

    const gearDrag = this.state.gearDown ? 0.05 : 0
    const speedBrakeDrag = this.state.speedBrake ? 0.12 : 0
    const FLAP_CL = [0, 0.5, 1.0] as const
    const FLAP_CD = [0, 0.02, 0.08] as const
    const flapCL = FLAP_CL[this.state.flaps]
    const flapCD = FLAP_CD[this.state.flaps]
    const limitedControls = applyFCSLimits(controls, this.state, this.spec)
    const fcsControls = this.shapeFlightControls(limitedControls, dt)
    const groundClearM = getGroundClearance(this.spec.id, this.state.gearDown)
    const newSV = stepRK4(
      this.state.sv, this.spec, fcsControls, massKg, penalties,
      storeDrag + gearDrag + speedBrakeDrag, dt, flapCL, flapCD, groundClearM,
      this.state.fuelKg,
    )

    // Update state from SV
    this.state.sv = newSV
    this.state.positionNED    = [newSV[0], newSV[1], newSV[2]]
    this.state.velocityNED    = [newSV[3], newSV[4], newSV[5]]
    this.state.attitudeQuat   = [newSV[6], newSV[7], newSV[8], newSV[9]]
    this.state.angularRateBody = [newSV[10], newSV[11], newSV[12]]

    // Derived
    const d = computeDerivedState(newSV, this.spec, massKg)
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

    const vN = newSV[3]!, vE = newSV[4]!
    const vH = Math.hypot(vN, vE)
    const prevH = Math.hypot(prevVN, prevVE)
    if (vH > 8 && prevH > 8 && dt > 1e-6) {
      const psi0 = Math.atan2(prevVE, prevVN)
      const psi1 = Math.atan2(vE, vN)
      let dPsi = psi1 - psi0
      if (dPsi > Math.PI) dPsi -= 2 * Math.PI
      if (dPsi < -Math.PI) dPsi += 2 * Math.PI
      this.state.headingRateDegPerSec = (dPsi / dt) * RAD2DEG
    } else {
      this.state.headingRateDegPerSec = 0
    }

    // Ground state — detect transition for touchdown event
    const wasOnGround = this.state.onGround
    this.state.onGround = this.state.altitudeM <= groundClearM + 0.1
    this.state.brakeHeld = controls.brakeHeld

    if (!wasOnGround && this.state.onGround) {
      // Touchdown event — use pre-step sink rate; the integrator's ground clamp
      // has already zeroed vviMps by the time we reach this point.
      const sinkMS = preSinkMS
      this.state.lastTouchdownSinkMS = sinkMS

      // Gear collapse on hard landing (>5 m/s sink with gear down)
      if (this.state.gearDown && sinkMS > 5) {
        this.state.gearCollapsed = true
        const wear = Math.min(0.6, (sinkMS - 5) * 0.15 + 0.2)
        this.damage.zones.FUSELAGE = Math.min(1, this.damage.zones.FUSELAGE + wear)
        if (sinkMS > 9) this.damage.structuralFailure = true
      } else if (!this.state.gearDown && sinkMS > 3) {
        // Belly landing — much less forgiving
        this.damage.zones.FUSELAGE = Math.min(1, this.damage.zones.FUSELAGE + 0.5)
        if (sinkMS > 6) this.damage.structuralFailure = true
      }
    }

    // Ground roll: rolling + lateral tire friction whenever on ground.
    // Decompose velocity into longitudinal (along nose) and lateral (perpendicular)
    // and decay each separately — much higher coefficient laterally so tires grip.
    if (this.state.onGround) {
      const vN = this.state.velocityNED[0]
      const vE = this.state.velocityNED[1]
      const speedH = Math.hypot(vN, vE)
      if (speedH > 1e-3) {
        const hdgRad = this.state.headingDeg * (Math.PI / 180)
        const fwdN = Math.cos(hdgRad)
        const fwdE = Math.sin(hdgRad)
        const vFwd = vN * fwdN + vE * fwdE
        const vLat = -vN * fwdE + vE * fwdN

        const gearOk = this.state.gearDown && !this.state.gearCollapsed
        const muRoll  = gearOk ? 0.025 : 0.45      // belly slide
        const muBrake = (controls.brakeHeld && gearOk) ? 0.35 : 0
        const muLat   = gearOk ? 0.85 : 0.65        // tires resist sliding sideways
        const G = 9.80665

        const decelLong = (muRoll + muBrake) * G * dt
        const decelLat  = muLat * G * dt
        const newVFwd = Math.sign(vFwd) * Math.max(0, Math.abs(vFwd) - decelLong)
        const newVLat = Math.sign(vLat) * Math.max(0, Math.abs(vLat) - decelLat)

        const newVN = newVFwd * fwdN - newVLat * fwdE
        const newVE = newVFwd * fwdE + newVLat * fwdN
        this.state.velocityNED[0] = newVN
        this.state.velocityNED[1] = newVE
        this.state.sv[3] = newVN
        this.state.sv[4] = newVE
      } else {
        this.state.velocityNED[0] = 0
        this.state.velocityNED[1] = 0
        this.state.sv[3] = 0
        this.state.sv[4] = 0
      }
    }

    // Fuel burn — use the same thrust the integrator applied (throttle-modulated +
    // altitude lapse + damage), not the spec maximum, so partial-throttle and
    // high-altitude cruise burn realistically less.
    const isAB = controls.throttle >= this.spec.engine.afterburnerThrottleMin
    const sfc  = isAB ? this.spec.engine.sfcWet : this.spec.engine.sfcDry
    const actualThrustN = computeActualThrustN(
      this.spec, controls.throttle, this.state.altitudeM, penalties.thrustMultiplier,
    )
    const burn = sfc * actualThrustN * dt * penalties.fuelLeakMultiplier
    this.state.fuelKg = Math.max(0, this.state.fuelKg - burn)
  }

  private shapeFlightControls(controls: ControlInputs, dt: number): ControlInputs {
    const dtSafe = Math.max(dt, 1 / 240)
    const aoaFrac = clamp(Math.abs(this.state.alphaDeg) / Math.max(this.spec.maxAoADeg, 1), 0, 1)
    const dampingBoost = 1 + 0.15 * aoaFrac

    // Keep just enough shaping to prevent jitter, but preserve crisp turn response.
    this.shapedAxes.pitch = this.rateLimitedAxis(this.shapedAxes.pitch, controls.pitch, dtSafe, 0.05 * dampingBoost, 9.0)
    this.shapedAxes.roll = this.rateLimitedAxis(this.shapedAxes.roll, controls.roll, dtSafe, 0.035 * dampingBoost, 12.0)
    this.shapedAxes.yaw = this.rateLimitedAxis(this.shapedAxes.yaw, controls.yaw, dtSafe, 0.04 * dampingBoost, 10.0)

    return {
      ...controls,
      pitch: this.shapedAxes.pitch,
      roll: this.shapedAxes.roll,
      yaw: this.shapedAxes.yaw,
    }
  }

  private rateLimitedAxis(current: number, target: number, dt: number, timeConstantSec: number, maxRatePerSec: number): number {
    const alpha = 1 - Math.exp(-dt / Math.max(timeConstantSec, 1e-3))
    const desired = current + (target - current) * alpha
    const maxDelta = maxRatePerSec * dt
    return current + clamp(desired - current, -maxDelta, maxDelta)
  }

  protected resetFlightControlShaping(): void {
    this.shapedAxes.pitch = 0
    this.shapedAxes.roll = 0
    this.shapedAxes.yaw = 0
  }

  updateMesh(dt = 0.016): void {
    if (this.state.ejected) { this.mesh.visible = false; return }
    const pos  = nedToThree(this.state.positionNED)
    const quat = nedQuatToThree(this.state.attitudeQuat)
    // PlaceholderMesh fuselage runs along local +X; we need it to face Three.js -Z (NED North).
    // nedQuatToThree(identity) = identity, so add a +90° Y-bias to rotate +X → -Z.
    // MESH_BIAS_QUAT is a module-level constant — quat.multiply() modifies quat in-place,
    // so MESH_BIAS_QUAT itself is never mutated.
    this.mesh.position.copy(pos)
    this.mesh.quaternion.copy(quat.multiply(MESH_BIAS_QUAT))

    // Engine glow: extinguished when engine is failed
    const thrThrottle = this.damage.engineFailed ? 0 : this.state.throttle
    const isAfterburner = !this.damage.engineFailed && this.state.throttle >= this.spec.engine.afterburnerThrottleMin
    this.thrusterEffect.update(thrThrottle, isAfterburner, dt)

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
    this.thrusterEffect.dispose()
    this.scene.remove(this.mesh)
  }
}
