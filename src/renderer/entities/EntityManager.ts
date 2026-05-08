import * as THREE from 'three'
import type { AircraftSpec } from '../types/aircraft'
import type { LoadedStore } from '../types/weapons'
import type { Vec3 } from '../types/common'
import { AIAircraft, type AIBehavior } from '../ai/AIAircraft'
import { runAIBrain } from '../ai/AIBrain'
import type { Aircraft } from './Aircraft'
import type { PlayerAircraft } from './PlayerAircraft'

export class EntityManager {
  private enemies: AIAircraft[] = []
  private scene: THREE.Scene
  private player: PlayerAircraft
  killCount = 0

  constructor(scene: THREE.Scene, player: PlayerAircraft) {
    this.scene  = scene
    this.player = player
    // Expose for PlayerAircraft target lookup
    ;(window as unknown as Record<string, unknown>)['_fsimEnemies'] = this.enemies
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

  update(dt: number, player: PlayerAircraft): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const ai = this.enemies[i]!
      if (ai.state.ejected || ai.damage.zones['ENGINE'] > 0.95) {
        this.despawn(ai.entityId)
        continue
      }
      const controls = runAIBrain(ai, player as unknown as Aircraft, dt)
      ai.update(controls, dt)
    }
  }

  updateMeshes(): void {
    for (const ai of this.enemies) ai.updateMesh()
  }

  getEnemies(): AIAircraft[] { return this.enemies }

  dispose(): void {
    for (const ai of this.enemies) this.scene.remove(ai.mesh)
    this.enemies.length = 0
  }
}
