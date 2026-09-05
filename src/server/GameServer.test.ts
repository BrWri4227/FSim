import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { createGameServer, type GameServer } from './GameServer'
import { PROTOCOL_VERSION } from '../shared/network/MultiplayerTypes'

const servers: GameServer[] = []

afterEach(async () => {
  while (servers.length) await servers.pop()!.close()
})

async function startServer(opts: Partial<Parameters<typeof createGameServer>[0]> = {}): Promise<GameServer> {
  const srv = await createGameServer({ port: 0, heartbeatIntervalMs: 60_000, ...opts })
  servers.push(srv)
  return srv
}

/**
 * Buffered inbox per socket.
 *
 * These tests used to call `ws.once('message')` on demand, which silently drops
 * anything that lands while no listener happens to be attached. Delivery order
 * across two *different* sockets is not guaranteed — a broadcast to A can beat
 * the direct reply to B — so whether a test passed depended on frame sizes and
 * timing. Every message is queued from the moment the socket opens instead, and
 * `nextMessage` shifts from that queue.
 */
const inboxes = new WeakMap<WebSocket, {
  queue: Record<string, unknown>[]
  waiters: ((msg: Record<string, unknown>) => void)[]
}>()

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const inbox: { queue: Record<string, unknown>[]; waiters: ((m: Record<string, unknown>) => void)[] } =
      { queue: [], waiters: [] }
    inboxes.set(ws, inbox)
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>
      const waiter = inbox.waiters.shift()
      if (waiter) waiter(msg)
      else inbox.queue.push(msg)
    })
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  const inbox = inboxes.get(ws)!
  const buffered = inbox.queue.shift()
  if (buffered) return Promise.resolve(buffered)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), 2000)
    inbox.waiters.push(msg => {
      clearTimeout(timer)
      resolve(msg)
    })
  })
}

/** Pull messages until one of `type` arrives, so unrelated broadcasts cannot desync a test. */
async function nextMessageOfType(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  for (let i = 0; i < 20; i++) {
    const msg = await nextMessage(ws)
    if (msg['type'] === type) return msg
  }
  throw new Error(`never received a "${type}" message`)
}

const PROFILE = { aircraftId: 'f16c' }

/**
 * A join frame shaped the way the real client sends one.
 *
 * The version is not optional in practice: a server that runs for months on a
 * Pi refuses a join it cannot understand rather than accepting it and letting
 * the player fly in a session where nothing lines up.
 */
function joinMsg(profile: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: 'join', profile, protocolVersion: PROTOCOL_VERSION, ...extra }
}

