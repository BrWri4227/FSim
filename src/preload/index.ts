import { contextBridge, ipcRenderer } from 'electron'

/** Injected at build time from package.json — see `define` in electron.vite.config.ts. */
declare const __APP_VERSION__: string

contextBridge.exposeInMainWorld('fsim', {
  version: __APP_VERSION__,
  assets: {
    getAudioBaseUrls: () => ipcRenderer.invoke('assets:get-audio-base-urls') as Promise<{ urls: string[] }>,
  },
  multiplayer: {
    startHost: (port: number) => ipcRenderer.invoke('mp:start-host', port) as Promise<{ ok: true; hostIp: string; port: number }>,
    stopHost: () => ipcRenderer.invoke('mp:stop-host') as Promise<{ ok: true }>,
    getLanIp: () => ipcRenderer.invoke('mp:get-lan-ip') as Promise<{ ip: string }>,
    onLobbyEvent: (cb: (evt: { message: string; timestamp: number }) => void) => {
      const handler = (_event: unknown, payload: { message: string; timestamp: number }): void => cb(payload)
      ipcRenderer.on('mp:lobby-event', handler)
      return () => ipcRenderer.off('mp:lobby-event', handler)
    },
  }
})
