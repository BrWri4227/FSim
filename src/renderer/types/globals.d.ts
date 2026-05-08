export {}

declare global {
  interface Window {
    fsim: {
      version: string
      multiplayer: {
        startHost: (port: number) => Promise<{ ok: true; hostIp: string; port: number }>
        stopHost: () => Promise<{ ok: true }>
        getLanIp: () => Promise<{ ip: string }>
      }
    }
  }
}
