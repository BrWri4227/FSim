import * as THREE from 'three'
import type { MissileState } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import type { DamageZone } from '../types/damage'
import type { Aircraft } from '../entities/Aircraft'
import { guideMissile, guideMissileCoast, checkIRSeekerLock } from './MissileGuidance'
import { evaluateFlareSeduction } from './IRSeeker'
import { checkProximityFuse, computeLethality, hitZoneFromMissileApproach } from './Warhead'
import { v3add, v3scale, v3norm, v3sub, v3dist, nedToThree, v3len, quatRotateVec } from '../utils/MathUtils'
import { AIM9M }   from '../data/weapons/aim9m'
import { AIM120B } from '../data/weapons/aim120b'
import { R73 }     from '../data/weapons/r73'
import { R77 }     from '../data/weapons/r77'
import type { MissileSpec } from '../types/weapons'
import { applyHit } from '../systems/DamageModel'
import { ExplosionManager } from '../scene/ExplosionEffect'
import { ThrusterEffect, RocketTrail } from '../scene/ThrusterEffect'
import { computeAtmosphere } from '../physics/Atmosphere'

const MISSILE_SPECS: Record<string, MissileSpec> = { aim9m: AIM9M, aim120b: AIM120B, r73: R73, r77: R77 }
const G0 = 9.80665

interface CountermeasureProvider {
  cmds?: {
    getActiveFlares?: () => ReadonlyArray<{ positionNED: [number, number, number]; heatSignatureKW: number; ageSec: number }>
    getActiveChaffClouds?: () => ReadonlyArray<{ positionNED: [number, number, number]; velocityNED: [number, number, number]; rcsM2: number; ageSec: number }>
  }
}

// ---------------------------------------------------------------------------
// Build a detailed missile Group: body + nose cone + 4 tail fins + 4 canards
// The long axis runs along +Z so mesh.lookAt() aligns it with velocity.
// ---------------------------------------------------------------------------
function buildMissileMesh(bodyMat: THREE.Material, finMat: THREE.Material): THREE.Group {
  const group = new THREE.Group()

  // Body cylinder (tapered slightly at tail)
  const bodyGeo = new THREE.CylinderGeometry(0.09, 0.12, 2.1, 8)
  bodyGeo.rotateX(Math.PI / 2)
  group.add(new THREE.Mesh(bodyGeo, bodyMat))

  // Nose cone
  const noseGeo = new THREE.ConeGeometry(0.09, 0.55, 8)
  noseGeo.rotateX(-Math.PI / 2)   // tip → +Z
  const noseMesh = new THREE.Mesh(noseGeo, bodyMat)
  noseMesh.position.z = 1.325
  group.add(noseMesh)

  // Tail fins — 4× cruciform, 0.5 m span, at z = -0.85
  const tailFinGeo = new THREE.BoxGeometry(0.55, 0.018, 0.32)
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(tailFinGeo, finMat)
    fin.rotation.z = i * (Math.PI / 2)
    fin.position.z = -0.85
    group.add(fin)
  }

  // Canard fins — 4× smaller, at z = +0.7 (forward third)
  const canardGeo = new THREE.BoxGeometry(0.28, 0.014, 0.18)
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(canardGeo, finMat)
    fin.rotation.z = i * (Math.PI / 2)
    fin.position.z = 0.7
    group.add(fin)
  }

  return group
}

export class MissileSystem {
  private missiles: MissileState[] = []
  private meshes: THREE.Group[] = []
  private thrusters: ThrusterEffect[] = []
  private trails: RocketTrail[] = []
  private scene: THREE.Scene
  private explosions: ExplosionManager
  private onTargetHit: ((target: Aircraft, zone: DamageZone, severity: number) => void) | null = null

