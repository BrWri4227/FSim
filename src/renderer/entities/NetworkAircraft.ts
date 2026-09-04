import * as THREE from 'three'
import type { AircraftSpec } from '../types/aircraft'
import type { NetPlayerState, NetRadarState, NetMissileState } from '../network/MultiplayerTypes'
import { cloneNetPlayerState } from '../../shared/network/MultiplayerTypes'
import { Aircraft } from './Aircraft'
import type { ChaffCloud } from '../avionics/CMDS'
import type { FlareContact } from '../types/ir'
import { RemoteMissileVisual } from '../weapons/RemoteMissileVisual'
import { ExplosionManager } from '../scene/ExplosionEffect'

// Reusable temporaries — avoids per-frame Quaternion allocations
const _interpQuatA   = new THREE.Quaternion()
const _interpQuatB   = new THREE.Quaternion()
const _interpQuatOut = new THREE.Quaternion()

interface TimedSnapshot {
  receivedAtMs: number
  state: NetPlayerState
}

export class NetworkAircraft extends Aircraft {
  private _netRadarState: NetRadarState | null = null
  private _netMissiles: NetMissileState[] = []
  private _netFlares: FlareContact[] = []
  private _netChaffClouds: ChaffCloud[] = []
  private _missileVisuals = new Map<string, RemoteMissileVisual>()
  private _explosions: ExplosionManager
  private _snapshotBuffer: TimedSnapshot[] = []
  /** Last position pushed to the buffer — dedupes the 60 Hz re-delivery of a 20 Hz stream. */
  private _lastBufferedPos: [number, number, number] | null = null

  // Interpolation is tuned for internet latency/jitter, not just LAN: a deeper
  // buffer and a slightly longer delay ride out reordered / dropped packets.
  private static readonly INTERP_DELAY_MS = 120
  private static readonly MAX_SNAPSHOTS = 12
  private static readonly MAX_EXTRAP_MS = 250

  readonly cmds = {
    getActiveFlares: (): ReadonlyArray<FlareContact> => this._netFlares,
    getActiveChaffClouds: (): ReadonlyArray<ChaffCloud> => this._netChaffClouds,
  }

  /** Sanitized display name from the peer's profile; null falls back to the id. */
  callsign: string | null = null

  /** What to label this contact with on the HUD and in the kill feed. */
  get displayName(): string {
    return this.callsign ?? this.entityId
  }

  constructor(spec: AircraftSpec, scene: THREE.Scene, entityId: string) {
    super(spec, [], scene, entityId)
    this.state.invincible = true
    // Spawn-only handle onto the scene-wide explosion pool. The pool is a scene
    // singleton that the missile systems already step every frame, so this
    // instance never calls update()/dispose() — it would double-advance shared
    // particles or clear detonations it doesn't own.
    this._explosions = new ExplosionManager(scene)
  }

