import { WebSocketServer, WebSocket } from 'ws'
import type { WebSocket as WS, RawData } from 'ws'
import type { IncomingMessage } from 'http'
import type {
  HitEvent,
  JoinRejectionReason,
  NetPlayerProfile,
  MatchConfig,
  MatchState,
  NetPlayerState,
  ServerInfo,
  ServerMessage,
  Team,
} from '../shared/network/MultiplayerTypes'
import {
  DEFAULT_MATCH_CONFIG,
  DEFAULT_TEAM,
  PROTOCOL_VERSION,
  emptyTeamScores,
  lobbyMatchState,
} from '../shared/network/MultiplayerTypes'
import { isValidMatchConfig } from '../shared/network/validation'
import {
  MAX_MESSAGE_BYTES,
  isPlausibleHit,
  isValidHitEvent,
  isValidPlayerState,
  isValidProfile,
  sanitizeProfile,
} from '../shared/network/validation'

/**
 * Transport-agnostic LAN / online session server.
 *
 * Extracted from the Electron main process so the exact same relay can run
 * head-less on a small always-on box (e.g. a Raspberry Pi) for internet play.
 * Nothing here imports Electron or the renderer — only `ws` and the shared
 * protocol/validation module.
 */

export interface GameServerOptions {
  port: number
  /** Bind address. Default `0.0.0.0` (all interfaces). */
  host?: string
  /** Hard cap on simultaneously joined players. Default 16. */
  maxPeers?: number
  /** Ping cadence for dead-connection detection. Default 15 s. */
  heartbeatIntervalMs?: number
  /** Per-peer inbound message ceiling per second. Default 150. */
  msgRateLimit?: number
  /**
   * Shown to anyone who probes the address. With one process per session, this
   * is what distinguishes two sessions on the same box.
   */
  name?: string
  description?: string
  /**
   * Required to join, when set. Not authentication in any real sense — it keeps
   * a publicly routable port from being a public server. Never sent to clients;
   * a probe only learns that one is needed.
   */
  password?: string
  /**
   * How long an unjoined socket may sit in the foyer. Default 10 s. Bounds the
   * cost of sockets that connect and then say nothing.
   */
  handshakeTimeoutMs?: number
  /** Human-readable lifecycle log sink. */
  onEvent?: (message: string) => void
}

export interface GameServer {
  readonly port: number
  playerCount(): number
  close(): Promise<void>
}

interface PeerRecord {
  id: string
  socket: WS
  profile: NetPlayerProfile | null
  state: NetPlayerState | null
  isAlive: boolean
  /** Sliding one-second message counter for rate limiting. */
  msgWindowStart: number
  msgCount: number
  /** Server-authoritative score, so every client shows the same standings. */
  kills: number
  deaths: number
}

/**
 * Ignore a death reported within this long of the previous one from the same
 * peer. A victim's damage state stays past the kill threshold for the whole
 * respawn delay, so a client that re-evaluates each tick — or one that is
 * simply buggy — would otherwise inflate its killer's score without limit.
 */
const DEATH_DEBOUNCE_MS = 3000

