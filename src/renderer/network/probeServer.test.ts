/**
 * Probe tests against a real `GameServer`, the way the integration suite does —
 * Node 18+ exposes a global `WebSocket`, which is what the renderer uses, so the
 * production path runs here unmodified.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createGameServer, type GameServer } from '../../server/GameServer'
import { MultiplayerClient } from './MultiplayerClient'
import { describeProbe, probeServer } from './probeServer'
import { PROTOCOL_VERSION } from './MultiplayerTypes'

const servers: GameServer[] = []
const clients: MultiplayerClient[] = []

afterEach(async () => {
  while (clients.length) clients.pop()!.disconnect()
  while (servers.length) await servers.pop()!.close()
})

async function startServer(
  opts: Partial<Parameters<typeof createGameServer>[0]> = {},
): Promise<GameServer> {
  const srv = await createGameServer({ port: 0, heartbeatIntervalMs: 60_000, ...opts })
  servers.push(srv)
  return srv
}

describe('probeServer', () => {
  it('reports a running session without joining it', async () => {
    const srv = await startServer({ name: 'Alpha', description: 'the loud one', maxPeers: 12 })
    const result = await probeServer('127.0.0.1', srv.port)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.name).toBe('Alpha')
    expect(result.info.description).toBe('the loud one')
    expect(result.info.players).toBe(0)
    expect(result.info.maxPlayers).toBe(12)
    expect(result.info.requiresPassword).toBe(false)
    expect(result.compatible).toBe(true)
    expect(result.rttMs).toBeGreaterThanOrEqual(0)
    // The probe must not have consumed a seat.
    expect(srv.playerCount()).toBe(0)
  })

  it('counts the players actually in the session', async () => {
    const srv = await startServer({ name: 'Bravo' })
    const client = new MultiplayerClient({ aircraftId: 'f16c', callsign: 'ONE' })
    clients.push(client)
    await client.connect({ mode: 'join', host: '127.0.0.1', port: srv.port })

    const result = await probeServer('127.0.0.1', srv.port)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.players).toBe(1)
  })

  it('says a session is locked without leaking the password', async () => {
    const srv = await startServer({ password: 'hunter2' })
    const result = await probeServer('127.0.0.1', srv.port)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info.requiresPassword).toBe(true)
    expect(JSON.stringify(result.info)).not.toContain('hunter2')
    expect(describeProbe(result)).toContain('password required')
  })

  it('keeps two sessions on two ports apart', async () => {
    // The whole multi-session model: separate processes, separate ports.
    const alpha = await startServer({ name: 'Alpha', maxPeers: 4 })
    const bravo = await startServer({ name: 'Bravo', maxPeers: 8 })

    const a = await probeServer('127.0.0.1', alpha.port)
    const b = await probeServer('127.0.0.1', bravo.port)
    expect(a.ok && a.info.name).toBe('Alpha')
    expect(b.ok && b.info.name).toBe('Bravo')
    expect(a.ok && a.info.maxPlayers).toBe(4)
    expect(b.ok && b.info.maxPlayers).toBe(8)
  })

  it('reports nothing listening rather than throwing', async () => {
    // Port 1 is privileged and unused; nothing will accept there.
    const result = await probeServer('127.0.0.1', 1, 1500)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(['refused', 'timeout']).toContain(result.kind)
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('describes a healthy session in one line', async () => {
    const srv = await startServer({ name: 'Charlie', maxPeers: 16 })
    const result = await probeServer('127.0.0.1', srv.port)
    const line = describeProbe(result)
    expect(line).toContain('Charlie')
    expect(line).toContain('0/16 players')
    expect(line).toContain('ms')
    expect(line).not.toContain(`this build speaks ${PROTOCOL_VERSION}`)
  })
})
