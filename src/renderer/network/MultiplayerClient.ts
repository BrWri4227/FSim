import type { MultiplayerConfig, NetPlayerProfile, NetPlayerState, ServerMessage, ClientMessage, HitEvent, NetScore, MatchConfig, MatchState, JoinRejectionReason } from './MultiplayerTypes'
import { DEFAULT_MATCH_CONFIG, PROTOCOL_VERSION, lobbyMatchState } from './MultiplayerTypes'

/** The server's `death` broadcast, as handed to the session. */
export type DeathEvent = Extract<ServerMessage, { type: 'death' }>
import { quantizePlayerState, missileSetKey } from '../../shared/network/serialization'

const CONNECT_TIMEOUT_MS = 8000
const MAX_INBOUND_HITS = 256
/** Deaths are far rarer than hits, but the queue still needs a ceiling. */
const MAX_INBOUND_DEATHS = 64
/** Outbound state snapshots — 20 Hz instead of sim rate (60 Hz). */
const STATE_SEND_INTERVAL_SEC = 1 / 20
/** Full countermeasure re-sync cadence while flares/chaff are active (they age locally between). */
const CM_RESYNC_INTERVAL_SEC = 0.5

/**
 * A join the server refused, with the reason it gave.
 *
 * Carried as a typed field rather than only a message so the lobby can react to
 * `bad-password` by showing the password box, instead of string-matching.
 */
export class JoinRejectedError extends Error {
  constructor(readonly reason: JoinRejectionReason) {
    super(describeJoinRejection(reason))
    this.name = 'JoinRejectedError'
  }
}

