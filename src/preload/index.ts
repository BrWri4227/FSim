import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fsim', {
  version: '0.1.4',
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
