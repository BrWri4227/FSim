import type { HitEvent, MatchConfig, NetPlayerProfile, NetPlayerState, NetRadarState } from './MultiplayerTypes'
import { DEFAULT_TEAM, isTeam } from './MultiplayerTypes'

export const MAX_MESSAGE_BYTES = 64 * 1024
export const MAX_INBOUND_DAMAGE_SEVERITY = 1.0
export const VALID_DAMAGE_ZONES = new Set<string>([
  'ENGINE', 'WING_LEFT', 'WING_RIGHT', 'FUSELAGE', 'TAIL', 'COCKPIT',
])
export const VALID_RADAR_MODES = new Set<string>(['OFF', 'RWS', 'TWS', 'STT', 'GMTI'])

/** Slightly above longest in-game gun (M61A1 3000 m). */
export const GUN_HIT_MAX_RANGE_M = 4000
/** Slightly above longest in-game missile (R-77 65000 m). */
export const MISSILE_HIT_MAX_RANGE_M = 70000
/** Extra slack for latency and one-frame movement between peers. */
export const HIT_RANGE_SLACK_M = 500

export function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && isFinite(x))
}

export function isVec4(v: unknown): v is [number, number, number, number] {
  return Array.isArray(v) && v.length === 4 && v.every(x => typeof x === 'number' && isFinite(x))
}

export const MAX_CALLSIGN_LENGTH = 24

/**
 * Strip anything that would let a callsign misrepresent itself on someone
 * else's screen. It is rendered as text on every other client, so control
 * characters (including the bidirectional overrides, which can visually
 * reorder surrounding text) and runs of whitespace are collapsed out before
 * the length limit is applied.
 *
 * Returns an empty string if nothing usable is left; callers fall back to the
 * peer id.
 */
export function sanitizeCallsign(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    // Tab / newline / carriage return become spaces, so a pasted two-line name
    // reads as two words rather than having them run together.
    .replace(/[\t\n\r]/g, ' ')
    // Everything else non-printable is dropped outright. The \u2028-\u202e and
    // \u2060-\u206f ranges include the bidirectional overrides, which can
    // visually reorder or hide text around them on the receiving client.
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CALLSIGN_LENGTH)
}

export function isValidProfile(p: unknown): p is NetPlayerProfile {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Record<string, unknown>
  if (!(typeof o['aircraftId'] === 'string' && o['aircraftId'].length > 0 && o['aircraftId'].length <= 64)) {
    return false
  }
  const callsign = o['callsign']
  if (callsign !== undefined && (typeof callsign !== 'string' || callsign.length > MAX_CALLSIGN_LENGTH * 4)) {
    return false
  }
  const team = o['team']
  if (team !== undefined && !isTeam(team)) return false
  const ready = o['ready']
  if (ready !== undefined && typeof ready !== 'boolean') return false
  return true
}

/**
 * Normalize an accepted profile — call after `isValidProfile`.
 *
 * The team is always stamped, even when the sender omitted it, so downstream
 * code never has to decide what an absent side means. That matters: a peer
 * whose team is ambiguous would be shootable by one client and not another.
 */
export function sanitizeProfile(p: NetPlayerProfile): NetPlayerProfile {
  const callsign = sanitizeCallsign(p.callsign)
  const team = isTeam(p.team) ? p.team : DEFAULT_TEAM
  const ready = p.ready === true
  return callsign
    ? { aircraftId: p.aircraftId, callsign, team, ready }
    : { aircraftId: p.aircraftId, team, ready }
}

export function isValidHitEvent(h: unknown, senderId: string): h is HitEvent {
  if (typeof h !== 'object' || h === null) return false
  const o = h as Record<string, unknown>
  return (
    o['sourceId'] === senderId &&
    typeof o['targetId'] === 'string' && o['targetId'].length > 0 &&
    o['targetId'] !== senderId &&
    VALID_DAMAGE_ZONES.has(String(o['zone'])) &&
    typeof o['severity'] === 'number' && o['severity'] >= 0 && o['severity'] <= MAX_INBOUND_DAMAGE_SEVERITY &&
    (o['weapon'] === 'GUN' || o['weapon'] === 'MISSILE')
  )
}

/** Upper bounds on host-supplied match rules — a hostile host must not be able
 *  to set a match that never ends or a timer that overflows a setTimeout. */
