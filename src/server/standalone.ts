import { createGameServer } from './GameServer'
import {
  DEFAULT_SESSION_PORT,
  MAX_SESSION_PORT,
  MIN_SESSION_PORT,
} from '../shared/network/MultiplayerTypes'

/**
 * Head-less dedicated-server entry point.
 *
 *   node dist-server/server/standalone.js --port 45454 --max-peers 12
 *
 * or via env:  FSIM_PORT=45454 FSIM_MAX_PEERS=12 node standalone.js
 *
 * Intended for an always-on host (a VPS, or a Raspberry Pi with a forwarded
 * port) so sessions no longer depend on one player running the Electron client
 * as host.
 *
 * Several independent sessions on one box are several of these processes, each
 * on its own port — see the systemd template unit in docs/dedicated-server.md.
 * There is no room concept: one process is one session.
 */

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function stringOption(flag: string, envKey: string): string | undefined {
  const raw = argValue(flag) ?? process.env[envKey]
  return raw !== undefined && raw !== '' ? raw : undefined
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
  const port = intOption('--port', 'FSIM_PORT', DEFAULT_SESSION_PORT)
  const maxPeers = intOption('--max-peers', 'FSIM_MAX_PEERS', 16)
  const host = argValue('--host') ?? process.env['FSIM_HOST'] ?? '0.0.0.0'
  const name = stringOption('--name', 'FSIM_NAME') ?? `FSim session :${port}`
  const description = stringOption('--description', 'FSIM_DESCRIPTION')
  // Prefer the environment variable. A password on the command line is visible
  // to every user on the box through `ps`.
  const password = process.env['FSIM_PASSWORD'] ?? argValue('--password')

  if (port < MIN_SESSION_PORT || port > MAX_SESSION_PORT) {
    console.error(`Port out of range: ${port} (expected ${MIN_SESSION_PORT}-${MAX_SESSION_PORT})`)
    process.exit(1)
  }

  const stamp = (): string => new Date().toISOString()
  const server = await createGameServer({
    port,
    host,
    maxPeers,
    name,
    ...(description !== undefined ? { description } : {}),
    ...(password !== undefined ? { password } : {}),
    onEvent: msg => console.log(`[${stamp()}] ${msg}`),
  })

  console.log(
    `[${stamp()}] "${name}" up on ${host}:${server.port} ` +
    `(max ${maxPeers}, ${password ? 'password required' : 'open'})`
  )

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
