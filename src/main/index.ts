import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { networkInterfaces } from 'os'
import { getPrimaryLanIp as _getPrimaryLanIp } from './lanIp'
import { pathToFileURL } from 'url'
import { createGameServer, type GameServer } from '../server/GameServer'
import { MAX_SESSION_PORT, MIN_SESSION_PORT } from '../shared/network/MultiplayerTypes'

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

/**
 * Turn a socket error into something a player can act on. These arrive in the
 * lobby as the error line under the Host button, where a raw `listen EADDRINUSE
 * 0.0.0.0:45454` stack tells them nothing about what to do next.
 */
function describeHostError(err: unknown, port: number): string {
  const code = (err as NodeJS.ErrnoException | null)?.code
  switch (code) {
    case 'EADDRINUSE':
      return `Port ${port} is already in use. Another session may already be running — ` +
        'pick a different port, or stop the other one.'
    case 'EACCES':
      return `Not allowed to listen on port ${port}. Ports below ${MIN_SESSION_PORT} need ` +
        'elevated privileges; pick a higher one. On Windows, the firewall prompt must ' +
        'also be accepted before anyone can join.'
    case 'EADDRNOTAVAIL':
      return 'The requested bind address is not available on this machine.'
    default:
      return err instanceof Error ? err.message : `Could not start a session on port ${port}.`
  }
}

async function startLanHost(port: number): Promise<{ ok: true; hostIp: string; port: number }> {
  if (lanServer && lanServerPort === port) {
    return { ok: true, hostIp: getPrimaryLanIp(), port }
  }
  await stopLanHost()
  emitLobbyEvent(`LAN host starting on ${getPrimaryLanIp()}:${port}`)
  try {
    lanServer = await createGameServer({ port, onEvent: emitLobbyEvent })
  } catch (err) {
    const message = describeHostError(err, port)
    emitLobbyEvent(`LAN host failed: ${message}`)
    throw new Error(message)
  }
  lanServerPort = port
  emitLobbyEvent(`LAN host ready on ${getPrimaryLanIp()}:${port}`)
  return { ok: true, hostIp: getPrimaryLanIp(), port }
}

function createWindow(): void {
  // `.cjs` first: the window is sandboxed, and Electron only loads CommonJS
  // preload scripts under sandbox. The other two are fallbacks for builds made
  // before the preload output format was pinned — an `.mjs` preload will fail
  // to load, so say so rather than opening a window with no `window.fsim`.
  const preloadPath = (() => {
    const candidates = ['index.cjs', 'index.js', 'index.mjs']
      .map(name => join(__dirname, '../preload', name))
    const found = candidates.find(existsSync)
    if (!found) {
      console.error(
        'No preload script found. Looked for:\n  ' + candidates.join('\n  ') +
        '\nRun `npm run build` — without it the app has no IPC bridge, so ' +
        'multiplayer and bundled audio will not work.'
      )
      return candidates[0] as string
    }
    if (found.endsWith('.mjs')) {
      console.error(
        `Preload ${found} is an ES module, which Electron cannot load in a ` +
        'sandboxed window. Rebuild with `npm run build` to emit index.cjs.'
      )
    }
    return found
  })()

  const win = new BrowserWindow({
    // Fits inside a 1080p desktop once the title bar is accounted for; F11 goes fullscreen.
    width: 1600,
    height: 900,
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

  // The menu bar is hidden, so Electron's default fullscreen accelerator is gone.
  // Scoped to this window's input rather than a global shortcut, which would take
  // F11 away from every other application while FSim runs.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault()
      win.setFullScreen(!win.isFullScreen())
    }
  })

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
    if (!Number.isInteger(p) || p < MIN_SESSION_PORT || p > MAX_SESSION_PORT) {
      throw new Error(
        `Invalid port: ${String(port)} (expected ${MIN_SESSION_PORT}-${MAX_SESSION_PORT})`
      )
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
