import type { ServerInfo, ServerMessage } from './MultiplayerTypes'
import { PROTOCOL_VERSION } from './MultiplayerTypes'
import { resolveSessionUrl } from './MultiplayerClient'

/**
 * Ask a session about itself without joining it.
 *
 * Concurrent sessions on one box are separate processes on separate ports, so a
 * player picks between them by port number. That is workable only if they can
 * see which one has people in it before committing — this is what puts a name,
 * a player count and a ping next to an address they typed.
 *
 * Deliberately not a discovery mechanism: it contacts exactly the address it is
 * given, and only when the player asks.
 */

/** Long enough for a Pi across the internet, short enough to refresh a list. */
export const PROBE_TIMEOUT_MS = 4000

export type ProbeFailureKind =
  /** Nothing answered in time — down, wrong port, or a firewall swallowing it. */
  | 'timeout'
  /** The socket was refused or dropped before answering. */
  | 'refused'
  /** Something is listening, but it did not answer like an FSim server. */
  | 'not-fsim'

export interface ProbeSuccess {
  ok: true
  info: ServerInfo
  /** Round trip from asking to being answered, in milliseconds. */
  rttMs: number
  /** False when the server speaks a protocol this build does not. */
  compatible: boolean
}

export interface ProbeFailure {
  ok: false
  kind: ProbeFailureKind
  message: string
}

export type ProbeResult = ProbeSuccess | ProbeFailure

const FAILURE_TEXT: Record<ProbeFailureKind, string> = {
  timeout: 'No answer. Check the address, the port, and that the session is running.',
  refused: 'Nothing accepted a connection there.',
  'not-fsim': 'Something is listening, but it is not an FSim session.',
}

function failure(kind: ProbeFailureKind): ProbeFailure {
  return { ok: false, kind, message: FAILURE_TEXT[kind] }
}

/**
 * Open a short-lived socket, ask, and close. Never rejects: a probe failing is
 * an ordinary outcome the caller renders, not an exception.
 */
export function probeServer(
  host: string,
  port: number,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  return new Promise<ProbeResult>(resolve => {
    let url: string
    try {
      url = resolveSessionUrl(host, port)
    } catch {
      resolve(failure('refused'))
      return
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      // A malformed URL throws synchronously in some runtimes.
      resolve(failure('refused'))
      return
    }

    let settled = false
    const sentAtMs = { value: 0 }

    const finish = (result: ProbeResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws.close() } catch { /* already closing */ }
      resolve(result)
    }

    const timer = setTimeout(() => finish(failure('timeout')), timeoutMs)

    ws.addEventListener('open', () => {
      sentAtMs.value = Date.now()
      try {
        ws.send(JSON.stringify({ type: 'query' }))
      } catch {
        finish(failure('refused'))
      }
    })

    ws.addEventListener('message', event => {
      const rttMs = Date.now() - sentAtMs.value
      let msg: ServerMessage | null = null
      try {
        msg = JSON.parse(String(event.data)) as ServerMessage
      } catch {
        finish(failure('not-fsim'))
        return
      }
      if (!msg || msg.type !== 'server-info' || !isServerInfo(msg.info)) {
        finish(failure('not-fsim'))
        return
      }
      finish({
        ok: true,
        info: msg.info,
        rttMs,
        compatible: msg.info.protocolVersion === PROTOCOL_VERSION,
      })
    })

    ws.addEventListener('error', () => finish(failure('refused')))
    // A close before any reply means it was not an FSim server, or it hung up.
    ws.addEventListener('close', () => finish(failure('refused')))
  })
}

/** The reply crosses a network, so it is untrusted input rather than a ServerInfo. */
function isServerInfo(v: unknown): v is ServerInfo {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o['name'] === 'string' &&
    (o['description'] === null || typeof o['description'] === 'string') &&
    typeof o['players'] === 'number' &&
    typeof o['maxPlayers'] === 'number' &&
    typeof o['requiresPassword'] === 'boolean' &&
    typeof o['protocolVersion'] === 'number'
  )
}

/** One line for the lobby: what this address is, and what state it is in. */
export function describeProbe(result: ProbeResult): string {
  if (!result.ok) return result.message
  const { info, rttMs, compatible } = result
  const parts = [
    info.name,
    `${info.players}/${info.maxPlayers} players`,
    `${rttMs} ms`,
  ]
  if (info.requiresPassword) parts.push('password required')
  if (info.match.phase === 'LIVE') parts.push('match in progress')
  if (!compatible) parts.push(`protocol ${info.protocolVersion}, this build speaks ${PROTOCOL_VERSION}`)
  return parts.join(' · ')
}