/** Matches DEATH_DEBOUNCE_MS in GameServer, plus slack. */
const DEATH_DEBOUNCE_WINDOW_MS = 3200

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
    a.send(JSON.stringify(joinMsg(PROFILE)))
    const welcomeA = await nextMessage(a)
    expect(welcomeA['type']).toBe('welcome')
    expect(welcomeA['peers']).toEqual([])

    const b = await connect(srv.port)
    b.send(JSON.stringify(joinMsg(PROFILE)))
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
    a.send(JSON.stringify(joinMsg(PROFILE)))
    await nextMessage(a)
    b.send(JSON.stringify(joinMsg(PROFILE)))
    await nextMessage(b)
    await nextMessage(a) // peer-join for b

    b.send(JSON.stringify({ type: 'state', state: { positionNED: 'nope' } }))
    b.send(JSON.stringify({ type: 'state', state: playerState([1, 2, -3000]) }))

    const relayed = await nextMessage(a)
    expect(relayed['type']).toBe('state')
    expect((relayed['state'] as Record<string, unknown>)['positionNED']).toEqual([1, 2, -3000])

    a.close(); b.close()
  })

  it('relays a death to every client and scores it', async () => {
    const srv = await startServer()
    const victim = await connect(srv.port)
    const killer = await connect(srv.port)
    // Opposite sides: a kill claimed against a teammate is refused outright.
    victim.send(JSON.stringify(joinMsg({ ...PROFILE, team: 'RED' })))
    const victimWelcome = await nextMessage(victim)
    expect(victimWelcome['score']).toEqual({ kills: 0, deaths: 0 })
    killer.send(JSON.stringify(joinMsg({ ...PROFILE, team: 'BLUE' })))
    await nextMessage(killer)
    await nextMessage(victim) // peer-join for the killer

    // The killer's id, as the victim's client would learn it from the roster.
    const killerId = ((victimWelcome['playerId'] as string) === 'peer_1') ? 'peer_2' : 'peer_1'

    victim.send(JSON.stringify({ type: 'death', killerId }))

    // Broadcast without exceptPeerId: the victim gets it too, so both clients
    // build the scoreboard from the same stream.
    const [toVictim, toKiller] = await Promise.all([
      nextMessageOfType(victim, 'death'),
      nextMessageOfType(killer, 'death'),
    ])
    for (const msg of [toVictim, toKiller]) {
      expect(msg['type']).toBe('death')
      expect(msg['victimId']).toBe(victimWelcome['playerId'])
      expect(msg['killerId']).toBe(killerId)
      expect(msg['victimScore']).toEqual({ kills: 0, deaths: 1 })
      expect(msg['killerScore']).toEqual({ kills: 1, deaths: 0 })
    }

    victim.close(); killer.close()
  })

  it('refuses self-attributed kills and unknown killers', async () => {
    const srv = await startServer()
    const a = await connect(srv.port)
    const b = await connect(srv.port)
    a.send(JSON.stringify(joinMsg(PROFILE)))
    const welcomeA = await nextMessage(a)
    b.send(JSON.stringify(joinMsg(PROFILE)))
    await nextMessage(b)
    await nextMessage(a)

    // Claiming your own id would let a client farm kills off its own deaths.
    a.send(JSON.stringify({ type: 'death', killerId: welcomeA['playerId'] }))
    const selfDeath = await nextMessageOfType(b, 'death')
    expect(selfDeath['killerId']).toBeNull()
    expect(selfDeath['killerScore']).toBeNull()
    expect(selfDeath['victimScore']).toEqual({ kills: 0, deaths: 1 })

    a.close(); b.close()
  })

  it('debounces repeated death reports from the same peer', async () => {
    const srv = await startServer()
    const a = await connect(srv.port)
    const b = await connect(srv.port)
    a.send(JSON.stringify(joinMsg(PROFILE)))
    await nextMessage(a)
    b.send(JSON.stringify(joinMsg(PROFILE)))
    await nextMessage(b)
    await nextMessage(a)

    // A victim stays past the kill threshold for the whole respawn delay, so a
    // client re-reporting each tick must not inflate the score.
    a.send(JSON.stringify({ type: 'death', killerId: null }))
    a.send(JSON.stringify({ type: 'death', killerId: null }))
    a.send(JSON.stringify({ type: 'death', killerId: null }))

    const first = await nextMessageOfType(b, 'death')
    expect(first['victimScore']).toEqual({ kills: 0, deaths: 1 })
    // The debounce window swallows the other two outright.
    await expect(nextMessageOfType(b, 'death')).rejects.toThrow(/timed out/)

    a.close(); b.close()
  })

  it('refuses a join past maxPeers, and says why before closing', async () => {
    const srv = await startServer({ maxPeers: 1 })
    const a = await connect(srv.port)
    a.send(JSON.stringify(joinMsg(PROFILE)))
    await nextMessage(a)

    // The connection itself is accepted — capacity is decided at join, so a
    // client can be told "full" rather than having the socket refused and
    // being unable to tell a full session from one that is not running.
    const b = await connect(srv.port)
    b.send(JSON.stringify(joinMsg(PROFILE)))
    const rejected = await nextMessageOfType(b, 'join-rejected')
    expect(rejected['reason']).toBe('full')
    const closeCode = await new Promise<number>(resolve => b.once('close', resolve))
    expect(closeCode).toBe(1013)

    a.close()
  })

  it('answers a query without joining, and without taking a player slot', async () => {
    const srv = await startServer({ maxPeers: 1, name: 'Alpha', description: 'test box' })
    const player = await connect(srv.port)
    player.send(JSON.stringify(joinMsg(PROFILE)))
    await nextMessage(player)

    const probe = await connect(srv.port)
    probe.send(JSON.stringify({ type: 'query' }))
    const reply = await nextMessageOfType(probe, 'server-info')
    const info = reply['info'] as Record<string, unknown>
    expect(info['name']).toBe('Alpha')
    expect(info['description']).toBe('test box')
    expect(info['players']).toBe(1)
    expect(info['maxPlayers']).toBe(1)
    expect(info['requiresPassword']).toBe(false)
    expect(info['protocolVersion']).toBe(PROTOCOL_VERSION)
    await new Promise<number>(resolve => probe.once('close', resolve))

    // The probe never counted as a player, so the seat is still the joiner's.
    expect(srv.playerCount()).toBe(1)
    player.close()
  })

  it('reports a full session to a probe rather than refusing the connection', async () => {
    const srv = await startServer({ maxPeers: 1 })
    const player = await connect(srv.port)
    player.send(JSON.stringify(joinMsg(PROFILE)))
    await nextMessage(player)

    const probe = await connect(srv.port)
    probe.send(JSON.stringify({ type: 'query' }))
    const info = (await nextMessageOfType(probe, 'server-info'))['info'] as Record<string, unknown>
    expect(info['players']).toBe(1)
    expect(info['maxPlayers']).toBe(1)

    player.close()
  })

  it('never reveals the password, only that one is needed', async () => {
    const srv = await startServer({ password: 'hunter2' })
    const probe = await connect(srv.port)
    probe.send(JSON.stringify({ type: 'query' }))
    const reply = await nextMessageOfType(probe, 'server-info')
    expect((reply['info'] as Record<string, unknown>)['requiresPassword']).toBe(true)
    expect(JSON.stringify(reply)).not.toContain('hunter2')
  })

  it('refuses a wrong password and admits the right one', async () => {
    const srv = await startServer({ password: 'hunter2' })

    const wrong = await connect(srv.port)
    wrong.send(JSON.stringify(joinMsg(PROFILE, { password: 'nope' })))
    expect((await nextMessageOfType(wrong, 'join-rejected'))['reason']).toBe('bad-password')
    expect(await new Promise<number>(resolve => wrong.once('close', resolve))).toBe(4003)

    // A missing password is refused the same way as a wrong one.
    const absent = await connect(srv.port)
    absent.send(JSON.stringify(joinMsg(PROFILE)))
    expect((await nextMessageOfType(absent, 'join-rejected'))['reason']).toBe('bad-password')

    const right = await connect(srv.port)
    right.send(JSON.stringify(joinMsg(PROFILE, { password: 'hunter2' })))
    expect((await nextMessageOfType(right, 'welcome'))['playerId']).toBeTruthy()
    right.close()
  })

  it('refuses a build whose protocol it does not speak', async () => {
    const srv = await startServer()

    const stale = await connect(srv.port)
    // A client predating the field sends no version at all.
    stale.send(JSON.stringify({ type: 'join', profile: PROFILE }))
    expect((await nextMessageOfType(stale, 'join-rejected'))['reason']).toBe('version')
    expect(await new Promise<number>(resolve => stale.once('close', resolve))).toBe(4004)

    const future = await connect(srv.port)
    future.send(JSON.stringify(joinMsg(PROFILE, { protocolVersion: PROTOCOL_VERSION + 1 })))
    expect((await nextMessageOfType(future, 'join-rejected'))['reason']).toBe('version')
  })

  it('closes a socket that connects and never joins', async () => {
    const srv = await startServer({ handshakeTimeoutMs: 150 })
    const idle = await connect(srv.port)
    const closeCode = await new Promise<number>(resolve => idle.once('close', resolve))
    expect(closeCode).toBe(1002)
    expect(srv.playerCount()).toBe(0)
  })
})

