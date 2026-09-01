import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { createGameServer, type GameServer } from './GameServer'

const servers: GameServer[] = []

afterEach(async () => {
  while (servers.length) await servers.pop()!.close()
})

async function startServer(opts: Partial<Parameters<typeof createGameServer>[0]> = {}): Promise<GameServer> {
  const srv = await createGameServer({ port: 0, heartbeatIntervalMs: 60_000, ...opts })
  servers.push(srv)
  return srv
}

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), 2000)
    ws.once('message', raw => {
      clearTimeout(timer)
      resolve(JSON.parse(raw.toString()))
    })
  })
}

const PROFILE = { aircraftId: 'f16c' }

function playerState(pos: [number, number, number]): Record<string, unknown> {
  return {
    positionNED: pos,
    velocityNED: [200, 0, 0],
    attitudeQuat: [1, 0, 0, 0],
    throttle: 0.6,
    ejected: false,
    structuralFailure: false,
    radar: { mode: 'OFF', sttTargetId: null },
    missiles: [],
    countermeasures: null,
  }
}

describe('GameServer', () => {
  it('welcomes a joining player and lists existing peers', async () => {
    const srv = await startServer()
    const a = await connect(srv.port)
    a.send(JSON.stringify({ type: 'join', profile: PROFILE }))
    const welcomeA = await nextMessage(a)
    expect(welcomeA['type']).toBe('welcome')
    expect(welcomeA['peers']).toEqual([])

    const b = await connect(srv.port)
    b.send(JSON.stringify({ type: 'join', profile: PROFILE }))
    const welcomeB = await nextMessage(b)
    expect((welcomeB['peers'] as unknown[]).length).toBe(1)

    // A is told about B joining.
    const peerJoin = await nextMessage(a)
    expect(peerJoin['type']).toBe('peer-join')
    expect(srv.playerCount()).toBe(2)

    a.close(); b.close()
  })

  it('relays validated state to other peers and drops malformed state', async () => {
    const srv = await startServer()
    const a = await connect(srv.port)
    const b = await connect(srv.port)
    a.send(JSON.stringify({ type: 'join', profile: PROFILE }))
    await nextMessage(a)
    b.send(JSON.stringify({ type: 'join', profile: PROFILE }))
    await nextMessage(b)
    await nextMessage(a) // peer-join for b

    b.send(JSON.stringify({ type: 'state', state: { positionNED: 'nope' } }))
    b.send(JSON.stringify({ type: 'state', state: playerState([1, 2, -3000]) }))

    const relayed = await nextMessage(a)
    expect(relayed['type']).toBe('state')
    expect((relayed['state'] as Record<string, unknown>)['positionNED']).toEqual([1, 2, -3000])

    a.close(); b.close()
  })

  it('rejects connections past maxPeers', async () => {
    const srv = await startServer({ maxPeers: 1 })
    const a = await connect(srv.port)
    a.send(JSON.stringify({ type: 'join', profile: PROFILE }))
    await nextMessage(a)

    const b = await connect(srv.port)
    const closeCode = await new Promise<number>(resolve => b.once('close', resolve))
    expect(closeCode).toBe(1013)

    a.close()
  })
})
