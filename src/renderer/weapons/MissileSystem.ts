import * as THREE from 'three'
import type { MissileState } from '../types/weapons'
import type { AircraftState } from '../types/aircraft'
import type { DamageZone } from '../types/damage'
import type { Aircraft } from '../entities/Aircraft'
import type { GroundTarget } from '../entities/GroundTarget'
import { guideMissile, guideMissileCoast, checkIRSeekerLock } from './MissileGuidance'
import { evaluateFlareSeduction, selectBestFlare, computeHeatSignatureKW } from './IRSeeker'
import { checkProximityFuse, computeLethality, hitZoneFromMissileApproach } from './Warhead'
import { v3add, v3scale, v3norm, v3sub, v3dist, v3dot, nedToThree, v3len, quatRotateVec } from '../utils/MathUtils'
import type { MissileSpec } from '../types/weapons'
import { MISSILE_SPECS } from '../data/weapons/catalog'
import { applyHit } from '../systems/DamageModel'
import { ExplosionManager } from '../scene/ExplosionEffect'
import { ThrusterEffect, RocketTrail } from '../scene/ThrusterEffect'
import { computeAtmosphere } from '../physics/Atmosphere'

// Reusable temporaries for mesh orientation — avoids per-frame Vector3 allocations
const _missileDir    = new THREE.Vector3()
const _missileLookAt = new THREE.Vector3()

const G0 = 9.80665

interface CountermeasureProvider {
  cmds?: {
    getActiveFlares?: () => ReadonlyArray<{ positionNED: [number, number, number]; heatSignatureKW: number; ageSec: number }>
    getActiveChaffClouds?: () => ReadonlyArray<{ positionNED: [number, number, number]; velocityNED: [number, number, number]; rcsM2: number; ageSec: number }>
  }
}

let missileBodyGeo: THREE.CylinderGeometry | null = null
let missileNoseGeo: THREE.ConeGeometry | null = null
let missileTailFinGeo: THREE.BoxGeometry | null = null
let missileCanardGeo: THREE.BoxGeometry | null = null

export function buildMissileMesh(bodyMat: THREE.Material, finMat: THREE.Material): THREE.Group {
  const group = new THREE.Group()

  if (!missileBodyGeo) {
    const bodyGeo = new THREE.CylinderGeometry(0.12, 0.15, 2.35, 10)
    bodyGeo.rotateX(Math.PI / 2)
    missileBodyGeo = bodyGeo

    const noseGeo = new THREE.ConeGeometry(0.12, 0.62, 10)
    noseGeo.rotateX(-Math.PI / 2)
    missileNoseGeo = noseGeo

    missileTailFinGeo = new THREE.BoxGeometry(0.72, 0.024, 0.42)
    missileCanardGeo = new THREE.BoxGeometry(0.36, 0.018, 0.22)
  }

  group.add(new THREE.Mesh(missileBodyGeo, bodyMat))

  const noseMesh = new THREE.Mesh(missileNoseGeo!, bodyMat)
  noseMesh.position.z = 1.48
  group.add(noseMesh)

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(missileTailFinGeo!, finMat)
    fin.rotation.z = i * (Math.PI / 2)
    fin.position.z = -0.95
    group.add(fin)
  }

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(missileCanardGeo!, finMat)
    fin.rotation.z = i * (Math.PI / 2)
    fin.position.z = 0.82
    group.add(fin)
  }

  return group
}

/** Pre-compile missile visual shaders at session start to avoid launch hitches. */
export function warmupMissileVisuals(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  bodyMat: THREE.Material,
  finMat: THREE.Material,
): void {
  const root = new THREE.Group()
  root.position.set(0, -99999, 0)
  const mesh = buildMissileMesh(bodyMat, finMat)
  root.add(mesh)
  const rearMount = new THREE.Object3D()
  rearMount.position.set(0, 0, -1.35)
  mesh.add(rearMount)
  new ThrusterEffect(rearMount, 1.4)
  const trail = new RocketTrail(scene, 80, 1.4)
  scene.add(root)
  renderer.compile(root, camera)
  renderer.compile(trail.getPointsObject(), camera)
  scene.remove(root)
  trail.dispose()
}

let sharedMissileBodyMat: THREE.MeshStandardMaterial | undefined
let sharedMissileFinMat: THREE.MeshStandardMaterial | undefined