/**
 * Match rules live on the server so a match ends at the same instant for
 * everyone. Each client evaluating its own win condition is exactly the bug the
 * single-player scenarios have in a LAN session, where every client fights a
 * private copy of the world and reaches its own verdict.
 */
describe('GameServer match', () => {
  const BLUE = { aircraftId: 'f16c', team: 'BLUE' as const }
  const RED = { aircraftId: 'mig29', team: 'RED' as const }

  /** Join two peers on opposite sides; returns [host, other] with their ids. */
  async function twoSides(port: number): Promise<{
    host: WebSocket; other: WebSocket; hostId: string; otherId: string
  }> {
    const host = await connect(port)
    host.send(JSON.stringify(joinMsg(BLUE)))
    const welcomeHost = await nextMessageOfType(host, 'welcome')
    const other = await connect(port)
    other.send(JSON.stringify(joinMsg(RED)))
    const welcomeOther = await nextMessageOfType(other, 'welcome')
    return {
      host,
      other,
      hostId: welcomeHost['playerId'] as string,
      otherId: welcomeOther['playerId'] as string,
    }
  }

  it('names the first joined peer as host and ships the rules in the welcome', async () => {
    const srv = await startServer()
    const a = await connect(srv.port)
    a.send(JSON.stringify(joinMsg(BLUE)))
    const welcome = await nextMessageOfType(a, 'welcome')

    expect(welcome['hostId']).toBe(welcome['playerId'])
    expect(welcome['config']).toEqual({ mode: 'TDM', scoreLimit: 25, timeLimitSec: 720 })
    expect(welcome['match']).toMatchObject({ phase: 'LOBBY', winner: null })

    a.close()
  })

  it('takes config only from the host', async () => {
    const srv = await startServer()
    const { host, other } = await twoSides(srv.port)

    // A non-host asking for a two-kill match must be ignored outright.
    other.send(JSON.stringify({
      type: 'set-match-config',
      config: { mode: 'TDM', scoreLimit: 2, timeLimitSec: 60 },
    }))
    host.send(JSON.stringify({
      type: 'set-match-config',
      config: { mode: 'TDM', scoreLimit: 7, timeLimitSec: 60 },
    }))

    const applied = await nextMessageOfType(other, 'match-config')
    expect((applied['config'] as Record<string, unknown>)['scoreLimit']).toBe(7)

    host.close(); other.close()
  })

  it('rejects a malformed config', async () => {
    const srv = await startServer()
    const { host, other } = await twoSides(srv.port)

    host.send(JSON.stringify({ type: 'set-match-config', config: { mode: 'SIEGE', scoreLimit: 5, timeLimitSec: 60 } }))
    host.send(JSON.stringify({ type: 'set-match-config', config: { mode: 'TDM', scoreLimit: -1, timeLimitSec: 60 } }))
    host.send(JSON.stringify({ type: 'set-match-config', config: { mode: 'TDM', scoreLimit: 9, timeLimitSec: 60 } }))

    const applied = await nextMessageOfType(other, 'match-config')
    expect((applied['config'] as Record<string, unknown>)['scoreLimit']).toBe(9)

    host.close(); other.close()
  })

  it('goes LIVE for everyone when the host starts', async () => {
    const srv = await startServer()
    const { host, other } = await twoSides(srv.port)

    host.send(JSON.stringify({ type: 'start-match' }))
    const [toHost, toOther] = await Promise.all([
      nextMessageOfType(host, 'match-state'),
      nextMessageOfType(other, 'match-state'),
    ])
    for (const msg of [toHost, toOther]) {
      expect((msg['match'] as Record<string, unknown>)['phase']).toBe('LIVE')
    }

    host.close(); other.close()
  })

  it('ignores start-match from a non-host', async () => {
    const srv = await startServer()
    const { host, other } = await twoSides(srv.port)

    other.send(JSON.stringify({ type: 'start-match' }))
    await expect(nextMessageOfType(host, 'match-state')).rejects.toThrow(/timed out/)

    host.close(); other.close()
  })

  it('accumulates team score and ends the match on the score limit', async () => {
    const srv = await startServer()
    const { host, other, hostId } = await twoSides(srv.port)

    host.send(JSON.stringify({ type: 'set-match-config', config: { mode: 'TDM', scoreLimit: 1, timeLimitSec: 0 } }))
    await nextMessageOfType(other, 'match-config')
    host.send(JSON.stringify({ type: 'start-match' }))
    await nextMessageOfType(other, 'match-state')

    // The RED pilot reports being shot down by the BLUE host.
    other.send(JSON.stringify({ type: 'death', killerId: hostId }))

    // One kill hits the limit, so the very next state both clients see is ENDED.
    const ended = await nextMessageOfType(other, 'match-state').then(async m => {
      let msg = m
      while ((msg['match'] as Record<string, unknown>)['phase'] !== 'ENDED') {
        msg = await nextMessageOfType(other, 'match-state')
      }
      return msg
    })
    const state = ended['match'] as Record<string, unknown>
    expect(state['winner']).toBe('BLUE')
    expect(state['teamScores']).toEqual({ BLUE: 1, RED: 0 })

    host.close(); other.close()
  })

  it('ends on the time limit with whoever leads', async () => {
    const srv = await startServer()
    const { host, other, hostId } = await twoSides(srv.port)

    // A score limit high enough that only the clock can end this.
    host.send(JSON.stringify({ type: 'set-match-config', config: { mode: 'TDM', scoreLimit: 99, timeLimitSec: 1 } }))
    await nextMessageOfType(other, 'match-config')
    host.send(JSON.stringify({ type: 'start-match' }))
    await nextMessageOfType(other, 'match-state')

    other.send(JSON.stringify({ type: 'death', killerId: hostId }))

    let msg = await nextMessageOfType(other, 'match-state')
    while ((msg['match'] as Record<string, unknown>)['phase'] !== 'ENDED') {
      msg = await nextMessageOfType(other, 'match-state')
    }
    expect((msg['match'] as Record<string, unknown>)['winner']).toBe('BLUE')

    host.close(); other.close()
  })

  it('resets scores and returns to the lobby on rematch', async () => {
    const srv = await startServer()
    const { host, other, hostId } = await twoSides(srv.port)

    host.send(JSON.stringify({ type: 'set-match-config', config: { mode: 'TDM', scoreLimit: 1, timeLimitSec: 0 } }))
    await nextMessageOfType(other, 'match-config')
    host.send(JSON.stringify({ type: 'start-match' }))
    await nextMessageOfType(other, 'match-state')
    other.send(JSON.stringify({ type: 'death', killerId: hostId }))

    let msg = await nextMessageOfType(other, 'match-state')
    while ((msg['match'] as Record<string, unknown>)['phase'] !== 'ENDED') {
      msg = await nextMessageOfType(other, 'match-state')
    }

    host.send(JSON.stringify({ type: 'request-rematch' }))
    msg = await nextMessageOfType(other, 'match-state')
    while ((msg['match'] as Record<string, unknown>)['phase'] !== 'LOBBY') {
      msg = await nextMessageOfType(other, 'match-state')
    }
    const state = msg['match'] as Record<string, unknown>
    expect(state['teamScores']).toEqual({ BLUE: 0, RED: 0 })
    expect(state['winner']).toBeNull()

    host.close(); other.close()
  })

  it('refuses to credit a kill claimed against a teammate', async () => {
    // Deaths are client-authoritative. Without a same-side check a client could
    // hand its own team a free point just by claiming its wingman shot it down.
    const srv = await startServer()
    const host = await connect(srv.port)
    host.send(JSON.stringify(joinMsg(BLUE)))
    const welcomeHost = await nextMessageOfType(host, 'welcome')
    const ally = await connect(srv.port)
    ally.send(JSON.stringify(joinMsg(BLUE)))
    await nextMessageOfType(ally, 'welcome')

    host.send(JSON.stringify({ type: 'set-match-config', config: { mode: 'TDM', scoreLimit: 5, timeLimitSec: 0 } }))
    await nextMessageOfType(ally, 'match-config')
    host.send(JSON.stringify({ type: 'start-match' }))
    await nextMessageOfType(ally, 'match-state')

    ally.send(JSON.stringify({ type: 'death', killerId: welcomeHost['playerId'] }))

    // The death is real — it still counts against the victim — but it has no
    // killer, so no team score moves and no match-state broadcast follows.
    const death = await nextMessageOfType(ally, 'death')
    expect(death['killerId']).toBeNull()
    expect(death['killerScore']).toBeNull()
    expect(death['victimScore']).toEqual({ kills: 0, deaths: 1 })
    await expect(nextMessageOfType(ally, 'match-state')).rejects.toThrow(/timed out/)

    host.close(); ally.close()
  })

  it('stops scoring once the match has ended', async () => {
    const srv = await startServer()
    const { host, other, hostId } = await twoSides(srv.port)

    host.send(JSON.stringify({ type: 'set-match-config', config: { mode: 'TDM', scoreLimit: 1, timeLimitSec: 0 } }))
    await nextMessageOfType(other, 'match-config')
    host.send(JSON.stringify({ type: 'start-match' }))
    await nextMessageOfType(other, 'match-state')

    other.send(JSON.stringify({ type: 'death', killerId: hostId }))
    let msg = await nextMessageOfType(other, 'match-state')
    while ((msg['match'] as Record<string, unknown>)['phase'] !== 'ENDED') {
      msg = await nextMessageOfType(other, 'match-state')
    }

    // A late kill after the buzzer must not move the personal tallies either,
    // or the end-of-match board disagrees with the score that won it.
    await new Promise(resolve => setTimeout(resolve, DEATH_DEBOUNCE_WINDOW_MS))
    other.send(JSON.stringify({ type: 'death', killerId: hostId }))
    const lateDeath = await nextMessageOfType(other, 'death')
    expect(lateDeath['killerScore']).toEqual({ kills: 1, deaths: 0 })
    expect(lateDeath['victimScore']).toEqual({ kills: 0, deaths: 1 })

    host.close(); other.close()
  })

  it('promotes a new host when the current one leaves', async () => {
    const srv = await startServer()
    const { host, other, otherId } = await twoSides(srv.port)

    host.close()
    const changed = await nextMessageOfType(other, 'host-changed')
    expect(changed['hostId']).toBe(otherId)

    // And the new host's rules are now taken.
    other.send(JSON.stringify({ type: 'set-match-config', config: { mode: 'TDM', scoreLimit: 3, timeLimitSec: 0 } }))
    const applied = await nextMessageOfType(other, 'match-config')
    expect((applied['config'] as Record<string, unknown>)['scoreLimit']).toBe(3)

    other.close()
  })
})
