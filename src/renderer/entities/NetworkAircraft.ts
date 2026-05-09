import * as THREE from 'three'
import type { AircraftSpec } from '../types/aircraft'
import type { NetPlayerState, NetRadarState, NetMissileState } from '../network/MultiplayerTypes'
import { Aircraft } from './Aircraft'
import { nedToThree } from '../utils/MathUtils'
import type { ChaffCloud } from '../avionics/CMDS'
import type { FlareContact } from '../types/ir'

// Reusable temporaries for mesh orientation — avoids per-frame Vector3 allocations
const _netMissileDir    = new THREE.Vector3()
const _netMissileLookAt = new THREE.Vector3()

// Shared missile geometry: cylinder with long axis along +Z so lookAt() aligns with velocity.
const REMOTE_MISSILE_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.07, 0.09, 1.8, 6)
  g.rotateX(Math.PI / 2)
  return g
})()
const REMOTE_MISSILE_MAT = new THREE.MeshPhongMaterial({ color: 0xdddddd, emissive: 0x333333, shininess: 40 })

export class NetworkAircraft extends Aircraft {
  private _netRadarState: NetRadarState | null = null
  private _netMissiles: NetMissileState[] = []
  private _netFlares: FlareContact[] = []
  private _netChaffClouds: ChaffCloud[] = []
  private _missileMeshes = new Map<string, THREE.Mesh>()
  readonly cmds = {
    getActiveFlares: (): ReadonlyArray<FlareContact> => this._netFlares,
    getActiveChaffClouds: (): ReadonlyArray<ChaffCloud> => this._netChaffClouds,
  }

  constructor(spec: AircraftSpec, scene: THREE.Scene, entityId: string) {
    super(spec, [], scene, entityId)
    this.state.invincible = true
  }

  applyNetworkState(net: NetPlayerState): void {
    this.state.positionNED = [...net.positionNED]
    this.state.velocityNED = [...net.velocityNED]
    this.state.attitudeQuat = [...net.attitudeQuat]
    this.state.throttle = net.throttle
    this.state.ejected = net.ejected
    this.damage.structuralFailure = net.structuralFailure
    this._netRadarState = net.radar ?? null
    this._netMissiles = net.missiles ?? []
    this._netFlares = (net.countermeasures?.flares ?? []).map(f => ({
      positionNED: [...f.positionNED] as [number, number, number],
      velocityNED: [0, 0, 0],
      heatSignatureKW: f.heatSignatureKW,
      ageSec: f.ageSec,
    }))
    this._netChaffClouds = (net.countermeasures?.chaffClouds ?? []).map(c => ({
      positionNED: [...c.positionNED] as [number, number, number],
      velocityNED: [...c.velocityNED] as [number, number, number],
      rcsM2: c.rcsM2,
      ageSec: c.ageSec,
    }))
  }

  override updateMesh(dt?: number): void {
    super.updateMesh(dt)
    this.syncMissileMeshes()
  }

  private syncMissileMeshes(): void {
    const seen = new Set<string>()
    for (const m of this._netMissiles) {
      seen.add(m.id)
      let mesh = this._missileMeshes.get(m.id)
      if (!mesh) {
        mesh = new THREE.Mesh(REMOTE_MISSILE_GEO, REMOTE_MISSILE_MAT)
        this.scene.add(mesh)
        this._missileMeshes.set(m.id, mesh)
      }
      const worldPos = nedToThree(m.positionNED)
      mesh.position.copy(worldPos)
      const speed = Math.sqrt(m.velocityNED[0] ** 2 + m.velocityNED[1] ** 2 + m.velocityNED[2] ** 2)
      if (speed > 1) {
        // Reuse module-level vectors — avoids two Vector3 allocations per active missile per frame
        _netMissileDir.set(m.velocityNED[1], -m.velocityNED[2], -m.velocityNED[0]).normalize()
        _netMissileLookAt.addVectors(mesh.position, _netMissileDir)
        mesh.lookAt(_netMissileLookAt)
      }
    }
    for (const [id, mesh] of this._missileMeshes) {
      if (!seen.has(id)) {
        this.scene.remove(mesh)
        this._missileMeshes.delete(id)
      }
    }
  }

  override getRadarInfo(): { mode: string; sttTargetId: string | null; tracksPlayer: (id: string) => boolean } | null {
    const s = this._netRadarState
    if (!s || s.mode === 'OFF') return null
    return {
      mode: s.mode,
      sttTargetId: s.sttTargetId,
      tracksPlayer: (id) => s.mode === 'STT' && s.sttTargetId === id,
    }
  }

  getNetMissiles(): NetMissileState[] {
    return this._netMissiles
  }

  override dispose(): void {
    for (const mesh of this._missileMeshes.values()) this.scene.remove(mesh)
    this._missileMeshes.clear()
    super.dispose()
  }
}
