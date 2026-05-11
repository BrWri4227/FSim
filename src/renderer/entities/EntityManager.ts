import * as THREE from 'three'
import type { AircraftSpec } from '../types/aircraft'
import type { LoadedStore } from '../types/weapons'
import type { Vec3 } from '../types/common'
import type { FlareContact } from '../types/ir'
import type { ChaffCloud } from '../avionics/CMDS'
import { AIAircraft, type AIBehavior } from '../ai/AIAircraft'
import { runAIBrain } from '../ai/AIBrain'
import { MissileSystem } from '../weapons/MissileSystem'
import type { Aircraft } from './Aircraft'
import type { PlayerAircraft } from './PlayerAircraft'
import { NetworkAircraft } from './NetworkAircraft'
import { GroundTarget } from './GroundTarget'
import type { GroundTargetSpec } from '../types/groundTarget'
import type { NetPlayerState } from '../network/MultiplayerTypes'

export class EntityManager {
  private enemies: AIAircraft[] = []
  private wingmen: AIAircraft[] = []
  private remotePlayers = new Map<string, NetworkAircraft>()
  private groundTargets: GroundTarget[] = []
  private scene: THREE.Scene
  private player: PlayerAircraft
  /** Separate missile system used exclusively for debug-spawned inbound missiles */
  private debugMissiles: MissileSystem
  /** Missile system used by SAM ground-launchers to engage the player. */
  private samMissiles: MissileSystem
  killCount = 0
  groundKillCount = 0
  lastWingmanCmd: 'ENGAGE' | 'COVER' | 'RTB' | 'REJOIN' | null = null

  /** Cached combined enemy list — rebuilt only when the entity set changes. */
  private _enemyCache: Aircraft[] | null = null

  constructor(scene: THREE.Scene, player: PlayerAircraft) {
    this.scene  = scene
    this.player = player
    this.debugMissiles = new MissileSystem(scene)
    this.samMissiles = new MissileSystem(scene)
  }

  spawnEnemy(spec: AircraftSpec, stores: LoadedStore[], behavior: AIBehavior, spawnPos: Vec3, spawnVel: Vec3): AIAircraft {
    const ai = new AIAircraft(spec, stores, this.scene, behavior, spawnPos, spawnVel)
    this.enemies.push(ai)
    this._enemyCache = null  // invalidate cache
    return ai
  }

  spawnWingman(spec: AircraftSpec, stores: LoadedStore[], spawnPos: Vec3, spawnVel: Vec3): AIAircraft {
    const wm = new AIAircraft(spec, stores, this.scene, 'FOLLOW_BEHIND', spawnPos, spawnVel)
    wm.side = 'WINGMAN'
    this.wingmen.push(wm)
    return wm
  }

  getWingmen(): AIAircraft[] {
    return this.wingmen
  }

  /**
   * Issue a radio-style command to all wingmen. Switches their primary behaviour;
   * the AI brain's defensive override still preempts when missiles are inbound.
   */
  commandWingmen(cmd: 'ENGAGE' | 'COVER' | 'RTB' | 'REJOIN'): void {
    this.lastWingmanCmd = cmd
    const next: AIBehavior = cmd === 'ENGAGE' ? 'BVR_ENGAGE'
      : cmd === 'COVER' ? 'FOLLOW_BEHIND'
      : cmd === 'RTB' ? 'FLY_STRAIGHT'
      : 'FOLLOW_BEHIND'
    for (const wm of this.wingmen) wm.behavior = next
  }

  getLastWingmanCommand(): 'ENGAGE' | 'COVER' | 'RTB' | 'REJOIN' | null {
    return this.lastWingmanCmd
  }

  spawnGroundTarget(spec: GroundTargetSpec, positionNED: Vec3, headingDeg = 0): GroundTarget {
    const gt = new GroundTarget(spec, this.scene, positionNED as [number, number, number], headingDeg)
    this.groundTargets.push(gt)
    return gt
  }

