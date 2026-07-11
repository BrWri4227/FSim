import type { HitEvent, NetPlayerProfile, NetPlayerState, NetRadarState } from './MultiplayerTypes'

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

export function isValidProfile(p: unknown): p is NetPlayerProfile {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Record<string, unknown>
  return typeof o['aircraftId'] === 'string' && o['aircraftId'].length > 0 && o['aircraftId'].length <= 64
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

export function isValidRadarState(r: unknown): r is NetRadarState {
  if (typeof r !== 'object' || r === null) return false
  const o = r as Record<string, unknown>
  return (
    VALID_RADAR_MODES.has(String(o['mode'])) &&
    (o['sttTargetId'] === null || typeof o['sttTargetId'] === 'string')
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
    Array.isArray(o['missiles']) &&
    typeof o['countermeasures'] === 'object' && o['countermeasures'] !== null
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
