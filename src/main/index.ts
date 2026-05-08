import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { networkInterfaces } from 'os'
import { WebSocketServer, WebSocket } from 'ws'

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

interface NetPlayerState {
  positionNED: [number, number, number]
  velocityNED: [number, number, number]
  attitudeQuat: [number, number, number, number]
  throttle: number
  ejected: boolean
  structuralFailure: boolean
  radar: NetRadarState
  missiles: NetMissileState[]
}

interface HitEvent {
  sourceId: string
  targetId: string
  zone: DamageZone
  severity: number
  weapon: 'GUN' | 'MISSILE'
}

type ClientMessage =
  | { type: 'join'; profile: NetPlayerProfile }
  | { type: 'profile-update'; profile: NetPlayerProfile }
  | { type: 'state'; state: NetPlayerState }
  | { type: 'hit'; hit: HitEvent }

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
      state: NetPlayerState
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

let lanServer: WebSocketServer | null = null
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
  const ifaces = networkInterfaces()
  for (const items of Object.values(ifaces)) {
    for (const i of items ?? []) {
      if (i.family === 'IPv4' && !i.internal) return i.address
    }
  }
  return '127.0.0.1'
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
}

async function startLanHost(port: number): Promise<{ ok: true; hostIp: string; port: number }> {
  if (lanServer && lanServerPort === port) {
    return { ok: true, hostIp: getPrimaryLanIp(), port }
  }
  await stopLanHost()
  lanServer = new WebSocketServer({ host: '0.0.0.0', port })
  lanServerPort = port
  emitLobbyEvent(`LAN host started on ${getPrimaryLanIp()}:${port}`)

  lanServer.on('connection', (socket, request) => {
    const remote = request.socket.remoteAddress ?? 'unknown-client'
    emitLobbyEvent(`Socket connection attempt from ${remote}`)
    const peerId = `peer_${++peerCounter}`
    const peer: PeerRecord = { id: peerId, socket, profile: null, state: null }
    peers.set(peerId, peer)

    socket.on('message', raw => {
      let msg: ClientMessage | null = null
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage
      } catch {
        return
      }
      if (!msg) return

      if (msg.type === 'join') {
        peer.profile = msg.profile
        emitLobbyEvent(`Player ${peerId} joined (${msg.profile.aircraftId.toUpperCase()})`)
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
          profile: msg.profile,
        }, peerId)
        return
      }

      if (msg.type === 'profile-update') {
        if (!peer.profile) return
        peer.profile = msg.profile
        broadcast({ type: 'peer-profile-update', playerId: peerId, profile: msg.profile }, peerId)
        return
      }

      if (msg.type === 'state') {
        if (!peer.profile) return
        peer.state = msg.state
        broadcast({
          type: 'state',
          playerId: peerId,
          profile: peer.profile,
          state: msg.state,
        }, peerId)
        return
      }

      if (msg.type === 'hit') {
        broadcast({ type: 'hit', hit: msg.hit }, peerId)
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
    lanServer?.once('listening', () => resolve())
    lanServer?.once('error', err => reject(err))
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
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('mp:start-host', async (_e, port: number) => {
    return startLanHost(port)
  })
  ipcMain.handle('mp:stop-host', async () => {
    await stopLanHost()
    return { ok: true }
  })
  ipcMain.handle('mp:get-lan-ip', () => ({ ip: getPrimaryLanIp() }))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  void stopLanHost()
  if (process.platform !== 'darwin') app.quit()
})