  applyNetworkState(net: NetPlayerState): void {
    // The session loop hands us the latest known snapshot every sim tick (~60 Hz)
    // even though new ones only arrive at the send rate (~20 Hz). Ingesting the
    // duplicates would pack the interpolation buffer with identical frames and
    // collapse the interpolation window. Position equality is a reliable "same
    // snapshot" test — two distinct updates from a moving jet never round-trip
    // to the exact same quantised position.
    const p = net.positionNED
    const isDuplicate =
      this._lastBufferedPos !== null &&
      this._lastBufferedPos[0] === p[0] &&
      this._lastBufferedPos[1] === p[1] &&
      this._lastBufferedPos[2] === p[2]
    if (isDuplicate) return

    this._lastBufferedPos = [p[0], p[1], p[2]]
    this._snapshotBuffer.push({ receivedAtMs: performance.now(), state: cloneNetPlayerState(net) })
    while (this._snapshotBuffer.length > NetworkAircraft.MAX_SNAPSHOTS) {
      this._snapshotBuffer.shift()
    }

    this.state.throttle = net.throttle
    this.state.ejected = net.ejected
    this.damage.structuralFailure = net.structuralFailure
    this._netRadarState = net.radar ?? null
    this._netMissiles = net.missiles ?? []

    for (const m of this._netMissiles) {
      const existing = this._missileVisuals.get(m.id)
      if (existing) {
        existing.onNetUpdate(m.positionNED, m.velocityNED)
      } else {
        this._missileVisuals.set(m.id, new RemoteMissileVisual(this.scene, m.positionNED, m.velocityNED))
      }
    }
    const live = new Set(this._netMissiles.map(m => m.id))
    for (const [id, visual] of this._missileVisuals) {
      if (!live.has(id)) {
        visual.explode(this._explosions)
        visual.dispose()
        this._missileVisuals.delete(id)
      }
    }

    // `countermeasures: null` means "unchanged" — keep aging the clouds we have.
    if (net.countermeasures) {
      this._netFlares = net.countermeasures.flares.map(f => ({
        positionNED: [...f.positionNED] as [number, number, number],
        velocityNED: [...f.velocityNED] as [number, number, number],
        heatSignatureKW: f.heatSignatureKW,
        ageSec: f.ageSec,
      }))
      this._netChaffClouds = net.countermeasures.chaffClouds.map(c => ({
        positionNED: [...c.positionNED] as [number, number, number],
        velocityNED: [...c.velocityNED] as [number, number, number],
        rcsM2: c.rcsM2,
        ageSec: c.ageSec,
      }))
    }
  }

  override updateMesh(dt?: number): void {
    const step = dt ?? 1 / 60
    this.applySnapshotInterpolation()
    super.updateMesh(dt)
    this.ageCountermeasures(step)
    for (const visual of this._missileVisuals.values()) visual.update(step)
  }

  /**
   * Local decay of remote flares / chaff between the (now infrequent) full
   * countermeasure snapshots — mirrors CMDS.update so IR/chaff seduction logic
   * against this aircraft stays smooth instead of stepping at the re-sync rate.
   */
  private ageCountermeasures(dt: number): void {
    for (let i = this._netFlares.length - 1; i >= 0; i--) {
      const f = this._netFlares[i]!
      f.ageSec += dt
      const drag = Math.max(0, 1 - dt * 1.8)
      f.velocityNED = [
        f.velocityNED[0] * drag,
        f.velocityNED[1] * drag,
        f.velocityNED[2] + dt * 3.5,
      ]
      f.positionNED = [
        f.positionNED[0] + f.velocityNED[0] * dt,
        f.positionNED[1] + f.velocityNED[1] * dt,
        f.positionNED[2] + f.velocityNED[2] * dt,
      ]
      f.heatSignatureKW = Math.max(0, 60 * (1 - f.ageSec / 4.0))
      if (f.ageSec > 4.0) this._netFlares.splice(i, 1)
    }
    for (let i = this._netChaffClouds.length - 1; i >= 0; i--) {
      const c = this._netChaffClouds[i]!
      c.ageSec += dt
      c.velocityNED = [
        c.velocityNED[0] * (1 - dt * 0.9),
        c.velocityNED[1] * (1 - dt * 0.9),
        c.velocityNED[2] + dt * 2.0,
      ]
      c.positionNED = [
        c.positionNED[0] + c.velocityNED[0] * dt,
        c.positionNED[1] + c.velocityNED[1] * dt,
        c.positionNED[2] + c.velocityNED[2] * dt,
      ]
      c.rcsM2 = Math.max(0.5, 25 * (1 - c.ageSec / 6.0))
      if (c.ageSec > 6.0) this._netChaffClouds.splice(i, 1)
    }
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
    for (const visual of this._missileVisuals.values()) visual.dispose()
    this._missileVisuals.clear()
    this._snapshotBuffer.length = 0
    super.dispose()
  }
}
