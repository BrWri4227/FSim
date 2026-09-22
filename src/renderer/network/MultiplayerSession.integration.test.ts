/**
 * End-to-end session test: real `MultiplayerClient` instances against a real
 * `GameServer` over real WebSockets.
 *
 * `MultiplayerClient.test.ts` covers the *send* path against a mocked socket
 * (throttling, URL resolution). Nothing covered the *receive* path — welcome
 * parsing, roster upkeep, score tracking, death events, peer departure — which
 * is precisely the plumbing a LAN session depends on. This is the automatable
 * half of the Stage 5 two-client rehearsal; the half that needs eyeballs
 * (interpolation smoothness, kill-feed legibility) still needs two humans.
 *
 * Node 18+ exposes a global `WebSocket`, which is what the renderer client uses,
 * so the exact production code path runs here unmodified.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createGameServer, type GameServer } from '../../server/GameServer'
import { MultiplayerClient } from './MultiplayerClient'
import type { NetAIEntity, NetPlayerState, Team } from './MultiplayerTypes'

const servers: GameServer[] = []
const clients: MultiplayerClient[] = []

afterEach(async () => {
  while (clients.length) clients.pop()!.disconnect()
  while (servers.length) await servers.pop()!.close()
})

async function startServer(): Promise<GameServer> {
  const srv = await createGameServer({ port: 0, heartbeatIntervalMs: 60_000 })
  servers.push(srv)
  return srv
}

async function joinClient(
  port: number,
  callsign: string,
  aircraftId = 'f16c',
  team: Team = 'BLUE',
): Promise<MultiplayerClient> {
  const client = new MultiplayerClient({ aircraftId, callsign, team })
  clients.push(client)
  await client.connect({ mode: 'join', host: '127.0.0.1', port })
  await waitFor(() => client.getLocalPlayerId() !== null, `${callsign} never received a welcome`)
  return client
}

/** Poll until `predicate` holds. Network delivery is async; there is nothing to await on. */
async function waitFor(predicate: () => boolean, message: string, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise(r => setTimeout(r, 10))
  }
  throw new Error(`timed out: ${message}`)
}

function playerState(pos: [number, number, number]): NetPlayerState {
  return {
    positionNED: pos,
    velocityNED: [200, 0, 0],
    attitudeQuat: [1, 0, 0, 0],
    throttle: 0.6,
    ejected: false,
    structuralFailure: false,
    radar: { mode: 'RWS', sttTargetId: null },
    missiles: [],
    countermeasures: null,
  }
}

/** Force an immediate send regardless of the 20 Hz throttle. */
function pushState(client: MultiplayerClient, pos: [number, number, number]): void {
  client.queueState(playerState(pos))
  client.flushStateSend(1)
}

