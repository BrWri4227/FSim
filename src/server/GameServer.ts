import { WebSocketServer, WebSocket } from 'ws'
import type { WebSocket as WS, RawData } from 'ws'
import type { IncomingMessage } from 'http'
import type {
  HitEvent,
  NetPlayerProfile,
  NetPlayerState,
  ServerMessage,
} from '../shared/network/MultiplayerTypes'
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
  const emit = opts.onEvent ?? ((): void => {})

  const peers = new Map<string, PeerRecord>()
  let peerCounter = 0

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

  wss.on('connection', (socket: WS, request: IncomingMessage) => {
    const remote = request.socket.remoteAddress ?? 'unknown-client'

    if (peers.size >= maxPeers) {
      emit(`Rejected ${remote}: session full (${maxPeers} peers)`)
      // 1013 = "Try Again Later"
      try { socket.close(1013, 'session full') } catch { /* already closing */ }
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

      if (msg['type'] === 'join') {
        if (!isValidProfile(msg['profile'])) return
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
        })
        broadcast({ type: 'peer-join', playerId: peerId, profile: peer.profile }, peerId)
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
        const killerPeer =
          typeof rawKillerId === 'string' && rawKillerId !== peerId
            ? peers.get(rawKillerId)
            : undefined
        const killerId = killerPeer?.profile ? killerPeer.id : null

        peer.deaths++
        if (killerPeer?.profile) killerPeer.kills++

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
      }
    })

    socket.on('close', () => {
      const leaving = peers.get(peerId)
      peers.delete(peerId)
      if (leaving?.profile) {
        emit(`Player ${peerId} disconnected`)
        broadcast({ type: 'peer-leave', playerId: peerId })
      } else {
        emit(`Socket ${peerId} disconnected before join`)
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
