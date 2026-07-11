import * as THREE from 'three'
import type { AircraftSpec } from '../types/aircraft'
import type { NetPlayerState, NetRadarState, NetMissileState } from '../network/MultiplayerTypes'
import { cloneNetPlayerState } from '../../shared/network/MultiplayerTypes'
import { Aircraft } from './Aircraft'
import { nedToThree } from '../utils/MathUtils'
import type { ChaffCloud } from '../avionics/CMDS'
import type { FlareContact } from '../types/ir'
import { buildMissileMesh } from '../weapons/MissileSystem'

// Reusable temporaries for mesh orientation — avoids per-frame Vector3 allocations
const _netMissileDir    = new THREE.Vector3()
const _netMissileLookAt = new THREE.Vector3()
const _interpQuatA      = new THREE.Quaternion()
const _interpQuatB      = new THREE.Quaternion()
const _interpQuatOut    = new THREE.Quaternion()

const REMOTE_MISSILE_BODY_MAT = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.5, roughness: 0.5 })
const REMOTE_MISSILE_FIN_MAT  = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.4, roughness: 0.6 })

interface TimedSnapshot {
  receivedAtMs: number
  state: NetPlayerState
}

export class NetworkAircraft extends Aircraft {
  private _netRadarState: NetRadarState | null = null
  private _netMissiles: NetMissileState[] = []
  private _netFlares: FlareContact[] = []
  private _netChaffClouds: ChaffCloud[] = []
  private _missileMeshes = new Map<string, THREE.Group>()
  private _snapshotBuffer: TimedSnapshot[] = []
  private static readonly INTERP_DELAY_MS = 100
  private static readonly MAX_SNAPSHOTS = 4
  private static readonly MAX_EXTRAP_MS = 200

  readonly cmds = {
    getActiveFlares: (): ReadonlyArray<FlareContact> => this._netFlares,
    getActiveChaffClouds: (): ReadonlyArray<ChaffCloud> => this._netChaffClouds,
  }

  constructor(spec: AircraftSpec, scene: THREE.Scene, entityId: string) {
    super(spec, [], scene, entityId)
    this.state.invincible = true
  }

  applyNetworkState(net: NetPlayerState): void {
    const receivedAtMs = performance.now()
    this._snapshotBuffer.push({ receivedAtMs, state: cloneNetPlayerState(net) })
    while (this._snapshotBuffer.length > NetworkAircraft.MAX_SNAPSHOTS) {
      this._snapshotBuffer.shift()
    }

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
    this.applySnapshotInterpolation()
    super.updateMesh(dt)
    this.syncMissileMeshes()
  }

  private applySnapshotInterpolation(): void {
    const buf = this._snapshotBuffer
    if (buf.length === 0) return

    const targetMs = performance.now() - NetworkAircraft.INTERP_DELAY_MS
    const first = buf[0]!
    const last = buf[buf.length - 1]!

    if (buf.length === 1 || targetMs <= first.receivedAtMs) {
      this.copyPoseFromSnapshot(first.state, targetMs, first.receivedAtMs, first.state.velocityNED)
      return
    }

    if (targetMs >= last.receivedAtMs) {
      this.copyPoseFromSnapshot(last.state, targetMs, last.receivedAtMs, last.state.velocityNED)
      return
    }

    for (let i = 1; i < buf.length; i++) {
      const older = buf[i - 1]!
      const newer = buf[i]!
      if (targetMs > newer.receivedAtMs) continue

      const spanMs = newer.receivedAtMs - older.receivedAtMs
      const t = spanMs > 0 ? (targetMs - older.receivedAtMs) / spanMs : 0
      this.lerpPose(older.state, newer.state, t)
      return
    }

    this.copyPoseFromSnapshot(last.state, targetMs, last.receivedAtMs, last.state.velocityNED)
  }

  private copyPoseFromSnapshot(
    snap: NetPlayerState,
    targetMs: number,
    snapshotMs: number,
    velocityNED: [number, number, number],
  ): void {
    const extrapSec = Math.min(
      Math.max(0, (targetMs - snapshotMs) / 1000),
      NetworkAircraft.MAX_EXTRAP_MS / 1000,
    )
    this.state.positionNED = extrapSec > 0
      ? this.extrapolatePosition(snap.positionNED, velocityNED, extrapSec)
      : [...snap.positionNED]
    this.state.velocityNED = [...snap.velocityNED]
    this.state.attitudeQuat = [...snap.attitudeQuat]
  }

  private lerpPose(from: NetPlayerState, to: NetPlayerState, t: number): void {
    const u = Math.max(0, Math.min(1, t))
    this.state.positionNED = [
      from.positionNED[0] + (to.positionNED[0] - from.positionNED[0]) * u,
      from.positionNED[1] + (to.positionNED[1] - from.positionNED[1]) * u,
      from.positionNED[2] + (to.positionNED[2] - from.positionNED[2]) * u,
    ]
    this.state.velocityNED = [
      from.velocityNED[0] + (to.velocityNED[0] - from.velocityNED[0]) * u,
      from.velocityNED[1] + (to.velocityNED[1] - from.velocityNED[1]) * u,
      from.velocityNED[2] + (to.velocityNED[2] - from.velocityNED[2]) * u,
    ]
    this.state.attitudeQuat = this.slerpQuat(from.attitudeQuat, to.attitudeQuat, u)
  }

  private extrapolatePosition(
    pos: [number, number, number],
    vel: [number, number, number],
    dtSec: number,
  ): [number, number, number] {
    return [
      pos[0] + vel[0] * dtSec,
      pos[1] + vel[1] * dtSec,
      pos[2] + vel[2] * dtSec,
    ]
  }

  private slerpQuat(
    a: [number, number, number, number],
    b: [number, number, number, number],
    t: number,
  ): [number, number, number, number] {
    _interpQuatA.set(a[1], a[2], a[3], a[0])
    _interpQuatB.set(b[1], b[2], b[3], b[0])
    _interpQuatOut.copy(_interpQuatA).slerp(_interpQuatB, t)
    return [_interpQuatOut.w, _interpQuatOut.x, _interpQuatOut.y, _interpQuatOut.z]
  }

  private syncMissileMeshes(): void {
    const seen = new Set<string>()
    for (const m of this._netMissiles) {
      seen.add(m.id)
      let mesh = this._missileMeshes.get(m.id)
      if (!mesh) {
        mesh = buildMissileMesh(REMOTE_MISSILE_BODY_MAT, REMOTE_MISSILE_FIN_MAT)
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
    this._snapshotBuffer.length = 0
    super.dispose()
  }
}
