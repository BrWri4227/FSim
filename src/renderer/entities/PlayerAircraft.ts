import * as THREE from 'three'
import { Aircraft } from './Aircraft'
import type { AircraftSpec, ControlInputs } from '../types/aircraft'
import type { LoadedStore, MissileState, GunRoundState } from '../types/weapons'
import { GunSystem } from '../weapons/GunSystem'
import { MissileSystem } from '../weapons/MissileSystem'
import { BombSystem, BOMB_SPECS } from '../weapons/BombSystem'
import { Radar } from '../avionics/Radar'
import { RWR } from '../avionics/RWR'
import { CMDS } from '../avionics/CMDS'
import { HMS } from '../avionics/HMS'
import { GPWS } from '../avionics/GPWS'
import { TargetingPod } from '../avionics/TargetingPod'
import type { RWRState } from '../types/radar'
import type { HMSState } from '../types/ir'
import type { DamageZone } from '../types/damage'
import { getMissileSpec, getStoreDragPenalty } from '../data/weapons/catalog'
import { quatRotateVec } from '../utils/MathUtils'

export class PlayerAircraft extends Aircraft {
  private static readonly FLARE_DISPENSER_BODY_X_M = -2.8
  private static readonly FLARE_DISPENSER_BODY_Z_M = 0.85
  private static readonly FLARE_PAIR_SPACING_M = 0.7
  private static readonly FLARE_EJECTION_SPEED_MPS = 35

  readonly gun: GunSystem
  readonly missiles: MissileSystem
  readonly bombs: BombSystem
  readonly radar: Radar
  readonly rwr: RWR
  readonly cmds: CMDS
  readonly hms: HMS
  readonly gpws: GPWS
  readonly targetingPod: TargetingPod

  selectedWeaponIndex = 0
  private ejectKeyPrev = false
  private onMissileLaunch: ((category: 'IR_MISSILE' | 'ARH_MISSILE') => void) | null = null
  private onMissileRadarStateChange: ((missileId: string, mode: MissileState['guidanceMode']) => void) | null = null
  private onGPWSEvent: ((event: 'PULL_UP' | 'PULL_UP_URGENT') => void) | null = null
  private missileRadarModes = new Map<string, MissileState['guidanceMode']>()

  constructor(spec: AircraftSpec, stores: LoadedStore[], scene: THREE.Scene) {
    super(spec, stores, scene, 'player')

    this.gun = new GunSystem(spec.gunSpec, scene)
    this.missiles = new MissileSystem(scene)
    this.bombs = new BombSystem(scene)
    const radarSys = new Radar(spec)
    this.radar = radarSys
    this.rwr = new RWR()
    this.cmds = new CMDS()
    this.hms = new HMS()
    this.gpws = new GPWS()
    this.targetingPod = new TargetingPod()

    // Auto-load default loadout if stores empty
    if (stores.length === 0) this.applyDefaultLoadout()
  }

  private applyDefaultLoadout(): void {
    // Give 2 IR missiles and 4 ARH missiles as defaults
    const irId  = this.spec.nation === 'USA' ? 'aim9x'   : 'r73'
    const arhId = this.spec.nation === 'USA' ? 'aim120b' : 'r77'
    const irSpec = getMissileSpec(irId)
    const arhSpec = getMissileSpec(arhId)
    if (!irSpec || !arhSpec) return
    const irHps  = this.spec.hardpoints.filter(h => h.compatibleTypes.includes('IR_MISSILE')).slice(0,2)
    const arhHps = this.spec.hardpoints.filter(h => h.compatibleTypes.includes('ARH_MISSILE')).slice(0,4)

    for (const hp of irHps) {
      this.state.loadedStores.push({
        hardpointId: hp.id,
        weaponId: irId,
        category: irSpec.category,
        massKg: irSpec.massKg,
        dragPenalty: getStoreDragPenalty(irSpec),
        remainingRounds: 1,
      })
    }
    for (const hp of arhHps) {
      this.state.loadedStores.push({
        hardpointId: hp.id,
        weaponId: arhId,
        category: arhSpec.category,
        massKg: arhSpec.massKg,
        dragPenalty: getStoreDragPenalty(arhSpec),
        remainingRounds: 1,
      })
    }
  }

