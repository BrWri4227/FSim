/**
 * Persisted pilot preferences — aircraft/loadout choices and flight options that
 * should survive an app restart. Backed by [Storage].
 */
import { readJSON, writeJSON } from './Storage'
import type { PostFXQuality } from '../postfx/PostFXManager'
import type { TimeOfDayPreset } from '../scene/TimeOfDay'
import type { WeatherPreset } from '../physics/WeatherPresets'
import type { Team } from '../network/MultiplayerTypes'
import { DEFAULT_SESSION_PORT, DEFAULT_TEAM, isValidSessionPort } from '../network/MultiplayerTypes'
import type { LoadoutPreset } from '../data/hardpoints/presets'

const KEY = 'settings'

/** hardpointId → weaponId, per aircraft. `"none"` is a valid stored value. */
export type LoadoutMap = Record<string, Record<string, string>>

/**
 * A session address the player saved, so the handful of ports they actually run
 * stop being something to memorise. Concurrent sessions on one box are separate
 * processes on separate ports, so the port is what distinguishes them.
 */
export interface SavedServer {
  /** What the player calls it. Falls back to `host:port` when blank. */
  label: string
  host: string
  port: number
}

/** Keeps a stray list in localStorage from growing without bound. */
export const MAX_SAVED_SERVERS = 20

export interface PilotSettings {
  lastAircraftId: string | null
  lastScenarioId: string | null
  glocEnabled: boolean
  autoRudder: boolean
  invertPitch: boolean
  masterVolume: number
  postFXQuality: PostFXQuality
  lastTimeOfDay: TimeOfDayPreset
  lastWeatherPreset: WeatherPreset
  /** Shown to other players in LAN sessions. Empty falls back to the peer id. */
  callsign: string
  /** Side last chosen in a LAN session. */
  lastTeam: Team
  /** Loadout preset last chosen in the lobby. */
  lastLoadoutPreset: LoadoutPreset
  loadoutByAircraft: LoadoutMap
  /** Port last used to host or join. Doubles as the session picker. */
  lastSessionPort: number
  /** Address last joined, so the field is not empty on every visit. */
  lastJoinHost: string
  /** The player's own bookmarks. Not a directory — nothing discovers these. */
  savedServers: SavedServer[]
}

export const DEFAULT_SETTINGS: PilotSettings = {
  lastAircraftId: null,
  lastScenarioId: null,
  // Off by default: a newcomer who greys out in their first hard turn has no way
  // to connect the blackout to the G they pulled. Opt in once they know the game.
  glocEnabled: false,
  autoRudder: true,
  invertPitch: false,
  // Leaves headroom over the voice chat the group will be on.
  masterVolume: 0.8,
  postFXQuality: 'HIGH',
  lastTimeOfDay: 'DAY',
  lastWeatherPreset: 'CLEAR',
  callsign: '',
  lastTeam: DEFAULT_TEAM,
  lastLoadoutPreset: 'BALANCED',
  loadoutByAircraft: {},
  lastSessionPort: DEFAULT_SESSION_PORT,
  lastJoinHost: '127.0.0.1',
  savedServers: [],
}

export function loadSettings(): PilotSettings {
  const stored = readJSON<Partial<PilotSettings>>(KEY, {})
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    loadoutByAircraft: { ...(stored.loadoutByAircraft ?? {}) },
    // Rebuilt rather than passed through: callers mutate the array they get
    // back, and a reference into DEFAULT_SETTINGS would leak that edit into
    // every later load.
    savedServers: sanitizeSavedServers(stored.savedServers),
  }
}

/**
 * localStorage is hand-editable and survives across versions, so treat the
 * stored list as untrusted input rather than as a `SavedServer[]`.
 */
function sanitizeSavedServers(raw: unknown): SavedServer[] {
  if (!Array.isArray(raw)) return []
  const out: SavedServer[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const { label, host, port } = entry as Partial<SavedServer>
    if (typeof host !== 'string' || host.trim() === '') continue
    if (!isValidSessionPort(port)) continue
    out.push({
      label: typeof label === 'string' ? label.slice(0, 40) : '',
      host: host.trim().slice(0, 255),
      port,
    })
    if (out.length >= MAX_SAVED_SERVERS) break
  }
  return out
}

/** Shallow-merge a patch into the stored settings and persist. Returns the merged value. */
export function saveSettings(patch: Partial<PilotSettings>): PilotSettings {
  const merged = { ...loadSettings(), ...patch }
  writeJSON(KEY, merged)
  return merged
}

/** Persist the weapon selection for one aircraft without disturbing other fields. */
export function saveLoadoutFor(aircraftId: string, selection: Record<string, string>): void {
  const current = loadSettings()
  current.loadoutByAircraft[aircraftId] = { ...selection }
  writeJSON(KEY, current)
}

export function loadoutFor(aircraftId: string): Record<string, string> {
  return loadSettings().loadoutByAircraft[aircraftId] ?? {}
}