  getGroundTargets(): GroundTarget[] {
    return this.groundTargets
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

  private despawnGround(entityId: string): void {
    const idx = this.groundTargets.findIndex(g => g.entityId === entityId)
    if (idx < 0) return
    this.groundTargets[idx]!.dispose()
    this.groundTargets.splice(idx, 1)
    this.groundKillCount++
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
    this.debugMissiles.update(dt, player.state, this.getEnemies(), player as unknown as Aircraft, undefined, undefined, this.groundTargets)

    // Pre-compute the player's active missiles for AI threat detection.
    const playerMissiles = player.missiles.getMissiles()

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

      // Build inbound-missile threat list — every active missile targeting this AI.
      const threats = []
      for (const m of playerMissiles) {
        if (!m.active || m.targetEntityId !== ai.entityId) continue
        const guidance: 'IR' | 'RADAR' | 'UNKNOWN' =
          m.spec.category === 'IR_MISSILE' ? 'IR' :
          m.spec.category === 'ARH_MISSILE' ? 'RADAR' : 'UNKNOWN'
        threats.push({
          id: m.id,
          positionNED: [...m.positionNED] as [number, number, number],
          velocityNED: [...m.velocityNED] as [number, number, number],
          guidance,
        })
      }

      const controls = runAIBrain(ai, player as unknown as Aircraft, dt, threats)

      // Honour BVR fire request → launch an ARH missile through the AI's own MissileSystem.
      if (controls.fireMissile && ai.bvrFireCooldownSec <= 0) {
        if (ai.fireBVRMissile(player as unknown as Aircraft)) {
          ai.bvrFireCooldownSec = 5
        }
      }

      ai.update(controls, dt)
      ai.updateRadarVsBandit(dt, player as unknown as Aircraft)
      ai.updateMissiles(dt, player as unknown as Aircraft, this.groundTargets)
    }

    // Wingmen — same update path as enemies but they target the player's locked
    // bandit instead of the player. They're not in `getEnemies()` so the player's
    // own missiles can't track them.
    for (let i = this.wingmen.length - 1; i >= 0; i--) {
      const wm = this.wingmen[i]!
      if (wm.state.ejected || wm.damage.structuralFailure) {
        wm.dispose()
        this.wingmen.splice(i, 1)
        continue
      }
      // Wingman primary "target" is whatever the player has locked, else nearest enemy.
      const sttId = player.radar.getSttTargetId()
      const lockedEnemy = sttId ? this.enemies.find(e => e.entityId === sttId) : null
      const wmTarget = lockedEnemy ?? this.enemies[0] ?? (player as unknown as Aircraft)

      // Threats targeting the wingman come from any enemy AI that's launched at it.
      const wmThreats = []
      for (const enemy of this.enemies) {
        for (const m of enemy.missiles.getMissiles()) {
          if (!m.active || m.targetEntityId !== wm.entityId) continue
          const guidance: 'IR' | 'RADAR' | 'UNKNOWN' =
            m.spec.category === 'IR_MISSILE' ? 'IR' :
            m.spec.category === 'ARH_MISSILE' ? 'RADAR' : 'UNKNOWN'
          wmThreats.push({
            id: m.id,
            positionNED: [...m.positionNED] as [number, number, number],
            velocityNED: [...m.velocityNED] as [number, number, number],
            guidance,
          })
        }
      }

      const controls = runAIBrain(wm, wmTarget, dt, wmThreats)
      if (controls.fireMissile && wm.bvrFireCooldownSec <= 0 && wmTarget !== (player as unknown as Aircraft)) {
        if (wm.fireBVRMissile(wmTarget)) wm.bvrFireCooldownSec = 5
      }
      wm.update(controls, dt)
      wm.updateMissiles(dt, player as unknown as Aircraft, this.groundTargets)
    }

    // Ground targets — update + SAM engagement
    const samEmitters: Array<{ entityId: string; positionNED: [number, number, number]; engaging: boolean }> = []
    for (let i = this.groundTargets.length - 1; i >= 0; i--) {
      const gt = this.groundTargets[i]!
      if (gt.state.destroyed) {
        this.despawnGround(gt.entityId)
        continue
      }
      gt.update(dt)

      if (gt.spec.category === 'SAM_SITE') {
        const dx = player.state.positionNED[0] - gt.state.positionNED[0]
        const dy = player.state.positionNED[1] - gt.state.positionNED[1]
        const dz = player.state.positionNED[2] - gt.state.positionNED[2]
        const dist = Math.hypot(dx, dy, dz)
        const detectR = gt.spec.samDetectionRangeM ?? 50000
        const engageR = gt.spec.samEngagementRangeM ?? 40000
        if (dist <= detectR) {
          const engaging = dist <= engageR && gt.samReadyToFire()
          samEmitters.push({
            entityId: gt.entityId,
            positionNED: [...gt.state.positionNED] as [number, number, number],
            engaging,
          })
          if (engaging) {
            // Build a synthetic shooter state — body +x rotated to world -z (straight up)
            // so the launch impulse and the missile mesh both align with the climb-out.
            // Quaternion: rotate +π/2 about +Y → (cos(π/4), 0, sin(π/4), 0).
            const samMissileId = gt.spec.samMissileId ?? 'r77'
            const halfAng = Math.PI / 4
            const upQuat: [number, number, number, number] = [Math.cos(halfAng), 0, Math.sin(halfAng), 0]
            const synthState = {
              positionNED: [gt.state.positionNED[0], gt.state.positionNED[1], gt.state.positionNED[2] - 6] as [number, number, number],
              velocityNED: [0, 0, 0] as [number, number, number],   // launch impulse adds 120 m/s along +x_body = up
              attitudeQuat: upQuat,
            } as unknown as import('../types/aircraft').AircraftState
            this.samMissiles.launch(
              samMissileId, synthState, 'player', gt.entityId,
              [...player.state.positionNED] as [number, number, number],
              [...player.state.velocityNED] as [number, number, number],
            )
            gt.triggerSamCooldown()
          }
        }
      }
    }

    // Step SAM missiles forward against the player.
    this.samMissiles.update(dt, player.state, [], player as unknown as Aircraft, undefined, undefined, this.groundTargets)

    // Push SAM emitters onto player RWR
    if (samEmitters.length > 0) player.rwr.addSAMEmitterThreats(samEmitters, player.state)
  }