  update(dt: number, controls: ControlInputs, enemies: Aircraft[], ownNetId?: string, groundTargets: import('./GroundTarget').GroundTarget[] = []): void {
    if (this.state.ejected) return

    if (this.damage.structuralFailure || this.damage.zones['COCKPIT'] >= 1.0) {
      this.eject()
      return
    }

    // Eject check
    if (controls.ejectRequested && !this.ejectKeyPrev) this.eject()
    this.ejectKeyPrev = controls.ejectRequested

    this.integrate(controls, dt)

    if (controls.fireGun) this.gun.fire(this.state, this.spec)
    this.gun.update(dt, enemies)

    if (controls.fireMissile) this.fireMissile(enemies, groundTargets)

    // AMRAAM midcourse support should come only from an active STT lock.
    const sttId = this.radar.getSttTargetId()
    const sttTrack = sttId ? this.radar.getTrack(sttId) : null
    const radarTgtPos = sttTrack?.positionNED as [number,number,number] | undefined
    const radarTgtVel = sttTrack?.velocityNED as [number,number,number] | undefined
    this.missiles.update(dt, this.state, enemies, undefined, radarTgtPos, radarTgtVel, groundTargets)
    this.bombs.update(dt, groundTargets)

    // Targeting pod controls
    if (controls.tgpToggle) this.targetingPod.toggle()
    if (controls.tgpLock) {
      // Wide cone for keyboard ergonomics — pilot doesn't need pixel-perfect aim
      this.targetingPod.lockClosest(this.state.positionNED, this.state.attitudeQuat, groundTargets, 90)
    }
    if (controls.tgpUnlock) this.targetingPod.unlock()
    this.targetingPod.update(this.state.positionNED, this.state.attitudeQuat, groundTargets)
    this.emitMissileRadarModeTransitions()

    // Cycle missile
    if (controls.cycleMissile) this.cycleWeapon()

    // Countermeasures
    if (controls.dispenseFlare) {
      const halfSpacing = PlayerAircraft.FLARE_PAIR_SPACING_M * 0.5
      const leftBody: [number, number, number] = [
        PlayerAircraft.FLARE_DISPENSER_BODY_X_M,
        -halfSpacing,
        PlayerAircraft.FLARE_DISPENSER_BODY_Z_M,
      ]
      const rightBody: [number, number, number] = [
        PlayerAircraft.FLARE_DISPENSER_BODY_X_M,
        halfSpacing,
        PlayerAircraft.FLARE_DISPENSER_BODY_Z_M,
      ]
      const leftOffsetNED = quatRotateVec(this.state.attitudeQuat, leftBody)
      const rightOffsetNED = quatRotateVec(this.state.attitudeQuat, rightBody)
      const leftSpawnNED: [number, number, number] = [
        this.state.positionNED[0] + leftOffsetNED[0],
        this.state.positionNED[1] + leftOffsetNED[1],
        this.state.positionNED[2] + leftOffsetNED[2],
      ]
      const rightSpawnNED: [number, number, number] = [
        this.state.positionNED[0] + rightOffsetNED[0],
        this.state.positionNED[1] + rightOffsetNED[1],
        this.state.positionNED[2] + rightOffsetNED[2],
      ]

      // Left/right flare vectors are symmetric and 120 degrees apart.
      const leftEjectDirBody: [number, number, number] = [-0.5, -0.8660254, 0]
      const rightEjectDirBody: [number, number, number] = [-0.5, 0.8660254, 0]
      const leftEjectDirNED = quatRotateVec(this.state.attitudeQuat, leftEjectDirBody)
      const rightEjectDirNED = quatRotateVec(this.state.attitudeQuat, rightEjectDirBody)
      const leftVelocityNED: [number, number, number] = [
        this.state.velocityNED[0] + leftEjectDirNED[0] * PlayerAircraft.FLARE_EJECTION_SPEED_MPS,
        this.state.velocityNED[1] + leftEjectDirNED[1] * PlayerAircraft.FLARE_EJECTION_SPEED_MPS,
        this.state.velocityNED[2] + leftEjectDirNED[2] * PlayerAircraft.FLARE_EJECTION_SPEED_MPS,
      ]
      const rightVelocityNED: [number, number, number] = [
        this.state.velocityNED[0] + rightEjectDirNED[0] * PlayerAircraft.FLARE_EJECTION_SPEED_MPS,
        this.state.velocityNED[1] + rightEjectDirNED[1] * PlayerAircraft.FLARE_EJECTION_SPEED_MPS,
        this.state.velocityNED[2] + rightEjectDirNED[2] * PlayerAircraft.FLARE_EJECTION_SPEED_MPS,
      ]
      this.cmds.dispenseFlarePair([
        { positionNED: leftSpawnNED, velocityNED: leftVelocityNED },
        { positionNED: rightSpawnNED, velocityNED: rightVelocityNED },
      ])
    }
    if (controls.dispenseChaff) this.cmds.dispenseChaff(this.state.positionNED, this.state.velocityNED)
    this.cmds.update(dt)

    // Landing gear toggle
    if (controls.toggleGear) this.state.gearDown = !this.state.gearDown

    // Flap cycle: UP → TAKEOFF → LANDING → UP
    if (controls.cycleFlaps) this.state.flaps = ((this.state.flaps + 1) % 3) as 0 | 1 | 2

    // Speed brakes toggle
    if (controls.speedBrakeToggle) this.state.speedBrake = !this.state.speedBrake
    // Auto-retract flaps above limit speed (250 kts for pos 1, 200 kts for pos 2)
    if (this.state.flaps === 2 && this.state.iasKts > 200) this.state.flaps = 1
    if (this.state.flaps === 1 && this.state.iasKts > 250) this.state.flaps = 0

    // Avionics
    this.radar.update(dt, this.state, enemies, controls.radarModeNext, false, groundTargets)
    if (controls.radarSelectNext) this.radar.selectNextTrack()
    if (controls.radarLockTarget) this.radar.lockSelectedTarget()
    if (controls.radarUnlock)     this.radar.unlockSTT()
    this.rwr.update(enemies, this.state, ownNetId ?? 'player')
    this.hms.update(this.state)
    this.gpws.update(this.state, dt, event => {
      this.onGPWSEvent?.(event)
    })
  }

