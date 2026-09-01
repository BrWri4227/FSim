import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { networkInterfaces } from 'os'
import { getPrimaryLanIp as _getPrimaryLanIp } from './lanIp'
import { pathToFileURL } from 'url'
import { createGameServer, type GameServer } from '../server/GameServer'

let lanServer: GameServer | null = null
let lanServerPort = 0

function emitLobbyEvent(message: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mp:lobby-event', {
      message,
      timestamp: Date.now(),
    })
  }
}

function getPrimaryLanIp(): string {
  return _getPrimaryLanIp(networkInterfaces())
}

async function stopLanHost(): Promise<void> {
  if (!lanServer) return
  const srv = lanServer
  lanServer = null
  lanServerPort = 0
  emitLobbyEvent('LAN host stopped.')
  await srv.close()
}

async function startLanHost(port: number): Promise<{ ok: true; hostIp: string; port: number }> {
  if (lanServer && lanServerPort === port) {
    return { ok: true, hostIp: getPrimaryLanIp(), port }
  }
  await stopLanHost()
  emitLobbyEvent(`LAN host starting on ${getPrimaryLanIp()}:${port}`)
  lanServer = await createGameServer({ port, onEvent: emitLobbyEvent })
  lanServerPort = port
  emitLobbyEvent(`LAN host ready on ${getPrimaryLanIp()}:${port}`)
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
