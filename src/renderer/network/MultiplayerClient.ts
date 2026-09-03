import type { MultiplayerConfig, NetPlayerProfile, NetPlayerState, ServerMessage, ClientMessage, HitEvent } from './MultiplayerTypes'
import { quantizePlayerState, missileSetKey } from '../../shared/network/serialization'

const CONNECT_TIMEOUT_MS = 8000
const MAX_INBOUND_HITS = 256
/** Outbound state snapshots — 20 Hz instead of sim rate (60 Hz). */
const STATE_SEND_INTERVAL_SEC = 1 / 20
/** Full countermeasure re-sync cadence while flares/chaff are active (they age locally between). */
const CM_RESYNC_INTERVAL_SEC = 0.5

/** Build the WebSocket URL. Accepts a bare host, `host:port`, or a full `ws(s)://` URL. */
export function resolveSessionUrl(host: string, port: number): string {
  const trimmed = host.trim().replace(/\/+$/, '')
  if (/^wss?:\/\//i.test(trimmed)) return trimmed
  if (/:\d+$/.test(trimmed)) return `ws://${trimmed}`
  return `ws://${trimmed}:${port}`
}

interface RemoteSnapshot {
  playerId: string
  profile: NetPlayerProfile
  state: NetPlayerState | null
}

export class MultiplayerClient {
  private ws: WebSocket | null = null
  private remotePlayers = new Map<string, RemoteSnapshot>()
  private inboundHits: HitEvent[] = []
  private connected = false
  private localPlayerId: string | null = null
  private profile: NetPlayerProfile
  private rosterListeners: Array<() => void> = []
  private stateSendAccumSec = 0
  private cmSendAccumSec = 0
  private pendingState: NetPlayerState | null = null
  private lastSentRadarMode: string | null = null
  private lastSentMissileKey = ''
  private lastCmSignature = '0:0'

  constructor(profile: NetPlayerProfile) {
    this.profile = profile
  }

  async connect(config: MultiplayerConfig): Promise<void> {
    if (config.mode === 'single') return
    const url = resolveSessionUrl(config.host, config.port)
    const ws = new WebSocket(url)
    this.ws = ws

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        ws.removeEventListener('open',  onOpen)
        ws.removeEventListener('error', onError)
        fn()
      }

      const timer = setTimeout(() => {
        settle(() => {
          ws.close()
          reject(new Error(`Connection to ${url} timed out after ${CONNECT_TIMEOUT_MS} ms`))
        })
      }, CONNECT_TIMEOUT_MS)

      const onOpen = (): void => {
        settle(() => {
          this.connected = true
          this.send({ type: 'join', profile: this.profile })
          resolve()
        })
      }
      const onError = (): void => {
        settle(() => reject(new Error(`Failed to connect to LAN session at ${url}`)))
      }
      ws.addEventListener('open',  onOpen)
      ws.addEventListener('error', onError)
    })

    this.ws.addEventListener('message', event => {
      let msg: ServerMessage | null = null
      try {
        msg = JSON.parse(String(event.data)) as ServerMessage
      } catch {
        return
      }
      if (!msg) return

      if (msg.type === 'welcome') {
        this.localPlayerId = msg.playerId
        this.remotePlayers.clear()
        for (const peer of msg.peers) {
          this.remotePlayers.set(peer.playerId, {
            playerId: peer.playerId,
            profile: peer.profile,
            state: peer.state ?? null,
          })
        }
        this.notifyRosterChanged()
        return
      }

      if (msg.type === 'peer-join') {
        this.remotePlayers.set(msg.playerId, {
          playerId: msg.playerId,
          profile: msg.profile,
          state: null,
        })
        this.notifyRosterChanged()
        return
      }

      if (msg.type === 'peer-leave') {
        this.remotePlayers.delete(msg.playerId)
        this.notifyRosterChanged()
        return
      }

      if (msg.type === 'state') {
        const prev = this.remotePlayers.get(msg.playerId)
        const wasInLobby = !prev?.state
        const nowInLobby = !msg.state
        this.remotePlayers.set(msg.playerId, {
          playerId: msg.playerId,
          profile: msg.profile,
          state: msg.state,
        })
        // Notify on lobby ↔ flight transitions; in-flight updates are polled each frame.
        if (wasInLobby !== nowInLobby) this.notifyRosterChanged()
        return
      }

      if (msg.type === 'peer-profile-update') {
        const peer = this.remotePlayers.get(msg.playerId)
        if (peer) {
          peer.profile = msg.profile
          this.notifyRosterChanged()
        }
        return
      }

      if (msg.type === 'hit') {
        if (this.inboundHits.length < MAX_INBOUND_HITS) {
          this.inboundHits.push(msg.hit)
        }
      }
    })

    this.ws.addEventListener('close', () => {
      this.connected = false
      this.remotePlayers.clear()
      this.localPlayerId = null
      this.notifyRosterChanged()
    })
  }

  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  getLocalPlayerId(): string | null {
    return this.localPlayerId
  }

  getRemoteSnapshots(): RemoteSnapshot[] {
    return [...this.remotePlayers.values()]
  }

  onRosterChanged(cb: () => void): () => void {
    this.rosterListeners.push(cb)
    return () => {
      this.rosterListeners = this.rosterListeners.filter(listener => listener !== cb)
    }
  }

  /**
   * Merge a partial profile update. Callers only ever know about the one field
   * they changed — picking an aircraft used to replace the whole profile and
   * silently drop the callsign with it.
   */
  updateProfile(patch: Partial<NetPlayerProfile>): void {
    this.profile = { ...this.profile, ...patch }
    this.send({ type: 'profile-update', profile: this.profile })
  }

  getProfile(): NetPlayerProfile {
    return this.profile
  }

  /** Queue state for throttled send — call flushStateSend each sim tick. */
  queueState(state: NetPlayerState): void {
    this.pendingState = state
  }

  flushStateSend(dtSec: number): void {
    if (!this.isConnected() || !this.pendingState) return

    const state = this.pendingState
    const critical = state.ejected || state.structuralFailure
    const radarChanged = state.radar.mode !== this.lastSentRadarMode
    const missileKey = missileSetKey(state.missiles)
    const missilesChanged = missileKey !== this.lastSentMissileKey

    this.stateSendAccumSec += dtSec
    this.cmSendAccumSec += dtSec
    const due = this.stateSendAccumSec >= STATE_SEND_INTERVAL_SEC
    if (!critical && !radarChanged && !missilesChanged && !due) return

    // Attach the countermeasure payload only when the flare/chaff set changed
    // (dispense or expiry) or on a periodic re-sync — the receiver ages its
    // existing clouds locally, so 20 Hz retransmission is pure waste.
    const cm = state.countermeasures
    const cmSig = cm ? `${cm.flares.length}:${cm.chaffClouds.length}` : '0:0'
    const cmChanged = cmSig !== this.lastCmSignature
    const cmActive = !!cm && (cm.flares.length > 0 || cm.chaffClouds.length > 0)
    const includeCm = critical || cmChanged || (cmActive && this.cmSendAccumSec >= CM_RESYNC_INTERVAL_SEC)

    const outbound: NetPlayerState = includeCm ? state : { ...state, countermeasures: null }

    this.stateSendAccumSec = 0
    this.lastSentRadarMode = state.radar.mode
    this.lastSentMissileKey = missileKey
    if (includeCm) {
      this.cmSendAccumSec = 0
      this.lastCmSignature = cmSig
    }
    this.send({ type: 'state', state: quantizePlayerState(outbound) })
  }

  /** Tell the session server we are back in the lobby (clears flight state for roster). */
  returnToLobby(): void {
    if (!this.isConnected()) return
    this.send({ type: 'return-to-lobby' })
  }

  sendHit(hit: HitEvent): void {
    if (!this.isConnected()) return
    this.send({ type: 'hit', hit })
  }

  consumeInboundHits(): HitEvent[] {
    const out = [...this.inboundHits]
    this.inboundHits.length = 0
    return out
  }

  disconnect(): void {
    if (this.ws) this.ws.close()
    this.ws = null
    this.connected = false
    this.remotePlayers.clear()
    this.localPlayerId = null
    this.inboundHits.length = 0
    this.stateSendAccumSec = 0
    this.cmSendAccumSec = 0
    this.pendingState = null
    this.lastSentRadarMode = null
    this.lastSentMissileKey = ''
    this.lastCmSignature = '0:0'
    this.notifyRosterChanged()
  }

  private send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(msg))
  }

  private notifyRosterChanged(): void {
    for (const listener of this.rosterListeners) listener()
  }
}