function getSharedMissileMaterials(): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
  if (!sharedMissileBodyMat) {
    sharedMissileBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0, metalness: 0.55, roughness: 0.45,
      emissive: new THREE.Color(0.04, 0.04, 0.04),
    })
    sharedMissileFinMat = new THREE.MeshStandardMaterial({
      color: 0xa8a8a8, metalness: 0.45, roughness: 0.55, side: THREE.DoubleSide,
    })
  }
  return [sharedMissileBodyMat, sharedMissileFinMat]
}

export class MissileSystem {
  private missiles: MissileState[] = []
  private meshes: THREE.Group[] = []
  private thrusters: ThrusterEffect[] = []
  private trails: RocketTrail[] = []
  private scene: THREE.Scene
  private explosions: ExplosionManager
  private onTargetHit: ((target: Aircraft, zone: DamageZone, severity: number) => void) | null = null
  private onDecoySuccess: ((type: 'FLARE' | 'CHAFF') => void) | null = null

  private bodyMat: THREE.MeshStandardMaterial
  private finMat: THREE.MeshStandardMaterial

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.explosions = new ExplosionManager(scene)
    ;[this.bodyMat, this.finMat] = getSharedMissileMaterials()
  }

  /** Materials used by missile meshes — pass to warmupMissileVisuals at session start. */
  getWarmupMaterials(): [THREE.Material, THREE.Material] {
    return [this.bodyMat, this.finMat]
  }

  setOnTargetHit(cb: ((target: Aircraft, zone: DamageZone, severity: number) => void) | null): void {
    this.onTargetHit = cb
  }

  setOnDecoySuccess(cb: ((type: 'FLARE' | 'CHAFF') => void) | null): void {
    this.onDecoySuccess = cb
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
    const spec = MISSILE_SPECS[weaponId] as MissileSpec | undefined
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
    radarTargetVel?: [number,number,number],
    groundTargets: GroundTarget[] = [],
  ): void {
    this.explosions.update(dt)

    // Build a single O(1) lookup map for this update call — avoids an O(enemies) linear
    // scan inside every missile's loop iteration.
    const enemyById = new Map<string, Aircraft>()
    for (const e of enemies) enemyById.set(e.entityId, e)
    const groundById = new Map<string, GroundTarget>()
    for (const g of groundTargets) groundById.set(g.entityId, g)

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i]!
      m.ageSec += dt

      // Engine burn
      if (m.burnActive && m.ageSec > m.spec.burnTimeSec) m.burnActive = false
      const thrustAccel = m.burnActive ? m.spec.maxThrustN / m.spec.massKg : 0

      // Resolve target aircraft using the pre-built map
      const target: Aircraft | undefined =
        enemyById.get(m.targetEntityId) ??
        (m.targetEntityId === 'player' ? playerAircraft : undefined)
      const targetWithCMDS = target as (Aircraft & CountermeasureProvider) | undefined
      let guidanceTargetPos: [number,number,number] | undefined
      let guidanceTargetVel: [number,number,number] | undefined

      // ── Guidance mode state machine ────────────────────────────────────────

      if (m.spec.category === 'AGM_MISSILE') {
        // Air-to-ground guidance — fixed-point pursuit against a GroundTarget.
        const gt = groundById.get(m.targetEntityId)
        if (gt && !gt.state.destroyed) {
          const gtVel = gt.state.velocityNED as [number, number, number]
          guidanceTargetPos = [...gt.state.positionNED] as [number,number,number]
          guidanceTargetVel = [...gtVel] as [number,number,number]
          m.lastKnownTargetPos = [...guidanceTargetPos] as [number,number,number]
          m.lastKnownTargetVel = [...guidanceTargetVel] as [number,number,number]
          m.locked = true
          m.guidanceMode = 'IR_TRACK'
        } else if (m.guidanceMode !== 'COAST') {
          // Target destroyed or not found — coast onto last known point
          m.guidanceMode = 'COAST'
          m.locked = false
        }
      } else if (target !== undefined) {
        const tPos = target.state.positionNED
        const tVel = target.state.velocityNED

        if (m.spec.category === 'IR_MISSILE') {
          m.lastKnownTargetPos = [...tPos] as [number,number,number]
          m.lastKnownTargetVel = [...tVel] as [number,number,number]
          guidanceTargetPos = [...tPos] as [number,number,number]
          guidanceTargetVel = [...tVel] as [number,number,number]

          const seeker = m.spec.irSeeker
          const flares = targetWithCMDS?.cmds?.getActiveFlares?.() ?? []
          if (seeker && flares.length > 0) {
            // Score flares by seeker-perceived irradiance (heat / dist²) within the
            // gimbal cone — rewards the player for dragging a flare into the FOV.
            const missileVelUnit = v3norm(m.velocityNED) as [number, number, number]
            const bestFlare = selectBestFlare(m.positionNED, missileVelUnit, seeker.gimbalLimitDeg, flares)
            if (bestFlare && Math.random() < Math.min(1, dt * 4)) {
              // Use instantaneous aspect-aware heat so tail-on / AB state matters
              const seekerToTarget: [number, number, number] = [
                tPos[0] - m.positionNED[0],
                tPos[1] - m.positionNED[1],
                tPos[2] - m.positionNED[2],
              ]
              const instantHeatKW = computeHeatSignatureKW(target.spec, target.state, seekerToTarget)
              if (evaluateFlareSeduction(seeker, Math.max(1, instantHeatKW), bestFlare.heatSignatureKW)) {
                guidanceTargetPos = [...bestFlare.positionNED] as [number, number, number]
                guidanceTargetVel = bestFlare.velocityNED
                  ? [...bestFlare.velocityNED] as [number, number, number]
                  : [0, 0, 0]
                this.onDecoySuccess?.('FLARE')
              }
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
          const isAim120 = m.spec.id === 'aim120b'

          // ARH: INERTIAL / DATALINK ─→ ACTIVE at terminal range.
          // AIM-120 specifically only gets midcourse updates while the launcher
          // maintains lock; once ACTIVE it no longer depends on launcher radar.
          if (m.guidanceMode !== 'ACTIVE') {
            const dist = v3dist(m.positionNED, tPos)
            const termRange = m.spec.arSeeker?.terminalActivationRangeM ?? 12000
            if (dist < termRange) {
              m.guidanceMode = 'ACTIVE'
              m.locked = true
            }
          }

          const hasDatalinkTrack = Boolean(
            radarTargetVel && radarTargetPos && m.targetEntityId !== 'player'
          )

          if (m.guidanceMode === 'ACTIVE') {
            guidanceTargetPos = [...tPos] as [number,number,number]
            guidanceTargetVel = [...tVel] as [number,number,number]
            m.lastKnownTargetPos = [...tPos] as [number,number,number]
            m.lastKnownTargetVel = [...tVel] as [number,number,number]
            m.locked = true
          } else if (isAim120) {
            if (hasDatalinkTrack && radarTargetPos && radarTargetVel) {
              m.guidanceMode = 'DATALINK'
              m.locked = true
              m.lastKnownTargetPos = [...radarTargetPos] as [number,number,number]
              m.lastKnownTargetVel = [...radarTargetVel] as [number,number,number]
            } else {
              m.guidanceMode = 'INERTIAL'
              m.locked = false
            }
            guidanceTargetPos = [...m.lastKnownTargetPos] as [number,number,number]
            guidanceTargetVel = [...m.lastKnownTargetVel] as [number,number,number]
          } else {
            // Non-AIM-120 ARH behavior remains unchanged.
            guidanceTargetPos = [...tPos] as [number,number,number]
            guidanceTargetVel = [...tVel] as [number,number,number]
            m.lastKnownTargetPos = [...tPos] as [number,number,number]
            m.lastKnownTargetVel = [...tVel] as [number,number,number]
            if (hasDatalinkTrack && radarTargetPos && radarTargetVel) {
              m.lastKnownTargetPos = [...radarTargetPos] as [number,number,number]
              m.lastKnownTargetVel = [...radarTargetVel] as [number,number,number]
            }
          }

          if (m.guidanceMode === 'ACTIVE') {
            const chaffClouds = targetWithCMDS?.cmds?.getActiveChaffClouds?.() ?? []
            if (chaffClouds.length > 0) {
              // Use squared distance to find nearest chaff cloud — avoids sqrt per comparison
              let nearestChaff: (typeof chaffClouds[number]) | null = null
              let nearestChaffDist2 = Infinity
              for (const chaff of chaffClouds) {
                const dx = m.positionNED[0] - chaff.positionNED[0]
                const dy = m.positionNED[1] - chaff.positionNED[1]
                const dz = m.positionNED[2] - chaff.positionNED[2]
                const d2 = dx*dx + dy*dy + dz*dz
                if (d2 < nearestChaffDist2) { nearestChaffDist2 = d2; nearestChaff = chaff }
              }
              if (nearestChaff && nearestChaff.rcsM2 > 2.0) {
                // Beam-aspect factor: the notch manoeuvre (target perpendicular to LOS)
                // drops closing speed toward zero, making chaff far more convincing.
                // At closing speed ≥400 m/s (head-on pursuit) the factor floors at 0.25.
                const losDir = v3norm(v3sub(tPos, m.positionNED)) as [number, number, number]
                const relVel: [number, number, number] = [
                  m.velocityNED[0] - tVel[0],
                  m.velocityNED[1] - tVel[1],
                  m.velocityNED[2] - tVel[2],
                ]
                const closingSpeed = v3dot(relVel, losDir)
                const beamFactor = Math.max(0.25, 1.0 - Math.min(1, closingSpeed / 400))
                const eccmResist = m.spec.eccmResistance ?? 0
                const seductionP = Math.min(1, dt * 3.2) * beamFactor * (1 - eccmResist)
                if (Math.random() < seductionP) {
                  guidanceTargetPos = [...nearestChaff.positionNED] as [number, number, number]
                  guidanceTargetVel = [...nearestChaff.velocityNED] as [number, number, number]
                  this.onDecoySuccess?.('CHAFF')
                }
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

      // Ground-target proximity hit — independent of guidance target so any missile
      // that gets close enough to a ground entity (e.g. an AGM, or a stray AAM that
      // overflies a SAM site) will detonate against it. Skipped during the first 0.6s
      // of flight (arming delay) and against the missile's own shooter so a SAM doesn't
      // self-destruct on its own launcher. Effective ground fuse = max(prox, lethal)
      // because diving warheads have an impact-fused mode that's more permissive than
      // the small air-to-air proximity fuse.
      if (groundTargets.length > 0 && m.ageSec > 0.6) {
        let hitGT: GroundTarget | null = null
        const groundFuse = Math.max(m.spec.proxFuseRadiusM, m.spec.lethalRadiusM * 0.6)
        const fuseSq = groundFuse * groundFuse
        for (const gt of groundTargets) {
          if (gt.state.destroyed) continue
          if (gt.entityId === m.shooterEntityId) continue
          const dx = m.positionNED[0] - gt.state.positionNED[0]
          const dy = m.positionNED[1] - gt.state.positionNED[1]
          const dz = m.positionNED[2] - gt.state.positionNED[2]
          if (dx*dx + dy*dy + dz*dz < fuseSq) { hitGT = gt; break }
        }
        if (hitGT) {
          const lethality = computeLethality(m.positionNED, hitGT.state.positionNED, m.spec.lethalRadiusM)
          const damage = (m.spec.lethalRadiusM * 4) * Math.max(0.3, lethality)
          hitGT.applyDamage(damage)
          this.explode(i, m)
          continue
        }
      }

      // Ground-impact splash — when the missile hits ground (z >= 0), damage all
      // ground targets within lethal radius horizontally and detonate. Catches
      // near-misses where an AGM hits the ground a few meters short of the target.
      if (m.positionNED[2] >= 0 && m.ageSec > 0.6) {
        for (const gt of groundTargets) {
          if (gt.state.destroyed) continue
          if (gt.entityId === m.shooterEntityId) continue
          const dx = m.positionNED[0] - gt.state.positionNED[0]
          const dy = m.positionNED[1] - gt.state.positionNED[1]
          const dHoriz = Math.hypot(dx, dy)
          if (dHoriz < m.spec.lethalRadiusM) {
            const falloff = 1 - dHoriz / m.spec.lethalRadiusM
            gt.applyDamage(m.spec.lethalRadiusM * 4 * falloff)
          }
        }
        this.explode(i, m)
        continue
      }

      // Expire when seeker battery is depleted or on ground impact.
      if (m.ageSec > m.spec.batteryLifeSec || m.positionNED[2] > 50) {
        this.explode(i, m)
        continue
      }

      // ── Update mesh ────────────────────────────────────────────────────────
      const mesh = this.meshes[i]!
      const worldPos = nedToThree(m.positionNED)
      mesh.position.copy(worldPos)
      if (speed > 1) {
        // Reuse module-level vectors — avoids two Vector3 allocations per active missile per frame
        _missileDir.set(m.velocityNED[1], -m.velocityNED[2], -m.velocityNED[0]).normalize()
        _missileLookAt.addVectors(mesh.position, _missileDir)
        mesh.lookAt(_missileLookAt)
      }

      // Thruster glow fades out after burnout; trail only during burn
      const thrusterIntensity = m.burnActive ? 1.0 : Math.max(0, 1 - (m.ageSec - m.spec.burnTimeSec) * 2)
      this.thrusters[i]?.update(thrusterIntensity, false, dt)
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
    this.explosions.dispose()
  }
}
