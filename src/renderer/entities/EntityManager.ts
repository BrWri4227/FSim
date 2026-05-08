import * as THREE from 'three'
import type { AircraftSpec } from '../types/aircraft'
import type { LoadedStore } from '../types/weapons'
import type { Vec3 } from '../types/common'
import { AIAircraft, type AIBehavior } from '../ai/AIAircraft'
import { runAIBrain } from '../ai/AIBrain'
import { MissileSystem } from '../weapons/MissileSystem'
import type { Aircraft } from './Aircraft'
import type { PlayerAircraft } from './PlayerAircraft'
import { NetworkAircraft } from './NetworkAircraft'
import type { NetPlayerState } from '../network/MultiplayerTypes'

export class EntityManager {
  private enemies: AIAircraft[] = []
  private remotePlayers = new Map<string, NetworkAircraft>()
  private scene: THREE.Scene
  private player: PlayerAircraft
  /** Separate missile system used exclusively for debug-spawned inbound missiles */
  private debugMissiles: MissileSystem
  killCount = 0

  /** Cached combined enemy list — rebuilt only when the entity set changes. */
  private _enemyCache: Aircraft[] | null = null

  constructor(scene: THREE.Scene, player: PlayerAircraft) {
    this.scene  = scene
    this.player = player
    this.debugMissiles = new MissileSystem(scene)
  }

  spawnEnemy(spec: AircraftSpec, stores: LoadedStore[], behavior: AIBehavior, spawnPos: Vec3, spawnVel: Vec3): AIAircraft {
    const ai = new AIAircraft(spec, stores, this.scene, behavior, spawnPos, spawnVel)
    this.enemies.push(ai)
    this._enemyCache = null  // invalidate cache
    return ai
  }

  private despawn(entityId: string): void {
    const idx = this.enemies.findIndex(e => e.entityId === entityId)
    if (idx < 0) return
    const ai = this.enemies[idx]!
    this.scene.remove(ai.mesh)
    this.enemies.splice(idx, 1)
    this._enemyCache = null  // invalidate cache
    this.killCount++
  }

  /** Launch an inbound R-73 at the player from the nearest spawned enemy (or 2 km behind). */
  launchMissileAtPlayer(): void {
    const ps = this.player.state.positionNED
    // Shooter position: nearest enemy, or 2 km directly behind player if none
    const shooterState = this.enemies.length > 0
      ? this.enemies[0]!.state
      : {
          ...this.player.state,
          positionNED: [ps[0] - 2000, ps[1], ps[2]] as [number,number,number],
          velocityNED: [200, 0, 0] as [number,number,number],
        }
    this.debugMissiles.launch(
      'r73', shooterState, 'player', 'debug',
      this.player.state.positionNED as [number,number,number],
      this.player.state.velocityNED as [number,number,number]
    )
  }

  update(dt: number, player: PlayerAircraft): void {
    // Update debug missiles — pass player aircraft so 'player' target resolves correctly
    this.debugMissiles.update(dt, player.state, this.getEnemies(), player as unknown as Aircraft)

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const ai = this.enemies[i]!
      if (
        ai.state.ejected ||
        ai.damage.structuralFailure ||
        ai.damage.zones['ENGINE']   >= 1.0 ||
        ai.damage.zones['FUSELAGE'] >= 1.0 ||
        ai.damage.zones['COCKPIT']  >= 1.0
      ) {
        this.despawn(ai.entityId)
        continue
      }
      const controls = runAIBrain(ai, player as unknown as Aircraft, dt)
      ai.update(controls, dt)
    }

  }

  updateMeshes(): void {
    for (const ai of this.enemies) ai.updateMesh()
    for (const rp of this.remotePlayers.values()) rp.updateMesh()
  }

  getEnemies(): Aircraft[] {
    if (this._enemyCache === null) {
      this._enemyCache = [...this.enemies, ...this.remotePlayers.values()]
    }
    return this._enemyCache
  }

  private isInboundToPlayer(
    missilePos: readonly [number, number, number],
    missileVel: readonly [number, number, number]
  ): boolean {
    const targetPos = this.player.state.positionNED
    const targetVel = this.player.state.velocityNED
    const relPos: [number, number, number] = [
      targetPos[0] - missilePos[0],
      targetPos[1] - missilePos[1],
      targetPos[2] - missilePos[2],
    ]
    const relVel: [number, number, number] = [
      targetVel[0] - missileVel[0],
      targetVel[1] - missileVel[1],
      targetVel[2] - missileVel[2],
    ]

    const rangeM = Math.hypot(relPos[0], relPos[1], relPos[2])
    if (rangeM < 200) return true

    // Positive means closing, negative means opening.
    const closingMS = -(
      relPos[0] * relVel[0] +
      relPos[1] * relVel[1] +
      relPos[2] * relVel[2]
    ) / Math.max(1, rangeM)

    // Keep near threats with slight closure; otherwise require clear closure.
    if (rangeM < 1500) return closingMS > 5
    return closingMS > 25
  }

  /** Returns all active missiles targeting any of the given IDs. */
  getInboundMissiles(targetIds: string[]): Array<{ id: string; positionNED: [number, number, number]; velocityNED: [number, number, number] }> {
    const idSet = new Set(targetIds)
    const out: Array<{ id: string; positionNED: [number, number, number]; velocityNED: [number, number, number] }> = []

    for (const m of this.debugMissiles.getMissiles()) {
      if (m.active && idSet.has(m.targetEntityId) && this.isInboundToPlayer(m.positionNED, m.velocityNED)) out.push(m)
    }

    for (const remote of this.remotePlayers.values()) {
      for (const m of remote.getNetMissiles()) {
        if (m.active && idSet.has(m.targetEntityId) && this.isInboundToPlayer(m.positionNED, m.velocityNED)) out.push(m)
      }
    }

    return out
  }

  upsertRemotePlayer(
    playerId: string,
    aircraftSpec: AircraftSpec,
    state: NetPlayerState
  ): void {
    let remote = this.remotePlayers.get(playerId)
    if (!remote) {
      remote = new NetworkAircraft(aircraftSpec, this.scene, playerId)
      this.remotePlayers.set(playerId, remote)
      this._enemyCache = null  // new remote player — invalidate cache
    }
    remote.applyNetworkState(state)
  }

  removeRemotePlayer(playerId: string): void {
    const remote = this.remotePlayers.get(playerId)
    if (!remote) return
    remote.dispose()
    this.remotePlayers.delete(playerId)
    this._enemyCache = null  // invalidate cache
  }

  dispose(): void {
    for (const ai of this.enemies) ai.dispose()
    for (const rp of this.remotePlayers.values()) rp.dispose()
    this.enemies.length = 0
    this.remotePlayers.clear()
    this.debugMissiles.dispose()
  }
}
