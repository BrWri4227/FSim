import { createGameServer } from './GameServer'

/**
 * Head-less dedicated-server entry point.
 *
 *   node dist-server/server/standalone.js --port 8080 --max-peers 12
 *
 * or via env:  FSIM_PORT=8080 FSIM_MAX_PEERS=12 node standalone.js
 *
 * Intended for an always-on host (VPS or a Raspberry Pi on the LAN with a
 * forwarded port) so sessions no longer depend on one player running the
 * Electron client as host. See docs/dedicated-server.md.
 */

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function intOption(flag: string, envKey: string, fallback: number): number {
  const raw = argValue(flag) ?? process.env[envKey]
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n)) {
    console.error(`Invalid value for ${flag}/${envKey}: ${raw}`)
    process.exit(1)
  }
  return n
}

async function main(): Promise<void> {
  const port = intOption('--port', 'FSIM_PORT', 8080)
  const maxPeers = intOption('--max-peers', 'FSIM_MAX_PEERS', 16)
  const host = argValue('--host') ?? process.env['FSIM_HOST'] ?? '0.0.0.0'

  if (port < 1 || port > 65535) {
    console.error(`Port out of range: ${port}`)
    process.exit(1)
  }

  const stamp = (): string => new Date().toISOString()
  const server = await createGameServer({
    port,
    host,
    maxPeers,
    onEvent: msg => console.log(`[${stamp()}] ${msg}`),
  })

  console.log(`[${stamp()}] FSim dedicated server up. Players: ${server.playerCount()}`)

  let shuttingDown = false
  const shutdown = (sig: string): void => {
    if (shuttingDown) process.exit(0)
    shuttingDown = true
    console.log(`[${stamp()}] ${sig} received — shutting down`)
    // Guarantee the process dies even if a socket refuses to close.
    const hardExit = setTimeout(() => process.exit(0), 3000)
    hardExit.unref()
    server
      .close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch(err => {
  console.error('Failed to start dedicated server:', err)
  process.exit(1)
})