  updateMeshes(): void {
    for (const ai of this.enemies) ai.updateMesh()
    for (const wm of this.wingmen) wm.updateMesh()
    for (const rp of this.remotePlayers.values()) rp.updateMesh()
    for (const gt of this.groundTargets) gt.updateMesh()
  }

  getEnemies(): Aircraft[] {
    if (this._enemyCache === null) {
      this._enemyCache = [...this.enemies, ...this.remotePlayers.values()]
    }
    return this._enemyCache
  }

  getAllAIFlares(): FlareContact[] {
    const out: FlareContact[] = []
    for (const e of this.enemies)  out.push(...e.cmds.getActiveFlares())
    for (const w of this.wingmen)  out.push(...w.cmds.getActiveFlares())
    return out
  }

  getAllAIChaff(): ChaffCloud[] {
    const out: ChaffCloud[] = []
    for (const e of this.enemies)  out.push(...e.cmds.getActiveChaffClouds())
    for (const w of this.wingmen)  out.push(...w.cmds.getActiveChaffClouds())
    return out
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

    for (const m of this.samMissiles.getMissiles()) {
      if (m.active && idSet.has(m.targetEntityId) && this.isInboundToPlayer(m.positionNED, m.velocityNED)) out.push(m)
    }

    for (const ai of this.enemies) {
      for (const m of ai.missiles.getMissiles()) {
        if (m.active && idSet.has(m.targetEntityId) && this.isInboundToPlayer(m.positionNED, m.velocityNED)) out.push(m)
      }
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
    for (const wm of this.wingmen) wm.dispose()
    for (const rp of this.remotePlayers.values()) rp.dispose()
    for (const gt of this.groundTargets) gt.dispose()
    this.enemies.length = 0
    this.wingmen.length = 0
    this.remotePlayers.clear()
    this.groundTargets.length = 0
    this.debugMissiles.dispose()
    this.samMissiles.dispose()
  }
}