describe('multiplayer session (client ↔ server, end to end)', () => {
  it('lets two players see each other by callsign', async () => {
    const srv = await startServer()
    const alice = await joinClient(srv.port, 'Alice')
    const bob = await joinClient(srv.port, 'Bob')

    await waitFor(() => alice.getRemoteSnapshots().length === 1, 'Alice never saw Bob')
    await waitFor(() => bob.getRemoteSnapshots().length === 1, 'Bob never saw Alice')

    expect(alice.getRemoteSnapshots()[0]!.profile.callsign).toBe('Bob')
    expect(bob.getRemoteSnapshots()[0]!.profile.callsign).toBe('Alice')
    expect(alice.getLocalPlayerId()).not.toBe(bob.getLocalPlayerId())
  })

  it('relays flight state to the other player', async () => {
    const srv = await startServer()
    const alice = await joinClient(srv.port, 'Alice')
    const bob = await joinClient(srv.port, 'Bob')
    await waitFor(() => bob.getRemoteSnapshots().length === 1, 'Bob never saw Alice')

    pushState(alice, [1234, -567, -5000])

    await waitFor(
      () => bob.getRemoteSnapshots()[0]?.state?.positionNED[0] === 1234,
      'Alice position never reached Bob',
    )
    const seen = bob.getRemoteSnapshots()[0]!.state!
    expect(seen.positionNED).toEqual([1234, -567, -5000])
    expect(seen.radar.mode).toBe('RWS')
  })

  it('delivers a hit only to the player it targets', async () => {
    const srv = await startServer()
    const alice = await joinClient(srv.port, 'Alice', 'f16c', 'BLUE')
    const bob = await joinClient(srv.port, 'Bob', 'f16c', 'RED')
    await waitFor(() => alice.getRemoteSnapshots().length === 1, 'Alice never saw Bob')

    // Both must have known state for the server's plausibility check to pass.
    pushState(alice, [0, 0, -5000])
    pushState(bob, [400, 0, -5000])
    await waitFor(() => bob.getRemoteSnapshots()[0]?.state !== null, 'state never propagated')

    alice.sendHit({
      sourceId: alice.getLocalPlayerId()!,
      targetId: bob.getLocalPlayerId()!,
      zone: 'FUSELAGE',
      severity: 0.4,
      weapon: 'GUN',
    })

    let received: ReturnType<MultiplayerClient['consumeInboundHits']> = []
    await waitFor(() => {
      received = bob.consumeInboundHits()
      return received.length === 1
    }, 'Bob never received the hit')

    expect(received[0]!.zone).toBe('FUSELAGE')
    expect(received[0]!.sourceId).toBe(alice.getLocalPlayerId())
    expect(alice.consumeInboundHits()).toHaveLength(0)
  })

  it('drops a hit between two players on the same side', async () => {
    // An honest client cannot even lock a teammate — [EntityManager.getHostiles]
    // filters them out before the gun or the missile system ever sees them.
    // This is the server refusing to take a modified client's word for it.
    const srv = await startServer()
    const alice = await joinClient(srv.port, 'Alice', 'f16c', 'BLUE')
    const ally = await joinClient(srv.port, 'Ally', 'f16c', 'BLUE')
    await waitFor(() => alice.getRemoteSnapshots().length === 1, 'Alice never saw Ally')

    pushState(alice, [0, 0, -5000])
    pushState(ally, [400, 0, -5000])
    await waitFor(() => ally.getRemoteSnapshots()[0]?.state !== null, 'state never propagated')

    alice.sendHit({
      sourceId: alice.getLocalPlayerId()!,
      targetId: ally.getLocalPlayerId()!,
      zone: 'FUSELAGE',
      severity: 0.4,
      weapon: 'GUN',
    })

    // Nothing to await on for a message that must never arrive, so give the
    // relay the same window the positive case needs and confirm it stayed empty.
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(ally.consumeInboundHits()).toHaveLength(0)
  })

  it('scores a kill on both clients from the victim report', async () => {
    const srv = await startServer()
    // Opposite sides — a kill claimed against a teammate is refused outright.
    const alice = await joinClient(srv.port, 'Alice', 'f16c', 'BLUE')
    const bob = await joinClient(srv.port, 'Bob', 'f16c', 'RED')
    await waitFor(() => alice.getRemoteSnapshots().length === 1, 'Alice never saw Bob')

    const aliceId = alice.getLocalPlayerId()!
    const bobId = bob.getLocalPlayerId()!

    // Damage is client-authoritative: only the victim reports the death.
    bob.sendDeath(aliceId)

    await waitFor(() => alice.getScore(aliceId).kills === 1, "Alice's kill never scored")
    await waitFor(() => bob.getScore(bobId).deaths === 1, "Bob's death never scored")

    // Both clients must agree — the server is the authority for standings.
    expect(alice.getScore(bobId).deaths).toBe(1)
    expect(bob.getScore(aliceId).kills).toBe(1)

    const deaths = alice.consumeInboundDeaths()
    expect(deaths).toHaveLength(1)
    expect(deaths[0]!.victimId).toBe(bobId)
    expect(deaths[0]!.killerId).toBe(aliceId)
  })

  it('gives a late joiner the standings that already happened', async () => {
    const srv = await startServer()
    const alice = await joinClient(srv.port, 'Alice', 'f16c', 'BLUE')
    const bob = await joinClient(srv.port, 'Bob', 'f16c', 'RED')
    await waitFor(() => alice.getRemoteSnapshots().length === 1, 'Alice never saw Bob')

    const aliceId = alice.getLocalPlayerId()!
    bob.sendDeath(aliceId)
    await waitFor(() => alice.getScore(aliceId).kills === 1, 'kill never scored')

    const carol = await joinClient(srv.port, 'Carol')
    await waitFor(() => carol.getRemoteSnapshots().length === 2, 'Carol never saw the others')

    // This is the whole point of keeping counters server-side rather than
    // tallying observed events per client.
    expect(carol.getScore(aliceId).kills).toBe(1)
    expect(carol.getScore(bob.getLocalPlayerId()!).deaths).toBe(1)
    expect(carol.getScore(carol.getLocalPlayerId()!)).toEqual({ kills: 0, deaths: 0 })
  })

  it('drops a departed player from the roster', async () => {
    const srv = await startServer()
    const alice = await joinClient(srv.port, 'Alice')
    const bob = await joinClient(srv.port, 'Bob')
    await waitFor(() => alice.getRemoteSnapshots().length === 1, 'Alice never saw Bob')

    bob.disconnect()

    await waitFor(() => alice.getRemoteSnapshots().length === 0, 'Bob never left the roster')
  })

  /**
   * The whole concurrent-session model: several sessions on one box are several
   * server processes on several ports. Nothing routes between them, and this is
   * the test that says so.
   */
  it('keeps two sessions on two ports completely separate', async () => {
    const alphaSrv = await startServer()
    const bravoSrv = await startServer()
    expect(alphaSrv.port).not.toBe(bravoSrv.port)

    const alice = await joinClient(alphaSrv.port, 'Alice', 'f16c', 'BLUE')
    const bob = await joinClient(alphaSrv.port, 'Bob', 'mig29', 'RED')
    const carol = await joinClient(bravoSrv.port, 'Carol')

    await waitFor(() => alice.getRemoteSnapshots().length === 1, 'Alice never saw Bob')

    // Carol is alone on her port, and neither side sees the other.
    expect(carol.getRemoteSnapshots()).toHaveLength(0)
    expect(alice.getRemoteSnapshots().map(p => p.profile.callsign)).toEqual(['Bob'])
    expect(alphaSrv.playerCount()).toBe(2)
    expect(bravoSrv.playerCount()).toBe(1)

    // Flight state does not leak across the port boundary.
    pushState(alice, [4321, 0, -6000])
    await waitFor(
      () => bob.getRemoteSnapshots()[0]?.state?.positionNED[0] === 4321,
      'Alice position never reached Bob',
    )
    expect(carol.getRemoteSnapshots()).toHaveLength(0)

    // Nor do scores: a kill on Alpha leaves Bravo's standings untouched.
    pushState(bob, [4321, 60, -6000])
    await waitFor(() => alice.getRemoteSnapshots()[0]?.state !== null, 'Bob never sent state')
    bob.sendDeath(alice.getLocalPlayerId())
    await waitFor(
      () => alice.getScore(alice.getLocalPlayerId()!).kills === 1,
      'Alice was never credited on Alpha',
    )
    expect(carol.getScore(carol.getLocalPlayerId()!)).toEqual({ kills: 0, deaths: 0 })

    // And each still identifies itself independently.
    await waitFor(() => carol.getRemoteSnapshots().length === 0, 'Bravo should still be empty')
  })

  it('refuses a join with the wrong password and admits the right one', async () => {
    const srv = await createGameServer({ port: 0, heartbeatIntervalMs: 60_000, password: 'hunter2' })
    servers.push(srv)

    const wrong = new MultiplayerClient({ aircraftId: 'f16c', callsign: 'Nope' })
    clients.push(wrong)
    await expect(
      wrong.connect({ mode: 'join', host: '127.0.0.1', port: srv.port }, 'guess'),
    ).rejects.toMatchObject({ reason: 'bad-password' })

    const right = new MultiplayerClient({ aircraftId: 'f16c', callsign: 'Yep' })
    clients.push(right)
    await right.connect({ mode: 'join', host: '127.0.0.1', port: srv.port }, 'hunter2')
    expect(right.getLocalPlayerId()).not.toBeNull()
  })

  it('measures round-trip time against the server', async () => {
    const srv = await startServer()
    const alice = await joinClient(srv.port, 'Alice')

    expect(alice.getRttMs()).toBeNull()
    await waitFor(() => alice.getRttMs() !== null, 'no pong ever came back', 4000)
    // Loopback, so this is small — but it must be a real, sane measurement.
    expect(alice.getRttMs()!).toBeGreaterThanOrEqual(0)
    expect(alice.getRttMs()!).toBeLessThan(2000)
  })

  it('tells the player when the session goes away underneath them', async () => {
    const srv = await createGameServer({ port: 0, heartbeatIntervalMs: 60_000 })
    const alice = new MultiplayerClient({ aircraftId: 'f16c', callsign: 'Alice' })
    clients.push(alice)
    await alice.connect({ mode: 'join', host: '127.0.0.1', port: srv.port })

    const drops: string[] = []
    alice.onDisconnected(info => drops.push(info.message))

    // The server stopping is the case that used to look, from the cockpit,
    // like everyone quietly leaving at once.
    await srv.close()

    await waitFor(() => drops.length === 1, 'the drop was never reported')
    expect(drops[0]!.length).toBeGreaterThan(0)
    expect(alice.isConnected()).toBe(false)
  })

  it('does not report a disconnect the player asked for', async () => {
    const srv = await startServer()
    const alice = await joinClient(srv.port, 'Alice')

    let reported = 0
    alice.onDisconnected(() => reported++)
    alice.disconnect()

    await new Promise(r => setTimeout(r, 150))
    expect(reported).toBe(0)
  })

  /**
   * AI replication. The host simulates, everyone else receives — which is what
   * lets a session be something other than Dogfight. Each client used to run an
   * unreplicated copy from the same descriptor and diverge within seconds.
   */
  describe('host-simulated AI', () => {
    function aiEntity(id: string, team: Team, pos: [number, number, number]): NetAIEntity {
      return { id, aircraftId: 'mig29', team, label: 'Bandit', state: playerState(pos) }
    }

    it('reaches the other players, and nobody else can send it', async () => {
      const srv = await startServer()
      const host = await joinClient(srv.port, 'Host', 'f16c', 'BLUE')
      const guest = await joinClient(srv.port, 'Guest', 'mig29', 'RED')
      await waitFor(() => host.isHost(), 'the first joiner should own the session')

      host.sendAIState([aiEntity('ai_1', 'RED', [500, 0, -6000])])
      await waitFor(() => guest.getRemoteAI().length === 1, 'AI never reached the guest')

      const seen = guest.getRemoteAI()[0]!
      expect(seen.label).toBe('Bandit')
      expect(seen.team).toBe('RED')
      expect(seen.state.positionNED[0]).toBe(500)
      // The host holds the real aircraft and never renders replicas of its own.
      expect(host.getRemoteAI()).toHaveLength(0)

      // A guest claiming to run AI would be spawning aircraft on every screen.
      guest.sendAIState([aiEntity('ai_evil', 'BLUE', [0, 0, -6000])])
      await new Promise(r => setTimeout(r, 150))
      expect(host.getRemoteAI()).toHaveLength(0)
    })

    it('despawns an AI the host stops sending', async () => {
      const srv = await startServer()
      const host = await joinClient(srv.port, 'Host', 'f16c', 'BLUE')
      const guest = await joinClient(srv.port, 'Guest', 'mig29', 'RED')

      host.sendAIState([aiEntity('ai_1', 'RED', [0, 0, -6000]), aiEntity('ai_2', 'RED', [0, 100, -6000])])
      await waitFor(() => guest.getRemoteAI().length === 2, 'both AI never arrived')

      // The frame is the whole live set, so an absent entity is a despawn.
      host.sendAIState([aiEntity('ai_2', 'RED', [0, 100, -6000])])
      await waitFor(() => guest.getRemoteAI().length === 1, 'the dead AI never went away')
      expect(guest.getRemoteAI()[0]!.id).toBe('ai_2')
    })

    it('credits an AI kill to the player who shot it', async () => {
      const srv = await startServer()
      const host = await joinClient(srv.port, 'Host', 'f16c', 'BLUE')
      const guest = await joinClient(srv.port, 'Guest', 'mig29', 'RED')

      host.sendAIState([aiEntity('ai_1', 'BLUE', [0, 0, -6000])])
      await waitFor(() => guest.getRemoteAI().length === 1, 'AI never reached the guest')

      const guestId = guest.getLocalPlayerId()!
      host.sendAIDeath('ai_1', guestId)

      await waitFor(() => guest.getScore(guestId).kills === 1, 'the AI kill was never credited')
      expect(guest.consumeInboundAIDeaths().map(d => d.aiId)).toEqual(['ai_1'])
      // Its own destruction is not a death against the player who shot it.
      expect(guest.getScore(guestId).deaths).toBe(0)
    })

    it('clears the AI when the host leaves', async () => {
      const srv = await startServer()
      const host = await joinClient(srv.port, 'Host', 'f16c', 'BLUE')
      const guest = await joinClient(srv.port, 'Guest', 'mig29', 'RED')

      host.sendAIState([aiEntity('ai_1', 'RED', [0, 0, -6000])])
      await waitFor(() => guest.getRemoteAI().length === 1, 'AI never reached the guest')

      // Those aircraft lived in the host's process; a new host never ran them.
      host.disconnect()
      await waitFor(() => guest.getRemoteAI().length === 0, 'orphaned AI was left behind')
      await waitFor(() => guest.isHost(), 'the guest should have been promoted')
    })
  })

  it('propagates a callsign change mid-session', async () => {
    const srv = await startServer()
    const alice = await joinClient(srv.port, 'Alice')
    const bob = await joinClient(srv.port, 'Bob')
    await waitFor(() => bob.getRemoteSnapshots().length === 1, 'Bob never saw Alice')

    alice.updateProfile({ callsign: 'Maverick' })

    await waitFor(
      () => bob.getRemoteSnapshots()[0]?.profile.callsign === 'Maverick',
      'callsign change never reached Bob',
    )
  })
})
