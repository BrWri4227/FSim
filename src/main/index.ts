import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { networkInterfaces } from 'os'
import { WebSocketServer, WebSocket } from 'ws'
import { getPrimaryLanIp as _getPrimaryLanIp } from './lanIp'
import type { WebSocket as WS, RawData } from 'ws'
import type { IncomingMessage } from 'http'
import { pathToFileURL } from 'url'
import type { HitEvent, NetPlayerProfile, NetPlayerState, ServerMessage } from '../shared/network/MultiplayerTypes'
import {
  MAX_MESSAGE_BYTES,
  isPlausibleHit,
  isValidHitEvent,
  isValidPlayerState,
  isValidProfile,
} from '../shared/network/validation'

interface PeerRecord {
  id: string
  socket: WebSocket
  profile: NetPlayerProfile | null
  state: NetPlayerState | null
}

let lanServer: WebSocketServer | null = null
let lanServerListening = false
const peers = new Map<string, PeerRecord>()
let peerCounter = 0
let lanServerPort = 0

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
        const hit = msg['hit'] as HitEvent
        const sourcePeer = peers.get(hit.sourceId)
        const targetPeer = peers.get(hit.targetId)
        if (!sourcePeer?.state || !targetPeer?.state) return
        if (!isPlausibleHit(hit, sourcePeer.state, targetPeer.state)) return
        broadcast({ type: 'hit', hit }, peerId)
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
      sandbox: true,
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
