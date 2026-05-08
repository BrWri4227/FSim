import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fsim', {
  version: '0.1.0',
  multiplayer: {
    startHost: (port: number) => ipcRenderer.invoke('mp:start-host', port) as Promise<{ ok: true; hostIp: string; port: number }>,
    stopHost: () => ipcRenderer.invoke('mp:stop-host') as Promise<{ ok: true }>,
    getLanIp: () => ipcRenderer.invoke('mp:get-lan-ip') as Promise<{ ip: string }>,
  }
})