  setOnTargetHit(cb: ((targetId: string, zone: DamageZone, severity: number, weapon: 'GUN' | 'MISSILE') => void) | null): void {
    this.gun.setOnTargetHit(cb ? (target, zone, severity) => cb(target.entityId, zone, severity, 'GUN') : null)
    this.missiles.setOnTargetHit(cb ? (target, zone, severity) => cb(target.entityId, zone, severity, 'MISSILE') : null)
  }

  setOnMissileLaunch(cb: ((category: 'IR_MISSILE' | 'ARH_MISSILE') => void) | null): void {
    this.onMissileLaunch = cb
  }

  setOnMissileRadarStateChange(cb: ((missileId: string, mode: MissileState['guidanceMode']) => void) | null): void {
    this.onMissileRadarStateChange = cb
  }

  setOnGPWSEvent(cb: ((event: 'PULL_UP' | 'PULL_UP_URGENT') => void) | null): void {
    this.onGPWSEvent = cb
  }

  private fireMissile(enemies: Aircraft[], groundTargets: import('./GroundTarget').GroundTarget[] = []): void {
    const store = this.getSelectedMissileStore()
    if (!store || store.remainingRounds <= 0) return

    // Bomb drop branch — dispatched from the same fire button.
    if (store.category === 'BOMB' || store.category === 'LGB') {
      const bombSpec = BOMB_SPECS[store.weaponId]
      if (!bombSpec) return
      const hpDef = this.spec.hardpoints.find(h => h.id === store.hardpointId)
      const hpBody = hpDef?.posBodyM as [number,number,number] | undefined
      // LGB uses STT-locked ground target as designation if available
      let designated: [number, number, number] | null = null
      if (store.category === 'LGB' && groundTargets.length > 0) {
        // Use closest ground target inside forward 45° cone as auto-designation
        const ps = this.state.positionNED
        const fwd = quatRotateVec(this.state.attitudeQuat, [1, 0, 0])
        let best: import('./GroundTarget').GroundTarget | null = null
        let bestDist2 = Infinity
        for (const gt of groundTargets) {
          if (gt.state.destroyed) continue
          const dx = gt.state.positionNED[0] - ps[0]
          const dy = gt.state.positionNED[1] - ps[1]
          const dz = gt.state.positionNED[2] - ps[2]
          const d2 = dx*dx + dy*dy + dz*dz
          const d = Math.sqrt(d2)
          const dot = (dx*fwd[0] + dy*fwd[1] + dz*fwd[2]) / Math.max(d, 1)
          if (dot < 0.7071) continue   // ~45° cone
          if (d2 < bestDist2) { bestDist2 = d2; best = gt }
        }
        if (best) designated = [...best.state.positionNED] as [number, number, number]
      }
      this.bombs.drop(bombSpec, this.state.positionNED, this.state.velocityNED, this.state.attitudeQuat, hpBody, designated)
      store.remainingRounds = 0
      return
    }

    let targetId: string | null = null
    let tgtPos: [number,number,number] | undefined
    let tgtVel: [number,number,number] | undefined

    if (store.category === 'AGM_MISSILE') {
      // Find closest ground target inside a 30° forward cone, max 12 km
      const ps = this.state.positionNED
      const fwd = quatRotateVec(this.state.attitudeQuat, [1, 0, 0])
      let best: import('./GroundTarget').GroundTarget | null = null
      let bestDist2 = Infinity
      for (const gt of groundTargets) {
        if (gt.state.destroyed) continue
        const dx = gt.state.positionNED[0] - ps[0]
        const dy = gt.state.positionNED[1] - ps[1]
        const dz = gt.state.positionNED[2] - ps[2]
        const d2 = dx*dx + dy*dy + dz*dz
        if (d2 > 12000 * 12000) continue
        const d = Math.sqrt(d2)
        const dot = (dx*fwd[0] + dy*fwd[1] + dz*fwd[2]) / Math.max(d, 1)
        if (dot < 0.866) continue   // ~30° cone
        if (d2 < bestDist2) { bestDist2 = d2; best = gt }
      }
      if (!best) return
      targetId = best.entityId
      tgtPos = [...best.state.positionNED] as [number,number,number]
      tgtVel = [...best.state.velocityNED] as [number,number,number]
    } else {
      const sttTargetId = this.radar.getSttTargetId()
      if (store.weaponId === 'aim120b' && !sttTargetId) {
        // AIM-120 launch requires a valid radar lock for midcourse support.
        return
      }
      targetId = sttTargetId ?? this.hms.state.lockedEntityId
      if (!targetId && enemies.length > 0) {
        const nearest = enemies.reduce((a, b) => {
          const da = Math.hypot(...(a.state.positionNED.map((v,i) => v - this.state.positionNED[i]!) as [number,number,number]))
          const db = Math.hypot(...(b.state.positionNED.map((v,i) => v - this.state.positionNED[i]!) as [number,number,number]))
          return da < db ? a : b
        })
        targetId = nearest.entityId
      }
      if (!targetId) return
      const tgtAircraft = enemies.find(e => e.entityId === targetId)
      tgtPos = tgtAircraft?.state.positionNED as [number,number,number] | undefined
      tgtVel = tgtAircraft?.state.velocityNED as [number,number,number] | undefined
    }

    // Find the hardpoint definition to get the body-frame launch offset
    const hpDef = this.spec.hardpoints.find(h => h.id === store.hardpointId)
    const hpBody = hpDef?.posBodyM as [number,number,number] | undefined

    this.missiles.launch(store.weaponId, this.state, targetId, 'player', tgtPos, tgtVel, hpBody)
    store.remainingRounds = 0
    if (store.category === 'IR_MISSILE' || store.category === 'ARH_MISSILE') {
      this.onMissileLaunch?.(store.category)
    }
  }