export function createGameServer(opts: GameServerOptions): Promise<GameServer> {
  const host = opts.host ?? '0.0.0.0'
  const maxPeers = opts.maxPeers ?? 16
  const heartbeatIntervalMs = opts.heartbeatIntervalMs ?? 15_000
  const msgRateLimit = opts.msgRateLimit ?? 150
  const handshakeTimeoutMs = opts.handshakeTimeoutMs ?? 10_000
  const serverName = opts.name ?? 'FSim session'
  const serverDescription = opts.description ?? null
  const serverPassword = opts.password && opts.password.length > 0 ? opts.password : null
  const emit = opts.onEvent ?? ((): void => {})

  /**
   * Ceiling on sockets that have connected but not yet joined. Probes live
   * here, so it has to be higher than the player cap — but bounded, or a
   * connect-and-stay-silent loop would exhaust the process.
   */
  const maxUnjoinedSockets = Math.max(8, maxPeers * 2)

  const peers = new Map<string, PeerRecord>()
  let peerCounter = 0

  // ── Match state ────────────────────────────────────────────────────────────
  // The server owns this rather than each client deciding for itself, so a
  // match ends at the same instant for everyone and the board they all look at
  // agrees. Score already lived here; the rules now live here too.
  let matchConfig: MatchConfig = { ...DEFAULT_MATCH_CONFIG }
  let match: MatchState = lobbyMatchState()
  /** Whose settings the server accepts. The first joined peer, re-elected on leave. */
  let hostId: string | null = null
  let timeLimitTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimeLimit(): void {
    if (timeLimitTimer !== null) {
      clearTimeout(timeLimitTimer)
      timeLimitTimer = null
    }
  }

  /**
   * Promote the longest-standing joined peer if the seat is vacant.
   *
   * `notify` is false on join: the welcome already carries `hostId`, and a peer
   * that has just been told cannot benefit from being told again — announcing
   * it there would put an extra frame in front of every client on every join.
   * A host *leaving* is the case everyone genuinely needs to hear about.
   */
  function electHost(notify: boolean): void {
    if (hostId !== null && peers.get(hostId)?.profile) return
    const next = [...peers.values()].find(p => p.profile !== null)
    hostId = next?.id ?? null
    if (hostId && notify) broadcast({ type: 'host-changed', hostId })
  }

  function broadcastMatchState(): void {
    broadcast({ type: 'match-state', match })
  }

  function endMatch(winner: Team | null): void {
    if (match.phase !== 'LIVE') return
    clearTimeLimit()
    match = { ...match, phase: 'ENDED', winner }
    emit(winner ? `Match over — ${winner} wins` : 'Match over — draw')
    broadcastMatchState()
  }

  /** Whoever is ahead when the clock runs out; null on a tie. */
  function leadingTeam(): Team | null {
    const { BLUE, RED } = match.teamScores
    if (BLUE === RED) return null
    return BLUE > RED ? 'BLUE' : 'RED'
  }

  function startMatch(): void {
    if (match.phase === 'LIVE') return
    clearTimeLimit()
    match = {
      phase: 'LIVE',
      startedAtMs: Date.now(),
      teamScores: emptyTeamScores(),
      winner: null,
    }
    for (const peer of peers.values()) {
      peer.kills = 0
      peer.deaths = 0
    }
    if (matchConfig.timeLimitSec > 0) {
      timeLimitTimer = setTimeout(() => endMatch(leadingTeam()), matchConfig.timeLimitSec * 1000)
      if (typeof timeLimitTimer.unref === 'function') timeLimitTimer.unref()
    }
    emit(`Match started — ${matchConfig.mode}, first to ${matchConfig.scoreLimit}`)
    broadcastMatchState()
  }

  function returnToLobbyPhase(): void {
    clearTimeLimit()
    match = lobbyMatchState()
    for (const peer of peers.values()) {
      peer.kills = 0
      peer.deaths = 0
    }
    emit('Rematch — back to the lobby')
    broadcastMatchState()
  }

  const wss = new WebSocketServer({
    host,
    port: opts.port,
    maxPayload: MAX_MESSAGE_BYTES,
    // Compress the repetitive JSON snapshot stream. Thresholds keep tiny
    // control frames uncompressed and bound per-socket memory so a busy
    // Pi doesn't fragment its heap under many peers.
    perMessageDeflate: {
      threshold: 256,
      zlibDeflateOptions: { level: 6, memLevel: 7 },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      concurrencyLimit: 4,
    },
  })

  function send(socket: WS, msg: ServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(msg))
  }

  function broadcast(msg: ServerMessage, exceptPeerId?: string): void {
    const payload = JSON.stringify(msg)
    for (const [peerId, peer] of peers) {
      if (exceptPeerId && peerId === exceptPeerId) continue
      if (peer.socket.readyState === WebSocket.OPEN) peer.socket.send(payload)
    }
  }

  /** A joined peer's side. Profiles are sanitized on join, so this is always set. */
  function teamOf(peer: PeerRecord): Team {
    return peer.profile?.team ?? DEFAULT_TEAM
  }

  function playerCount(): number {
    let n = 0
    for (const p of peers.values()) if (p.profile) n++
    return n
  }

  function withinRateLimit(peer: PeerRecord): boolean {
    const now = Date.now()
    if (now - peer.msgWindowStart >= 1000) {
      peer.msgWindowStart = now
      peer.msgCount = 0
    }
    peer.msgCount++
    return peer.msgCount <= msgRateLimit
  }

  function unjoinedCount(): number {
    let n = 0
    for (const p of peers.values()) if (!p.profile) n++
    return n
  }

  /** Everything a probe is allowed to know, and nothing more. */
  function describeServer(): ServerInfo {
    return {
      name: serverName,
      description: serverDescription,
      players: playerCount(),
      maxPlayers: maxPeers,
      requiresPassword: serverPassword !== null,
      protocolVersion: PROTOCOL_VERSION,
      match,
      config: matchConfig,
    }
  }

  wss.on('connection', (socket: WS, request: IncomingMessage) => {
    const remote = request.socket.remoteAddress ?? 'unknown-client'

    // Capacity is checked at join, not here, so a probe can still be told the
    // session is full. Refusing the TCP connection outright left a client
    // unable to tell "full" from "not running".
    if (unjoinedCount() >= maxUnjoinedSockets) {
      emit(`Rejected ${remote}: too many sockets waiting to join`)
      try { socket.close(1013, 'busy') } catch { /* already closing */ }
      return
    }

    const peerId = `peer_${++peerCounter}`
    const peer: PeerRecord = {
      id: peerId,
      socket,
      profile: null,
      state: null,
      isAlive: true,
      msgWindowStart: Date.now(),
      msgCount: 0,
      kills: 0,
      deaths: 0,
    }
    let lastDeathAtMs = 0
    peers.set(peerId, peer)
    emit(`Socket connection attempt from ${remote} (${peerId})`)

    // A socket that connects and never joins holds a foyer slot forever
    // otherwise. Probes close themselves well inside this.
    let handshakeTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      handshakeTimer = null
      if (peers.get(peerId)?.profile) return
      emit(`Closing ${peerId}: no join within ${handshakeTimeoutMs} ms`)
      try { socket.close(1002, 'no join') } catch { /* already closing */ }
    }, handshakeTimeoutMs)
    if (typeof handshakeTimer.unref === 'function') handshakeTimer.unref()

    const clearHandshakeTimer = (): void => {
      if (handshakeTimer !== null) {
        clearTimeout(handshakeTimer)
        handshakeTimer = null
      }
    }

    /** Refuse the join, say why, and close. */
    const rejectJoin = (reason: JoinRejectionReason, code: number, note: string): void => {
      emit(`Refused ${peerId}: ${note}`)
      send(socket, { type: 'join-rejected', reason })
      // Let the frame reach the client before the close does.
      setTimeout(() => {
        try { socket.close(code, reason) } catch { /* already closing */ }
      }, 50).unref?.()
    }

    socket.on('pong', () => { peer.isAlive = true })

    socket.on('message', (raw: RawData) => {
      if (!withinRateLimit(peer)) return

      const str = raw.toString()
      if (str.length > MAX_MESSAGE_BYTES) return

      let parsed: unknown
      try {
        parsed = JSON.parse(str)
      } catch {
        return
      }
      if (typeof parsed !== 'object' || parsed === null) return
      const msg = parsed as Record<string, unknown>

      if (msg['type'] === 'query') {
        // Answered without joining and without occupying a player slot, so the
        // lobby can show a name, a count and a ping for a typed address.
        send(socket, { type: 'server-info', info: describeServer() })
        clearHandshakeTimer()
        setTimeout(() => {
          try { socket.close(1000, 'query complete') } catch { /* already closing */ }
        }, 50).unref?.()
        return
      }

      if (msg['type'] === 'join') {
        if (!isValidProfile(msg['profile'])) return
        if (peer.profile) return  // already joined; ignore a repeat

        // A build that does not send a version predates the field, and a higher
        // one speaks a dialect this server does not know. Either way, say so
        // rather than accepting a join and desyncing a few seconds later.
        const claimedVersion = msg['protocolVersion']
        if (claimedVersion !== undefined && typeof claimedVersion !== 'number') return
        if ((claimedVersion ?? 0) !== PROTOCOL_VERSION) {
          rejectJoin('version', 4004, `protocol ${String(claimedVersion)} != ${PROTOCOL_VERSION}`)
          return
        }

        if (serverPassword !== null && msg['password'] !== serverPassword) {
          rejectJoin('bad-password', 4003, 'wrong password')
          return
        }

        if (playerCount() >= maxPeers) {
          // 1013 = "Try Again Later".
          rejectJoin('full', 1013, `session full (${maxPeers} players)`)
          return
        }

        clearHandshakeTimer()
        // Sanitize here rather than trusting the sender: the callsign is
        // rendered as text on every other client.
        peer.profile = sanitizeProfile(msg['profile'])
        const who = peer.profile.callsign ?? peerId
        emit(`Player ${who} joined (${peer.profile.aircraftId.toUpperCase()})`)
        send(socket, {
          type: 'welcome',
          playerId: peerId,
          peers: [...peers.values()]
            .filter(p => p.id !== peerId && p.profile !== null)
            .map(p => ({
              playerId: p.id,
              profile: p.profile as NetPlayerProfile,
              state: p.state,
              // Included so a late joiner sees the real standings rather than
              // a table of zeroes that only fills in as people die.
              score: { kills: p.kills, deaths: p.deaths },
            })),
          score: { kills: peer.kills, deaths: peer.deaths },
          hostId: hostId ?? peerId,
          config: matchConfig,
          match,
        })
        // First to join owns the rules. Sent after the welcome so the new peer
        // already knows who the host is before anyone is told it changed.
        electHost(false)
        broadcast({ type: 'peer-join', playerId: peerId, profile: peer.profile }, peerId)
        return
      }

      if (msg['type'] === 'set-match-config') {
        if (peerId !== hostId) return
        if (!isValidMatchConfig(msg['config'])) return
        // Rules are fixed once the shooting starts; changing them mid-match
        // would move the finish line under everyone.
        if (match.phase === 'LIVE') return
        matchConfig = msg['config']
        broadcast({ type: 'match-config', config: matchConfig })
        return
      }

      if (msg['type'] === 'start-match') {
        if (peerId !== hostId) return
        startMatch()
        return
      }

      if (msg['type'] === 'request-rematch') {
        if (peerId !== hostId) return
        returnToLobbyPhase()
        return
      }

      if (msg['type'] === 'profile-update') {
        if (!peer.profile || !isValidProfile(msg['profile'])) return
        peer.profile = sanitizeProfile(msg['profile'])
        broadcast({ type: 'peer-profile-update', playerId: peerId, profile: peer.profile }, peerId)
        return
      }

      if (msg['type'] === 'return-to-lobby') {
        if (!peer.profile) return
        peer.state = null
        broadcast({ type: 'state', playerId: peerId, profile: peer.profile, state: null }, peerId)
        return
      }

      if (msg['type'] === 'state') {
        if (!peer.profile || !isValidPlayerState(msg['state'])) return
        peer.state = msg['state']
        broadcast({ type: 'state', playerId: peerId, profile: peer.profile, state: msg['state'] }, peerId)
        return
      }

      if (msg['type'] === 'hit') {
        if (!isValidHitEvent(msg['hit'], peerId)) return
        const hit = msg['hit'] as HitEvent
        const sourcePeer = peers.get(hit.sourceId)
        const targetPeer = peers.get(hit.targetId)
        if (!sourcePeer?.state || !targetPeer?.state) return
        if (!isPlausibleHit(hit, sourcePeer.state, targetPeer.state)) return
        // Friendly fire is off, and the server enforces it rather than trusting
        // every client to filter its own target list. An honest client cannot
        // even lock a teammate; this stops a modified one.
        if (teamOf(sourcePeer) === teamOf(targetPeer)) return
        broadcast({ type: 'hit', hit }, peerId)
        return
      }

      if (msg['type'] === 'death') {
        if (!peer.profile) return

        const now = Date.now()
        if (now - lastDeathAtMs < DEATH_DEBOUNCE_MS) return
        lastDeathAtMs = now

        const rawKillerId = msg['killerId']
        if (rawKillerId !== null && typeof rawKillerId !== 'string') return

        // A killer only counts if they are a real, joined peer other than the
        // victim. Self-attribution would let a client farm its own score, and
        // a stale id from someone who has since left must not resurrect them.
        const claimedKiller =
          typeof rawKillerId === 'string' && rawKillerId !== peerId
            ? peers.get(rawKillerId)
            : undefined
        // Nor may they name a *teammate*. Friendly fire is already refused at
        // the hit stage, but deaths are client-authoritative — without this a
        // client could hand its own side a free point just by claiming its
        // wingman shot it down. Same treatment as self-attribution: the death
        // still counts, it simply has no killer.
        const killerPeer =
          claimedKiller?.profile && teamOf(claimedKiller) !== teamOf(peer)
            ? claimedKiller
            : undefined
        const killerId = killerPeer ? killerPeer.id : null

        // Nothing scores after the buzzer. Without this the personal tallies
        // kept climbing past the score limit while the team score was frozen,
        // so the end-of-match board showed 30 kills in a match won at 25.
        // LOBBY still scores: a session with no match running is a free-for-all
        // and the standings are all it has.
        if (match.phase !== 'ENDED') {
          peer.deaths++
          if (killerPeer?.profile) killerPeer.kills++
        }

        const victimName = peer.profile.callsign ?? peerId
        const killerName = killerPeer?.profile
          ? (killerPeer.profile.callsign ?? killerPeer.id)
          : null
        emit(killerName ? `${victimName} was shot down by ${killerName}` : `${victimName} went down`)

        // No exceptPeerId: every client, the victim included, builds the
        // scoreboard and kill feed from this one stream, so they cannot
        // disagree about what happened.
        broadcast({
          type: 'death',
          victimId: peerId,
          killerId,
          victimScore: { kills: peer.kills, deaths: peer.deaths },
          killerScore: killerPeer?.profile
            ? { kills: killerPeer.kills, deaths: killerPeer.deaths }
            : null,
        })

        // Team score, and the only thing that ever ends a match on points.
        if (match.phase === 'LIVE' && killerPeer?.profile) {
          const side = teamOf(killerPeer)
          match.teamScores[side]++
          broadcastMatchState()
          if (match.teamScores[side] >= matchConfig.scoreLimit) endMatch(side)
        }
      }
    })

    socket.on('close', () => {
      clearHandshakeTimer()
      const leaving = peers.get(peerId)
      peers.delete(peerId)
      if (leaving?.profile) {
        emit(`Player ${peerId} disconnected`)
        broadcast({ type: 'peer-leave', playerId: peerId })
      } else {
        emit(`Socket ${peerId} disconnected before join`)
      }
      // If the host left, someone has to own the rules or the session can never
      // start another match.
      if (peerId === hostId) {
        hostId = null
        electHost(true)
      }
    })

    socket.on('error', () => { /* 'close' handles cleanup */ })
  })

  const heartbeat = setInterval(() => {
    for (const peer of peers.values()) {
      if (!peer.isAlive) {
        emit(`Terminating unresponsive ${peer.id}`)
        try { peer.socket.terminate() } catch { /* noop */ }
        continue
      }
      peer.isAlive = false
      try { peer.socket.ping() } catch { /* noop */ }
    }
  }, heartbeatIntervalMs)
  // Don't keep a head-less process alive solely for the heartbeat timer.
  if (typeof heartbeat.unref === 'function') heartbeat.unref()

  return new Promise<GameServer>((resolve, reject) => {
    wss.once('error', reject)
    wss.once('listening', () => {
      wss.off('error', reject)
      const addr = wss.address()
      const boundPort = typeof addr === 'object' && addr ? addr.port : opts.port
      emit(`Game server listening on ${host}:${boundPort} (max ${maxPeers} peers)`)

      wss.on('error', (err: Error) => emit(`Server socket error: ${err.message}`))

      resolve({
        port: boundPort,
        playerCount,
        close: () =>
          new Promise<void>(res => {
            clearInterval(heartbeat)
            clearTimeLimit()
            for (const peer of peers.values()) {
              try { peer.socket.close() } catch { /* noop */ }
            }
            peers.clear()
            wss.close(() => res())
          }),
      })
    })
  })
}