export const MAX_SCORE_LIMIT = 500
export const MAX_TIME_LIMIT_SEC = 2 * 60 * 60

export function isValidMatchConfig(c: unknown): c is MatchConfig {
  if (typeof c !== 'object' || c === null) return false
  const o = c as Record<string, unknown>
  if (o['mode'] !== 'TDM' && o['mode'] !== 'FFA') return false
  const score = o['scoreLimit']
  const time = o['timeLimitSec']
  return (
    typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= MAX_SCORE_LIMIT &&
    typeof time === 'number' && Number.isFinite(time) && time >= 0 && time <= MAX_TIME_LIMIT_SEC
  )
}

export function isValidRadarState(r: unknown): r is NetRadarState {
  if (typeof r !== 'object' || r === null) return false
  const o = r as Record<string, unknown>
  return (
    VALID_RADAR_MODES.has(String(o['mode'])) &&
    (o['sttTargetId'] === null || typeof o['sttTargetId'] === 'string')
  )
}

/** Upper bounds — reject absurd payloads from a buggy or hostile client. */
export const MAX_NET_MISSILES = 32
export const MAX_NET_FLARES = 240
export const MAX_NET_CHAFF = 240

function isNetMissile(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o['id'] === 'string' && o['id'].length > 0 && o['id'].length <= 96 &&
    isVec3(o['positionNED']) &&
    isVec3(o['velocityNED']) &&
    typeof o['targetEntityId'] === 'string' && o['targetEntityId'].length <= 96 &&
    typeof o['active'] === 'boolean'
  )
}

function isNetCountermeasures(v: unknown): boolean {
  // `null` is the valid "unchanged since last snapshot" sentinel.
  if (v === null) return true
  if (typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  const flares = o['flares']
  const chaff = o['chaffClouds']
  if (!Array.isArray(flares) || !Array.isArray(chaff)) return false
  if (flares.length > MAX_NET_FLARES || chaff.length > MAX_NET_CHAFF) return false
  return (
    flares.every(f => {
      if (typeof f !== 'object' || f === null) return false
      const fo = f as Record<string, unknown>
      return isVec3(fo['positionNED']) && isVec3(fo['velocityNED']) &&
        typeof fo['heatSignatureKW'] === 'number' && isFinite(fo['heatSignatureKW']) &&
        typeof fo['ageSec'] === 'number' && isFinite(fo['ageSec'])
    }) &&
    chaff.every(c => {
      if (typeof c !== 'object' || c === null) return false
      const co = c as Record<string, unknown>
      return isVec3(co['positionNED']) && isVec3(co['velocityNED']) &&
        typeof co['rcsM2'] === 'number' && isFinite(co['rcsM2']) &&
        typeof co['ageSec'] === 'number' && isFinite(co['ageSec'])
    })
  )
}

export function isValidPlayerState(s: unknown): s is NetPlayerState {
  if (typeof s !== 'object' || s === null) return false
  const o = s as Record<string, unknown>
  return (
    isVec3(o['positionNED']) &&
    isVec3(o['velocityNED']) &&
    isVec4(o['attitudeQuat']) &&
    typeof o['throttle'] === 'number' && o['throttle'] >= 0 && o['throttle'] <= 1 &&
    typeof o['ejected'] === 'boolean' &&
    typeof o['structuralFailure'] === 'boolean' &&
    isValidRadarState(o['radar']) &&
    Array.isArray(o['missiles']) && o['missiles'].length <= MAX_NET_MISSILES &&
    o['missiles'].every(isNetMissile) &&
    isNetCountermeasures(o['countermeasures'])
  )
}

export function nedDistanceM(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dn = a[0] - b[0]
  const de = a[1] - b[1]
  const dd = a[2] - b[2]
  return Math.sqrt(dn * dn + de * de + dd * dd)
}

/** Range/geometry sanity check — rejects hits that are impossible given peer positions. */
export function isPlausibleHit(
  hit: HitEvent,
  sourceState: NetPlayerState,
  targetState: NetPlayerState,
): boolean {
  if (targetState.ejected) return false

  const distM = nedDistanceM(sourceState.positionNED, targetState.positionNED)
  const maxRangeM = hit.weapon === 'GUN' ? GUN_HIT_MAX_RANGE_M : MISSILE_HIT_MAX_RANGE_M
  return distM <= maxRangeM + HIT_RANGE_SLACK_M
}