  private getAvailableMissileWeaponIds(): string[] {
    const ids: string[] = []
    const seen = new Set<string>()
    for (const store of this.state.loadedStores) {
      const isFireable =
        store.category === 'IR_MISSILE' ||
        store.category === 'ARH_MISSILE' ||
        store.category === 'AGM_MISSILE' ||
        store.category === 'BOMB' ||
        store.category === 'LGB'
      if (!isFireable || store.remainingRounds <= 0 || seen.has(store.weaponId)) continue
      seen.add(store.weaponId)
      ids.push(store.weaponId)
    }
    return ids
  }

  private getSelectedMissileWeaponId(): string | null {
    const weaponIds = this.getAvailableMissileWeaponIds()
    if (weaponIds.length === 0) return null
    this.selectedWeaponIndex = ((this.selectedWeaponIndex % weaponIds.length) + weaponIds.length) % weaponIds.length
    return weaponIds[this.selectedWeaponIndex] ?? null
  }

  private getSelectedMissileStore(): LoadedStore | null {
    const selectedWeaponId = this.getSelectedMissileWeaponId()
    if (!selectedWeaponId) return null
    return this.state.loadedStores.find(s =>
      s.weaponId === selectedWeaponId &&
      (s.category === 'IR_MISSILE' || s.category === 'ARH_MISSILE' || s.category === 'AGM_MISSILE' || s.category === 'BOMB' || s.category === 'LGB') &&
      s.remainingRounds > 0
    ) ?? null
  }

