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

  constructor(scene: THREE.Scene, player: PlayerAircraft) {
    this.scene  = scene
    this.player = player
    this.debugMissiles = new MissileSystem(scene)
  }

  spawnEnemy(spec: AircraftSpec, stores: LoadedStore[], behavior: AIBehavior, spawnPos: Vec3, spawnVel: Vec3): AIAircraft {
    const ai = new AIAircraft(spec, stores, this.scene, behavior, spawnPos, spawnVel)
    this.enemies.push(ai)
    return ai
  }

  private despawn(entityId: string): void {
    const idx = this.enemies.findIndex(e => e.entityId === entityId)
    if (idx < 0) return
    const ai = this.enemies[idx]!
    this.scene.remove(ai.mesh)
    this.enemies.splice(idx, 1)
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

    // Legacy global for systems that still query enemies directly (e.g. audio cues).
    ;(window as unknown as Record<string, unknown>)['_fsimEnemies'] = this.getEnemies()
  }

  updateMeshes(): void {
    for (const ai of this.enemies) ai.updateMesh()
    for (const rp of this.remotePlayers.values()) rp.updateMesh()
  }

  getEnemies(): Aircraft[] {
    return [...this.enemies, ...this.remotePlayers.values()]
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
    }
    remote.applyNetworkState(state)
  }

  removeRemotePlayer(playerId: string): void {
    const remote = this.remotePlayers.get(playerId)
    if (!remote) return
    remote.dispose()
    this.remotePlayers.delete(playerId)
  }

  dispose(): void {
    for (const ai of this.enemies) this.scene.remove(ai.mesh)
    for (const rp of this.remotePlayers.values()) rp.dispose()
    this.enemies.length = 0
    this.remotePlayers.clear()
    this.debugMissiles.dispose()
  }
}
