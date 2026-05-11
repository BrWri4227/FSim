import type { MultiplayerConfig, NetPlayerProfile, NetPlayerState, ServerMessage, ClientMessage, HitEvent } from './MultiplayerTypes'

const CONNECT_TIMEOUT_MS = 8000
const MAX_INBOUND_HITS = 256

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

  constructor(profile: NetPlayerProfile) {
    this.profile = profile
  }

  async connect(config: MultiplayerConfig): Promise<void> {
    if (config.mode === 'single') return
    const url = `ws://${config.host}:${config.port}`
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

  updateProfile(profile: NetPlayerProfile): void {
    this.profile = profile
    this.send({ type: 'profile-update', profile })
  }

  sendState(state: NetPlayerState): void {
    if (!this.isConnected()) return
    this.send({ type: 'state', state })
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
