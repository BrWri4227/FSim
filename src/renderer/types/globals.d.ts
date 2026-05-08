export {}

declare global {
  interface Window {
    fsim: {
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
