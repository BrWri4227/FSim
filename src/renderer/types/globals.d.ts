export {}

declare global {
  interface Window {
    /**
     * Injected by the preload script. Optional because it genuinely can be
     * absent: the renderer-only dev server (vite.renderer.config.ts) has no
     * Electron behind it, and a preload that fails to load leaves it undefined.
     * Callers must handle that rather than assume a bridge.
     */
    fsim?: {
      version: string
      assets: {
        getAudioBaseUrls: () => Promise<{ urls: string[] }>
      }
      multiplayer: {
        startHost: (port: number) => Promise<{ ok: true; hostIp: string; port: number }>
        stopHost: () => Promise<{ ok: true }>
        getLanIp: () => Promise<{ ip: string }>
        onLobbyEvent: (cb: (evt: { message: string; timestamp: number }) => void) => () => void
      }
    }
  }
}