  private bodyMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, emissive: 0x222222, shininess: 60 })
  private finMat  = new THREE.MeshPhongMaterial({ color: 0x888888, emissive: 0x111111, side: THREE.DoubleSide })

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.explosions = new ExplosionManager(scene)
  }

  setOnTargetHit(cb: ((target: Aircraft, zone: DamageZone, severity: number) => void) | null): void {
    this.onTargetHit = cb
  }

  launch(
    weaponId: string,
    shooterState: AircraftState,
    targetId: string,
    shooterEntityId: string,
    initialTargetPos?: [number,number,number],
    initialTargetVel?: [number,number,number],
    hardpointPosBody?: [number,number,number]
  ): void {
    const spec = MISSILE_SPECS[weaponId]
    if (!spec) return

    // Initial velocity: shooter velocity + muzzle impulse along body axis
    const bodyForward: [number,number,number] = [1, 0, 0]
    const forwardNED = quatRotateVec(shooterState.attitudeQuat, bodyForward)
    const initVel = v3add(shooterState.velocityNED, v3scale(forwardNED, 120))

    // Launch position: aircraft centre + hardpoint offset rotated into NED frame.
    // Without this all missiles appear to spawn from the fuselage centreline.
    const hpNED = hardpointPosBody
      ? quatRotateVec(shooterState.attitudeQuat, hardpointPosBody)
      : [0, 0, 0] as [number,number,number]
    const initPos: [number,number,number] = [
      shooterState.positionNED[0] + hpNED[0],
      shooterState.positionNED[1] + hpNED[1],
      shooterState.positionNED[2] + hpNED[2],
    ]

    const knownPos: [number,number,number] = initialTargetPos ?? [0, 0, 0]
    const knownVel: [number,number,number] = initialTargetVel ?? [0, 0, 0]

    // Seed prevLOS with the actual launch-time LOS so there's no first-tick spike.
    const launchLOS: [number,number,number] = knownPos[0] !== 0 || knownPos[1] !== 0 || knownPos[2] !== 0
      ? v3norm(v3sub(knownPos, initPos)) as [number,number,number]
      : v3norm(forwardNED) as [number,number,number]

    const missile: MissileState = {
      id: `missile_${Date.now()}_${Math.random()}`,
      spec,
      positionNED: initPos,
      velocityNED: initVel,
      attitudeQuat: [...shooterState.attitudeQuat] as [number,number,number,number],
      ageSec: 0,
      burnActive: true,
      targetEntityId: targetId,
      // ARH starts in INERTIAL (switches to ACTIVE at terminal range)
      // IR starts in IR_TRACK
      guidanceMode: spec.category === 'IR_MISSILE' ? 'IR_TRACK' : 'INERTIAL',
      seekerAzDeg: 0,
      seekerElDeg: 0,
      locked: true,
      prevLOSUnit: launchLOS,
      prevTargetVel: knownVel,
      lastKnownTargetPos: knownPos,
      lastKnownTargetVel: knownVel,
      active: true,
      shooterEntityId,
    }
    this.missiles.push(missile)

    // Visual mesh
    const mesh = buildMissileMesh(this.bodyMat, this.finMat)
    this.scene.add(mesh)
    this.meshes.push(mesh)

    // Thruster glow at rear (z = -1.35 in local space)
    const rearMount = new THREE.Object3D()
    rearMount.position.set(0, 0, -1.35)
    mesh.add(rearMount)
    this.thrusters.push(new ThrusterEffect(rearMount, 1.4))

    // Smoke trail — longer lifetime and more points for better visual
    this.trails.push(new RocketTrail(this.scene, 80, 1.4))
  }

  // shooterRadarTargetPos/Vel: current radar track of the target (for ARH datalink)
  update(
    dt: number,
    shooterState: AircraftState,
    enemies: Aircraft[],
    playerAircraft?: Aircraft,
    radarTargetPos?: [number,number,number],
    radarTargetVel?: [number,number,number]
  ): void {
    this.explosions.update(dt)

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i]!
      m.ageSec += dt

      // Engine burn
      if (m.burnActive && m.ageSec > m.spec.burnTimeSec) m.burnActive = false
      const thrustAccel = m.burnActive ? m.spec.maxThrustN / m.spec.massKg : 0

      // Resolve target aircraft
      const target: Aircraft | undefined =
        enemies.find(e => e.entityId === m.targetEntityId) ??
        (m.targetEntityId === 'player' ? playerAircraft : undefined)
      const targetWithCMDS = target as (Aircraft & CountermeasureProvider) | undefined
      let guidanceTargetPos: [number,number,number] | undefined = target?.state.positionNED as [number,number,number] | undefined
      let guidanceTargetVel: [number,number,number] | undefined = target?.state.velocityNED as [number,number,number] | undefined

      // ── Guidance mode state machine ────────────────────────────────────────

      if (target !== undefined) {
        const tPos = target.state.positionNED
        const tVel = target.state.velocityNED

        // Always refresh last-known so coast guidance is accurate
        m.lastKnownTargetPos = [...tPos] as [number,number,number]
        m.lastKnownTargetVel = [...tVel] as [number,number,number]

        if (m.spec.category === 'IR_MISSILE') {
          const seeker = m.spec.irSeeker
          const flares = targetWithCMDS?.cmds?.getActiveFlares?.() ?? []
          if (seeker && flares.length > 0) {
            const nearestFlare = flares.reduce((best, flare) => {
              if (!best) return flare
              return v3dist(m.positionNED, flare.positionNED) < v3dist(m.positionNED, best.positionNED) ? flare : best
            }, null as (typeof flares[number] | null))
            if (
              nearestFlare &&
              Math.random() < Math.min(1, dt * 4) &&
              evaluateFlareSeduction(seeker, Math.max(1, target.spec.heatSignatureBaseKW), nearestFlare.heatSignatureKW)
            ) {
              guidanceTargetPos = [...nearestFlare.positionNED] as [number,number,number]
              guidanceTargetVel = [0, 0, 0]
            }
          }
          // IR seeker: allow 0.8 s for the missile to physically turn toward
          // the target after launch before the gimbal check engages.
          // This simulates the pilot having a seeker-slew lock before firing.
          if (m.guidanceMode === 'IR_TRACK' && m.ageSec > 0.8) {
            if (!guidanceTargetPos || !checkIRSeekerLock(m, guidanceTargetPos)) {
              m.locked = false
              m.guidanceMode = 'COAST'
            }
          }
        } else {
          // ARH: INERTIAL / DATALINK ─→ ACTIVE at terminal range
          if (m.guidanceMode !== 'ACTIVE') {
            const dist = v3dist(m.positionNED, tPos)
            const termRange = m.spec.arSeeker?.terminalActivationRangeM ?? 12000
            if (dist < termRange) {
              m.guidanceMode = 'ACTIVE'
              m.locked = true
            }
            // Datalink: update aim point from shooter's radar track
            if (radarTargetVel && radarTargetPos && m.targetEntityId !== 'player') {
              m.lastKnownTargetPos = [...radarTargetPos] as [number,number,number]
              m.lastKnownTargetVel = [...radarTargetVel] as [number,number,number]
            }
          }
          if (m.guidanceMode === 'ACTIVE') {
            const chaffClouds = targetWithCMDS?.cmds?.getActiveChaffClouds?.() ?? []
            if (chaffClouds.length > 0) {
              const nearestChaff = chaffClouds.reduce((best, chaff) => {
                if (!best) return chaff
                return v3dist(m.positionNED, chaff.positionNED) < v3dist(m.positionNED, best.positionNED) ? chaff : best
              }, null as (typeof chaffClouds[number] | null))
              if (nearestChaff && nearestChaff.rcsM2 > 2.0 && Math.random() < Math.min(1, dt * 3.2)) {
                guidanceTargetPos = [...nearestChaff.positionNED] as [number,number,number]
                guidanceTargetVel = [...nearestChaff.velocityNED] as [number,number,number]
              }
            }
          }
        }
      } else {
        // Target entity gone — enter coast mode if we were still tracking
        if (m.guidanceMode !== 'COAST') {
          m.guidanceMode = 'COAST'
          m.locked = false
        }
      }

      // ── Compute guidance acceleration ──────────────────────────────────────
      let guidanceAccel: [number,number,number] = [0, 0, 0]

      if (m.guidanceMode === 'COAST') {
        guidanceAccel = guideMissileCoast(m, dt)
      } else if (guidanceTargetPos && guidanceTargetVel) {
        guidanceAccel = guideMissile(m, guidanceTargetPos, guidanceTargetVel, dt)

        // Proximity fuse
        if (target !== undefined && checkProximityFuse(m, target.state)) {
          const lethality = computeLethality(m.positionNED, target.state.positionNED, m.spec.lethalRadiusM)
          if (lethality > 0.3) {
            const zone = hitZoneFromMissileApproach(m.velocityNED, target.state.attitudeQuat)
            const severity = lethality * 0.65
            applyHit(target.damage, zone, severity, target.state.invincible)
            this.onTargetHit?.(target, zone, severity)
            // Proximity blast: secondary fragments can hit adjacent zones
            if (lethality > 0.7 && !target.state.invincible) {
              const secondary: DamageZone[] = ['FUSELAGE', 'ENGINE', 'WING_LEFT', 'WING_RIGHT']
              for (const sz of secondary) {
                if (sz !== zone) applyHit(target.damage, sz, lethality * 0.15)
              }
            }
          }
          this.explode(i, m)
          continue
        }
      }

      // ── Physics integration (Euler) ────────────────────────────────────────
      const speed = v3len(m.velocityNED)
      const altM = Math.max(0, -m.positionNED[2])
      const rho = computeAtmosphere(altM, speed).densityKgM3
      const A = Math.PI * (m.spec.bodyDiameterM / 2) ** 2
      const dragAccel = (0.5 * rho * m.spec.dragCd * A * speed * speed) / m.spec.massKg
      const dragDir: [number,number,number] = speed > 0.1
        ? v3scale(v3norm(m.velocityNED), -dragAccel) as [number,number,number]
        : [0, 0, 0]

      const gravity: [number,number,number] = [0, 0, G0]
      const thrustVec = v3scale(v3norm(m.velocityNED) as [number,number,number], thrustAccel) as [number,number,number]

      const totalAccel = v3add(v3add(v3add(thrustVec, dragDir), gravity), guidanceAccel)
      m.velocityNED = v3add(m.velocityNED, v3scale(totalAccel, dt)) as [number,number,number]
      m.positionNED = v3add(m.positionNED, v3scale(m.velocityNED, dt)) as [number,number,number]

      // Expire on max range or ground impact
      if (m.ageSec > m.spec.maxRangeM / 350 || m.positionNED[2] > 50) {
        this.explode(i, m)
        continue
      }

      // ── Update mesh ────────────────────────────────────────────────────────
      const mesh = this.meshes[i]!
      const worldPos = nedToThree(m.positionNED)
      mesh.position.copy(worldPos)
      if (speed > 1) {
        const dir = nedToThree(m.velocityNED).normalize()
        mesh.lookAt(mesh.position.clone().add(dir))
      }

      // Thruster glow fades out after burnout; trail only during burn
      const thrusterIntensity = m.burnActive ? 1.0 : Math.max(0, 1 - (m.ageSec - m.spec.burnTimeSec) * 2)
      this.thrusters[i]?.update(thrusterIntensity, dt)
      if (m.burnActive) this.trails[i]?.addPoint(worldPos)
      this.trails[i]?.update(dt)
    }
  }

  private explode(i: number, m: MissileState): void {
    this.explosions.spawn(nedToThree(m.positionNED))
    this.scene.remove(this.meshes[i]!)
    this.thrusters[i]?.dispose()
    this.trails[i]?.dispose()
    this.missiles.splice(i, 1)
    this.meshes.splice(i, 1)
    this.thrusters.splice(i, 1)
    this.trails.splice(i, 1)
  }

  getMissiles(): MissileState[] { return this.missiles }

  dispose(): void {
    for (const m of this.meshes) this.scene.remove(m)
    for (const t of this.thrusters) t.dispose()
    for (const t of this.trails) t.dispose()
    this.bodyMat.dispose()
    this.finMat.dispose()
    this.explosions.dispose()
  }
}
