import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { networkInterfaces } from 'os'
import { WebSocketServer, WebSocket } from 'ws'
import { getPrimaryLanIp as _getPrimaryLanIp } from './lanIp'
import type { WebSocket as WS, RawData } from 'ws'
import type { IncomingMessage } from 'http'
import { pathToFileURL } from 'url'

type DamageZone = 'ENGINE' | 'WING_LEFT' | 'WING_RIGHT' | 'FUSELAGE' | 'TAIL' | 'COCKPIT'

interface NetPlayerProfile {
  aircraftId: string
}

interface NetRadarState {
  mode: 'OFF' | 'RWS' | 'TWS' | 'STT'
  sttTargetId: string | null
}

interface NetMissileState {
  id: string
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  targetEntityId: string
  active: boolean
}

interface NetFlareState {
  positionNED: [number, number, number]
  heatSignatureKW: number
  ageSec: number
}

interface NetChaffState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  rcsM2: number
  ageSec: number
}

interface NetCountermeasureState {
  flares: NetFlareState[]
  chaffClouds: NetChaffState[]
}

interface NetPlayerState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  attitudeQuat: [number, number, number, number]
  throttle: number
  ejected: boolean
  structuralFailure: boolean
  radar: NetRadarState
  missiles: NetMissileState[]
  countermeasures: NetCountermeasureState
}

interface HitEvent {
  sourceId: string
  targetId: string
  zone: DamageZone
  severity: number
  weapon: 'GUN' | 'MISSILE'
}

type ServerMessage =
  | {
      type: 'welcome'
      playerId: string
      peers: Array<{ playerId: string; profile: NetPlayerProfile; state: NetPlayerState | null }>
    }
  | {
      type: 'peer-join'
      playerId: string
      profile: NetPlayerProfile
    }
  | {
      type: 'peer-leave'
      playerId: string
    }
  | {
      type: 'peer-profile-update'
      playerId: string
      profile: NetPlayerProfile
    }
  | {
      type: 'state'
      playerId: string
      profile: NetPlayerProfile
      state: NetPlayerState | null
    }
  | {
      type: 'hit'
      hit: HitEvent
    }

interface PeerRecord {
  id: string
  socket: WebSocket
  profile: NetPlayerProfile | null
  state: NetPlayerState | null
}

const MAX_MESSAGE_BYTES = 64 * 1024  // 64 KB hard cap per frame
const MAX_INBOUND_DAMAGE_SEVERITY = 1.0
const VALID_DAMAGE_ZONES = new Set<string>(['ENGINE', 'WING_LEFT', 'WING_RIGHT', 'FUSELAGE', 'TAIL', 'COCKPIT'])
const VALID_RADAR_MODES = new Set<string>(['OFF', 'RWS', 'TWS', 'STT'])

let lanServer: WebSocketServer | null = null
let lanServerListening = false
const peers = new Map<string, PeerRecord>()
let peerCounter = 0
let lanServerPort = 0

function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && isFinite(x))
}

function isVec4(v: unknown): v is [number, number, number, number] {
  return Array.isArray(v) && v.length === 4 && v.every(x => typeof x === 'number' && isFinite(x))
}

function isValidProfile(p: unknown): p is NetPlayerProfile {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Record<string, unknown>
  return typeof o['aircraftId'] === 'string' && o['aircraftId'].length > 0 && o['aircraftId'].length <= 64
}

function isValidHitEvent(h: unknown, senderId: string): h is HitEvent {
  if (typeof h !== 'object' || h === null) return false
  const o = h as Record<string, unknown>
  return (
    o['sourceId'] === senderId &&
    typeof o['targetId'] === 'string' && o['targetId'].length > 0 &&
    VALID_DAMAGE_ZONES.has(String(o['zone'])) &&
    typeof o['severity'] === 'number' && o['severity'] >= 0 && o['severity'] <= MAX_INBOUND_DAMAGE_SEVERITY &&
    (o['weapon'] === 'GUN' || o['weapon'] === 'MISSILE')
  )
}

function isValidRadarState(r: unknown): r is NetRadarState {
  if (typeof r !== 'object' || r === null) return false
  const o = r as Record<string, unknown>
  return (
    VALID_RADAR_MODES.has(String(o['mode'])) &&
    (o['sttTargetId'] === null || typeof o['sttTargetId'] === 'string')
  )
}

function isValidPlayerState(s: unknown): s is NetPlayerState {
  if (typeof s !== 'object' || s === null) return false
  const o = s as Record<string, unknown>
  return (
    isVec3(o['positionNED']) &&
    isVec3(o['velocityNED']) &&
    isVec4(o['attitudeQuat']) &&
    typeof o['throttle'] === 'number' && o['throttle'] >= 0 && o['throttle'] <= 1 &&
    typeof o['ejected'] === 'boolean' &&
    typeof o['structuralFailure'] === 'boolean' &&
    isValidRadarState(o['radar']) &&
    Array.isArray(o['missiles']) &&
    typeof o['countermeasures'] === 'object' && o['countermeasures'] !== null
  )
}

function emitLobbyEvent(message: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mp:lobby-event', {
      message,
      timestamp: Date.now(),
    })
  }
}

function send(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(msg))
}

function broadcast(msg: ServerMessage, exceptPeerId?: string): void {
  for (const [peerId, peer] of peers) {
    if (exceptPeerId && peerId === exceptPeerId) continue
    send(peer.socket, msg)
  }
}

function getPrimaryLanIp(): string {
  return _getPrimaryLanIp(networkInterfaces())
}