export function describeJoinRejection(reason: JoinRejectionReason): string {
  switch (reason) {
    case 'full':
      return 'That session is full. Try again once someone leaves.'
    case 'bad-password':
      return 'Wrong password for that session.'
    case 'version':
      return 'This build does not match the server. Update the game, or update the server.'
  }
}

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
  private inboundDeaths: DeathEvent[] = []
  /** Server-authoritative standings, keyed by player id (local player included). */
  private scores = new Map<string, NetScore>()
  /** Whose rules the server takes. Only this peer may configure or start a match. */
  private hostId: string | null = null
  private matchConfig: MatchConfig = { ...DEFAULT_MATCH_CONFIG }
  private matchState: MatchState = lobbyMatchState()
  /** Set once when the match ends; drained by the session. */
  private pendingMatchEnd: MatchState | null = null
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

  /**
   * Attach to a session and join it.
   *
   * Resolves once the server has sent a `welcome`, not merely once the socket
   * opened. A password or a version mismatch is refused *after* the handshake,
   * so resolving on open reported success for joins that were about to be
   * turned away — the caller then had no error to show.
   */
  async connect(config: MultiplayerConfig, password?: string): Promise<void> {
    if (config.mode === 'single') return
    const url = resolveSessionUrl(config.host, config.port)
    const ws = new WebSocket(url)
    this.ws = ws

    // Created here so its listeners are attached before the join goes out, but
    // awaited at the end of the method: the durable message handler below must
    // be registered before the welcome arrives, or it misses it and the roster
    // never populates.
    const handshake = new Promise<void>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        ws.removeEventListener('open',  onOpen)
        ws.removeEventListener('error', onError)
        ws.removeEventListener('close', onClose)
        ws.removeEventListener('message', onHandshakeMessage)
        fn()
      }

      const timer = setTimeout(() => {
        settle(() => {
          ws.close()
          reject(new Error(`Connection to ${url} timed out after ${CONNECT_TIMEOUT_MS} ms`))
        })
      }, CONNECT_TIMEOUT_MS)

      const onOpen = (): void => {
        this.connected = true
        this.send({ type: 'join', profile: this.profile, password, protocolVersion: PROTOCOL_VERSION })
      }
      const onError = (): void => {
        settle(() => reject(new Error(`Could not reach a session at ${url}.`)))
      }
      // A close before the welcome means the join was refused. If the server
      // said why, `onHandshakeMessage` has already settled with that reason.
      const onClose = (): void => {
        settle(() => {
          this.connected = false
          reject(new Error(`The session at ${url} closed the connection.`))
        })
      }
      // Only watches for the handshake outcome. The durable handler below sees
      // every message, this one included, and does the actual bookkeeping.
      const onHandshakeMessage = (event: MessageEvent): void => {
        let msg: ServerMessage | null = null
        try {
          msg = JSON.parse(String(event.data)) as ServerMessage
        } catch {
          return
        }
        if (msg?.type === 'welcome') settle(resolve)
        else if (msg?.type === 'join-rejected') {
          const reason = msg.reason
          settle(() => reject(new JoinRejectedError(reason)))
        }
      }

      ws.addEventListener('open',    onOpen)
      ws.addEventListener('error',   onError)
      ws.addEventListener('close',   onClose)
      ws.addEventListener('message', onHandshakeMessage)
    })

    this.ws.addEventListener('message', event => {
      let msg: ServerMessage | null = null
      try {
        msg = JSON.parse(String(event.data)) as ServerMessage
      } catch {
        return
      }
      if (!msg) return

      if (msg.type === 'server-info') {
        // Only a probe asks for this; a joined client ignores it.
        return
      }

      if (msg.type === 'join-rejected') {
        // Handled by the connect() handshake. Nothing to do here.
        return
      }

      if (msg.type === 'welcome') {
        this.localPlayerId = msg.playerId
        this.remotePlayers.clear()
        this.scores.clear()
        this.hostId = msg.hostId
        this.matchConfig = msg.config
        this.matchState = msg.match
        this.scores.set(msg.playerId, msg.score)
        for (const peer of msg.peers) {
          this.remotePlayers.set(peer.playerId, {
            playerId: peer.playerId,
            profile: peer.profile,
            state: peer.state ?? null,
          })
          this.scores.set(peer.playerId, peer.score)
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
        this.scores.set(msg.playerId, { kills: 0, deaths: 0 })
        this.notifyRosterChanged()
        return
      }

      if (msg.type === 'peer-leave') {
        this.remotePlayers.delete(msg.playerId)
        this.scores.delete(msg.playerId)
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
        return
      }

      if (msg.type === 'host-changed') {
        this.hostId = msg.hostId
        this.notifyRosterChanged()
        return
      }

      if (msg.type === 'match-config') {
        this.matchConfig = msg.config
        this.notifyRosterChanged()
        return
      }

      if (msg.type === 'match-state') {
        const previousPhase = this.matchState.phase
        this.matchState = msg.match
        // The transition into ENDED is the moment the session has to react to —
        // queue it the way deaths are queued rather than making the session poll.
        if (previousPhase !== 'ENDED' && msg.match.phase === 'ENDED') {
          this.pendingMatchEnd = msg.match
        }
        this.notifyRosterChanged()
        return
      }

      if (msg.type === 'death') {
        this.scores.set(msg.victimId, msg.victimScore)
        if (msg.killerId && msg.killerScore) this.scores.set(msg.killerId, msg.killerScore)
        if (this.inboundDeaths.length < MAX_INBOUND_DEATHS) {
          this.inboundDeaths.push(msg)
        }
        this.notifyRosterChanged()
      }
    })

    this.ws.addEventListener('close', () => {
      this.connected = false
      this.remotePlayers.clear()
      this.scores.clear()
      this.localPlayerId = null
      this.notifyRosterChanged()
    })

    await handshake
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

  /**
   * Report being shot down. Damage is client-authoritative, so only the victim
   * knows it happened. The server stamps the victim id and keeps the score.
   */
  sendDeath(killerId: string | null): void {
    if (!this.isConnected()) return
    this.send({ type: 'death', killerId })
  }

  consumeInboundDeaths(): DeathEvent[] {
    const out = [...this.inboundDeaths]
    this.inboundDeaths.length = 0
    return out
  }

  // ── Match ──────────────────────────────────────────────────────────────────

  getMatchConfig(): MatchConfig { return this.matchConfig }
  getMatchState(): MatchState { return this.matchState }
  getHostId(): string | null { return this.hostId }

  /** True when this client owns the rules — gates the lobby's host controls. */
  isHost(): boolean {
    return this.localPlayerId !== null && this.localPlayerId === this.hostId
  }

  /** Drain the one-shot "the match just ended" signal. */
  consumeMatchEnd(): MatchState | null {
    const out = this.pendingMatchEnd
    this.pendingMatchEnd = null
    return out
  }

  /** Host only — the server ignores these from anyone else, so they are safe to call. */
  setMatchConfig(config: MatchConfig): void {
    if (!this.isConnected()) return
    this.send({ type: 'set-match-config', config })
  }

  startMatch(): void {
    if (!this.isConnected()) return
    this.send({ type: 'start-match' })
  }

  requestRematch(): void {
    if (!this.isConnected()) return
    this.send({ type: 'request-rematch' })
  }

  /** Server-authoritative standings for one player. Zeroes if not yet known. */
  getScore(playerId: string): NetScore {
    return this.scores.get(playerId) ?? { kills: 0, deaths: 0 }
  }

  getScores(): ReadonlyMap<string, NetScore> {
    return this.scores
  }

  disconnect(): void {
    if (this.ws) this.ws.close()
    this.ws = null
    this.connected = false
    this.remotePlayers.clear()
    this.localPlayerId = null
    this.inboundHits.length = 0
    this.inboundDeaths.length = 0
    this.scores.clear()
    this.hostId = null
    this.matchConfig = { ...DEFAULT_MATCH_CONFIG }
    this.matchState = lobbyMatchState()
    this.pendingMatchEnd = null
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
