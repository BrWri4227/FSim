import * as THREE from 'three'
import { Aircraft } from './Aircraft'
import type { AircraftSpec, ControlInputs } from '../types/aircraft'
import type { LoadedStore, MissileState, GunRoundState } from '../types/weapons'
import { GunSystem } from '../weapons/GunSystem'
import { MissileSystem } from '../weapons/MissileSystem'
import { Radar } from '../avionics/Radar'
import { RWR } from '../avionics/RWR'
import { CMDS } from '../avionics/CMDS'
import { HMS } from '../avionics/HMS'
import { GPWS } from '../avionics/GPWS'
import type { RWRState } from '../types/radar'
import type { HMSState } from '../types/ir'
import { DEFAULT_BINDINGS } from '../input/ControlMapping'

export class PlayerAircraft extends Aircraft {
  readonly gun: GunSystem
  readonly missiles: MissileSystem
  readonly radar: Radar
  readonly rwr: RWR
  readonly cmds: CMDS
  readonly hms: HMS
  readonly gpws: GPWS

  selectedWeaponIndex = 0
  private ejectKeyPrev = false

  constructor(spec: AircraftSpec, stores: LoadedStore[], scene: THREE.Scene) {
    super(spec, stores, scene, 'player')

    this.gun = new GunSystem(spec.gunSpec, scene)
    this.missiles = new MissileSystem(scene)
    const radarSys = new Radar(spec)
    this.radar = radarSys
    this.rwr = new RWR()
    this.cmds = new CMDS()
    this.hms = new HMS()
    this.gpws = new GPWS()

    // Auto-load default loadout if stores empty
    if (stores.length === 0) this.applyDefaultLoadout()
  }

  private applyDefaultLoadout(): void {
    // Give 2 IR missiles and 4 ARH missiles as defaults
    const irId  = this.spec.nation === 'USA' ? 'aim9m'   : 'r73'
    const arhId = this.spec.nation === 'USA' ? 'aim120b' : 'r77'
    const irHps  = this.spec.hardpoints.filter(h => h.compatibleTypes.includes('IR_MISSILE')).slice(0,2)
    const arhHps = this.spec.hardpoints.filter(h => h.compatibleTypes.includes('ARH_MISSILE')).slice(0,4)

    for (const hp of irHps) {
      this.state.loadedStores.push({ hardpointId: hp.id, weaponId: irId, category: 'IR_MISSILE', massKg: 100, dragPenalty: 0.002, remainingRounds: 1 })
    }
    for (const hp of arhHps) {
      this.state.loadedStores.push({ hardpointId: hp.id, weaponId: arhId, category: 'ARH_MISSILE', massKg: 155, dragPenalty: 0.003, remainingRounds: 1 })
    }
  }

  update(dt: number, controls: ControlInputs): void {
    if (this.state.ejected) return

    // Eject check
    const ejectKey = document.getElementById('three-canvas') !== null &&
      (window as any)._fsimEjectPressed === true
    if (ejectKey && !this.ejectKeyPrev) this.eject()
    this.ejectKeyPrev = ejectKey

    this.integrate(controls, dt)

    // Weapons
    const enemies: Aircraft[] = (window as any)._fsimEnemies ?? []

    if (controls.fireGun) this.gun.fire(this.state, this.spec)
    this.gun.update(dt, enemies)

    if (controls.fireMissile) this.fireMissile(enemies)
    this.missiles.update(dt, this.state, enemies)

    // Cycle missile
    if (controls.cycleMissile) this.cycleWeapon()

    // Countermeasures
    if (controls.dispenseFlare) this.cmds.dispenseFlare(this.state.positionNED)
    if (controls.dispenseChaff) this.cmds.dispenseChaff(this.state.positionNED)
    this.cmds.update(dt)

    // Avionics
    this.radar.update(dt, this.state, enemies, controls.radarModeNext)
    this.rwr.update(enemies, this.state)
    this.hms.update(this.state)
    this.gpws.update(this.state, dt, _event => {
      // GPWS audio events handled via AudioManager in FlightSession
      ;(window as any)['_fsimGPWSEvent'] = _event
    })
  }

  private fireMissile(enemies: Aircraft[]): void {
    const store = this.getSelectedMissileStore()
    if (!store || store.remainingRounds <= 0) return

    // Find locked target
    let targetId = this.radar.getSttTargetId() ?? this.hms.state.lockedEntityId
    if (!targetId && enemies.length > 0) {
      const nearest = enemies.reduce((a, b) => {
        const da = Math.hypot(...(a.state.positionNED.map((v,i) => v - this.state.positionNED[i]!) as [number,number,number]))
        const db = Math.hypot(...(b.state.positionNED.map((v,i) => v - this.state.positionNED[i]!) as [number,number,number]))
        return da < db ? a : b
      })
      targetId = nearest.entityId
    }
    if (!targetId) return

    this.missiles.launch(store.weaponId, this.state, targetId, 'player')
    store.remainingRounds = 0
  }

  private getSelectedMissileStore(): LoadedStore | null {
    const missileStores = this.state.loadedStores.filter(s =>
      (s.category === 'IR_MISSILE' || s.category === 'ARH_MISSILE') && s.remainingRounds > 0
    )
    return missileStores[this.selectedWeaponIndex % Math.max(1, missileStores.length)] ?? null
  }

  getSelectedWeaponName(): string {
    const store = this.getSelectedMissileStore()
    if (!store) return this.spec.gunSpec ? 'GUN' : 'NONE'
    return store.weaponId.toUpperCase()
  }

  private cycleWeapon(): void {
    const count = this.state.loadedStores.filter(s => s.remainingRounds > 0 && s.category !== 'FUEL_TANK').length
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
    this.mesh.visible = true
  }

  getRWRState(): RWRState { return this.rwr.state }
  getHMSState(): HMSState { return this.hms.state }
}