async function stopLanHost(): Promise<void> {
  for (const peer of peers.values()) peer.socket.close()
  peers.clear()
  peerCounter = 0
  if (!lanServer) return
  emitLobbyEvent('LAN host stopped.')
  await new Promise<void>(resolve => {
    lanServer?.close(() => resolve())
  })
  lanServer = null
  lanServerPort = 0
  lanServerListening = false
}

async function startLanHost(port: number): Promise<{ ok: true; hostIp: string; port: number }> {
  if (lanServer && lanServerListening && lanServerPort === port) {
    return { ok: true, hostIp: getPrimaryLanIp(), port }
  }
  await stopLanHost()
  const srv = new WebSocketServer({ host: '0.0.0.0', port })
  lanServer = srv
  emitLobbyEvent(`LAN host starting on ${getPrimaryLanIp()}:${port}`)

  lanServer.on('connection', (socket: WS, request: IncomingMessage) => {
    const remote = request.socket.remoteAddress ?? 'unknown-client'
    emitLobbyEvent(`Socket connection attempt from ${remote}`)
    const peerId = `peer_${++peerCounter}`
    const peer: PeerRecord = { id: peerId, socket, profile: null, state: null }
    peers.set(peerId, peer)

    socket.on('message', (raw: RawData) => {
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
        peer.profile = msg['profile']
        emitLobbyEvent(`Player ${peerId} joined (${msg['profile'].aircraftId.toUpperCase()})`)
        send(socket, {
          type: 'welcome',
          playerId: peerId,
          peers: [...peers.values()]
            .filter(p => p.id !== peerId && p.profile !== null)
            .map(p => ({
              playerId: p.id,
              profile: p.profile as NetPlayerProfile,
              state: p.state
            })),
        })
        broadcast({
          type: 'peer-join',
          playerId: peerId,
          profile: msg['profile'],
        }, peerId)
        return
      }

      if (msg['type'] === 'profile-update') {
        if (!peer.profile || !isValidProfile(msg['profile'])) return
        peer.profile = msg['profile']
        broadcast({ type: 'peer-profile-update', playerId: peerId, profile: msg['profile'] }, peerId)
        return
      }

      if (msg['type'] === 'return-to-lobby') {
        if (!peer.profile) return
        peer.state = null
        broadcast({
          type: 'state',
          playerId: peerId,
          profile: peer.profile,
          state: null,
        }, peerId)
        return
      }

      if (msg['type'] === 'state') {
        if (!peer.profile || !isValidPlayerState(msg['state'])) return
        peer.state = msg['state']
        broadcast({
          type: 'state',
          playerId: peerId,
          profile: peer.profile,
          state: msg['state'],
        }, peerId)
        return
      }

      if (msg['type'] === 'hit') {
        if (!isValidHitEvent(msg['hit'], peerId)) return
        broadcast({ type: 'hit', hit: msg['hit'] }, peerId)
      }
    })

    socket.on('close', () => {
      const leaving = peers.get(peerId)
      peers.delete(peerId)
      if (leaving?.profile) {
        emitLobbyEvent(`Player ${peerId} disconnected`)
        broadcast({ type: 'peer-leave', playerId: peerId })
      } else {
        emitLobbyEvent(`Socket ${peerId} disconnected before join`)
      }
    })
  })

  await new Promise<void>((resolve, reject) => {
    srv.once('listening', () => {
      lanServerPort = port
      lanServerListening = true
      emitLobbyEvent(`LAN host ready on ${getPrimaryLanIp()}:${port}`)
      resolve()
    })
    srv.once('error', (err: Error) => {
      lanServer = null
      lanServerPort = 0
      lanServerListening = false
      reject(err)
    })
  })
  return { ok: true, hostIp: getPrimaryLanIp(), port }
}

function createWindow(): void {
  const preloadPath = (() => {
    const mjs = join(__dirname, '../preload/index.mjs')
    const js = join(__dirname, '../preload/index.js')
    if (existsSync(mjs)) return mjs
    return js
  })()

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setMenuBarVisibility(false)

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        void shell.openExternal(url)
      }
    } catch {
      // malformed URL — ignore
    }
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function toDirectoryFileUrl(pathValue: string): string {
  const normalized = pathValue.endsWith('\\') || pathValue.endsWith('/')
    ? pathValue
    : `${pathValue}/`
  return pathToFileURL(normalized).href
}

function getAudioBaseUrls(): string[] {
  const out = new Set<string>()
  const devRendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (devRendererUrl) {
    out.add(`${devRendererUrl.replace(/\/+$/, '')}/sounds/`)
  }

  // Dist renderer path next to main bundle (works for unpacked dev/prod layouts).
  out.add(toDirectoryFileUrl(join(__dirname, '../renderer/sounds')))

  // Packaged Windows/Linux/macOS with asarUnpack places assets here.
  out.add(toDirectoryFileUrl(join(process.resourcesPath, 'app.asar.unpacked', 'dist-electron', 'renderer', 'sounds')))

  return [...out]
}

app.whenReady().then(() => {
  ipcMain.handle('mp:start-host', async (_e, port: unknown) => {
    const p = Number(port)
    if (!Number.isInteger(p) || p < 1024 || p > 65535) {
      throw new Error(`Invalid port: ${String(port)}`)
    }
    return startLanHost(p)
  })
  ipcMain.handle('mp:stop-host', async () => {
    await stopLanHost()
    return { ok: true }
  })
  ipcMain.handle('mp:get-lan-ip', () => ({ ip: getPrimaryLanIp() }))
  ipcMain.handle('assets:get-audio-base-urls', () => ({ urls: getAudioBaseUrls() }))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopLanHost().finally(() => app.quit())
  } else {
    void stopLanHost()
  }
})