  private emitMissileRadarModeTransitions(): void {
    const activeMissiles = this.missiles.getMissiles().filter(m => m.active && m.spec.category === 'ARH_MISSILE')
    const seen = new Set<string>()

    for (const missile of activeMissiles) {
      seen.add(missile.id)
      const prevMode = this.missileRadarModes.get(missile.id)
      const nextMode = missile.guidanceMode
      if (prevMode !== undefined && prevMode !== nextMode) {
        this.onMissileRadarStateChange?.(missile.id, nextMode)
      }
      this.missileRadarModes.set(missile.id, nextMode)
    }

    for (const id of this.missileRadarModes.keys()) {
      if (!seen.has(id)) this.missileRadarModes.delete(id)
    }
  }

  getSelectedWeaponName(): string {
    const selectedWeaponId = this.getSelectedMissileWeaponId()
    if (!selectedWeaponId) return this.spec.gunSpec ? 'GUN' : 'NONE'
    return selectedWeaponId.toUpperCase()
  }

  cycleWeapon(): void {
    const count = this.getAvailableMissileWeaponIds().length
    if (count > 0) this.selectedWeaponIndex = (this.selectedWeaponIndex + 1) % count
  }

  eject(): void {
    if (this.state.ejected) return
    this.state.ejected = true
    this.damage.ejected = true
    console.log('EJECT EJECT EJECT')
  }

  reloadWeapons(): void {
    for (const store of this.state.loadedStores) store.remainingRounds = 1
    this.gun.refill()
    this.cmds.reloadCountermeasures()
  }

  /** Debug helper: append AGM-65 ×2 and Mk-82 ×4 to the loadout on A/G-capable hardpoints. */
  loadAirToGroundStores(): void {
    const agmSpec = getMissileSpec('agm65')
    const agmHps = this.spec.hardpoints.filter(h => h.compatibleTypes.includes('AGM_MISSILE'))
    let agmCount = 0
    for (const hp of agmHps) {
      if (agmCount >= 2 || !agmSpec) break
      if (this.state.loadedStores.some(s => s.hardpointId === hp.id && s.remainingRounds > 0)) continue
      this.state.loadedStores.push({
        hardpointId: hp.id,
        weaponId: 'agm65',
        category: 'AGM_MISSILE',
        massKg: agmSpec.massKg,
        dragPenalty: getStoreDragPenalty(agmSpec),
        remainingRounds: 1,
      })
      agmCount++
    }
    const bombHps = this.spec.hardpoints.filter(h => h.compatibleTypes.includes('BOMB'))
    let bombCount = 0
    for (const hp of bombHps) {
      if (bombCount >= 4) break
      if (this.state.loadedStores.some(s => s.hardpointId === hp.id && s.remainingRounds > 0)) continue
      this.state.loadedStores.push({
        hardpointId: hp.id,
        weaponId: 'mk82',
        category: 'BOMB',
        massKg: 227,
        dragPenalty: 0.0025,
        remainingRounds: 1,
      })
      bombCount++
    }
  }

  resetPosition(): void {
    const q = [1, 0, 0, 0] as [number,number,number,number]
    this.state.sv = [0, 0, -5000, 250, 0, 0, 1, 0, 0, 0, 0, 0, 0]
    this.state.positionNED = [0, 0, -5000]
    this.state.velocityNED = [250, 0, 0]
    this.state.attitudeQuat = q
    this.state.angularRateBody = [0, 0, 0]
    this.state.ejected = false
    this.state.fuelKg = this.spec.mass.fuelCapacityKg
    this.state.gearCollapsed = false
    this.state.lastTouchdownSinkMS = null
    this.mesh.visible = true
  }

  getRWRState(): RWRState { return this.rwr.state }
  getHMSState(): HMSState { return this.hms.state }

  dispose(): void {
    this.gun.dispose()
    this.missiles.dispose()
    this.bombs.dispose()
    super.dispose()
  }
}
