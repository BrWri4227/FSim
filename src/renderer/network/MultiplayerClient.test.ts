import { describe, expect, it, vi } from 'vitest'
import { MultiplayerClient, resolveSessionUrl } from './MultiplayerClient'
import type { NetMissileState, NetPlayerState } from './MultiplayerTypes'

function mkMissile(id: string): NetMissileState {
  return { id, positionNED: [0, 0, -5000], velocityNED: [800, 0, 0], targetEntityId: 'peer_2', active: true }
}

const STATE_SEND_INTERVAL_SEC = 1 / 20

function makePlayerState(overrides: Partial<NetPlayerState> = {}): NetPlayerState {
  return {
    positionNED: [0, 0, -5000],
    velocityNED: [200, 0, 0],
    attitudeQuat: [1, 0, 0, 0],
    throttle: 0.7,
    ejected: false,
    structuralFailure: false,
    radar: { mode: 'OFF', sttTargetId: null },
    missiles: [],
    countermeasures: { flares: [], chaffClouds: [] },
    ...overrides,
  }
}

interface SentMessage {
  type: string
  state?: NetPlayerState
}

type ClientInternals = {
  ws: { readyState: number; send: (data: string) => void }
  connected: boolean
  lastSentRadarMode: string | null
  stateSendAccumSec: number
}

function wireConnectedClient(
  profile = { aircraftId: 'f16c' },
  opts: { primedRadarMode?: string | null } = {},
): { client: MultiplayerClient; sent: SentMessage[]; internals: ClientInternals } {
  const client = new MultiplayerClient(profile)
  const sent: SentMessage[] = []
  const fakeWs = {
    readyState: 1,
    send: (data: string) => { sent.push(JSON.parse(data) as SentMessage) },
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const internals = client as unknown as ClientInternals
  internals.ws = fakeWs
  internals.connected = true
  if (opts.primedRadarMode !== undefined) {
    internals.lastSentRadarMode = opts.primedRadarMode
  }
  return { client, sent, internals }
}

describe('MultiplayerClient state throttling', () => {
  it('does not send until the 20 Hz interval elapses', () => {
    const { client, sent } = wireConnectedClient(undefined, { primedRadarMode: 'OFF' })
    client.queueState(makePlayerState())

    client.flushStateSend(STATE_SEND_INTERVAL_SEC * 0.5)
    expect(sent).toHaveLength(0)

    client.flushStateSend(STATE_SEND_INTERVAL_SEC * 0.5)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.type).toBe('state')
  })

  it('sends immediately on ejected or structural failure', () => {
    for (const flag of ['ejected', 'structuralFailure'] as const) {
      const { client, sent } = wireConnectedClient(undefined, { primedRadarMode: 'OFF' })
      client.queueState(makePlayerState({ [flag]: true }))
      client.flushStateSend(0.001)
      expect(sent).toHaveLength(1)
      expect(sent[0]?.state?.[flag]).toBe(true)
    }
  })

  it('sends immediately when radar mode changes', () => {
    const { client, sent } = wireConnectedClient(undefined, { primedRadarMode: 'OFF' })
    client.queueState(makePlayerState({ radar: { mode: 'RWS', sttTargetId: null } }))
    client.flushStateSend(0.001)
    expect(sent).toHaveLength(1)

    client.queueState(makePlayerState({ radar: { mode: 'RWS', sttTargetId: null } }))
    client.flushStateSend(STATE_SEND_INTERVAL_SEC * 0.5)
    expect(sent).toHaveLength(1)

    client.queueState(makePlayerState({ radar: { mode: 'STT', sttTargetId: 't1' } }))
    client.flushStateSend(0.001)
    expect(sent).toHaveLength(2)
    expect(sent[1]?.state?.radar.mode).toBe('STT')
  })

  it('sends immediately when the missile set changes', () => {
    const { client, sent } = wireConnectedClient(undefined, { primedRadarMode: 'OFF' })

    client.queueState(makePlayerState({ missiles: [mkMissile('m1')] }))
    client.flushStateSend(0.001)
    expect(sent).toHaveLength(1)

    // Unchanged set, interval not elapsed → no send.
    client.queueState(makePlayerState({ missiles: [mkMissile('m1')] }))
    client.flushStateSend(0.001)
    expect(sent).toHaveLength(1)

    // Missile left the set (impact / timeout) → eager send.
    client.queueState(makePlayerState({ missiles: [] }))
    client.flushStateSend(0.001)
    expect(sent).toHaveLength(2)
  })

  it('omits the countermeasure payload until the flare/chaff set changes', () => {
    const { client, sent } = wireConnectedClient(undefined, { primedRadarMode: 'OFF' })
    const flare = { positionNED: [0, 0, -5000] as [number, number, number], velocityNED: [0, 0, 1] as [number, number, number], heatSignatureKW: 60, ageSec: 0 }

    client.queueState(makePlayerState())
    client.flushStateSend(STATE_SEND_INTERVAL_SEC)
    expect(sent[0]?.state?.countermeasures).toBeNull()

    client.queueState(makePlayerState({ countermeasures: { flares: [flare], chaffClouds: [] } }))
    client.flushStateSend(STATE_SEND_INTERVAL_SEC)
    expect(sent[1]?.state?.countermeasures?.flares).toHaveLength(1)

    client.queueState(makePlayerState({ countermeasures: { flares: [{ ...flare, ageSec: 0.05 }], chaffClouds: [] } }))
    client.flushStateSend(STATE_SEND_INTERVAL_SEC)
    expect(sent[2]?.state?.countermeasures).toBeNull()
  })

  it('resets throttle accumulator after a send', () => {
    const { client, sent } = wireConnectedClient(undefined, { primedRadarMode: 'OFF' })
    client.queueState(makePlayerState())

    client.flushStateSend(STATE_SEND_INTERVAL_SEC)
    expect(sent).toHaveLength(1)

    client.flushStateSend(STATE_SEND_INTERVAL_SEC * 0.5)
    expect(sent).toHaveLength(1)

    client.flushStateSend(STATE_SEND_INTERVAL_SEC * 0.5)
    expect(sent).toHaveLength(2)
  })
})

describe('resolveSessionUrl', () => {
  it('adds ws:// and the port to a bare host', () => {
    expect(resolveSessionUrl('192.168.1.25', 8080)).toBe('ws://192.168.1.25:8080')
  })

  it('keeps an explicit host:port and does not append the default port', () => {
    expect(resolveSessionUrl('play.example.com:9000', 8080)).toBe('ws://play.example.com:9000')
  })

  it('passes through an explicit ws:// or wss:// URL', () => {
    expect(resolveSessionUrl('wss://play.example.com', 8080)).toBe('wss://play.example.com')
    expect(resolveSessionUrl('ws://10.0.0.1:1234/', 8080)).toBe('ws://10.0.0.1:1234')
  })
})
