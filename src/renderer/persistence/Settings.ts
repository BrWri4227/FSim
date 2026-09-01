/**
 * Persisted pilot preferences — aircraft/loadout choices and flight options that
 * should survive an app restart. Backed by [Storage].
 */
import { readJSON, writeJSON } from './Storage'
import type { PostFXQuality } from '../postfx/PostFXManager'
import type { TimeOfDayPreset } from '../scene/TimeOfDay'
import type { WeatherPreset } from '../physics/WeatherPresets'

const KEY = 'settings'

/** hardpointId → weaponId, per aircraft. `"none"` is a valid stored value. */
export type LoadoutMap = Record<string, Record<string, string>>

export interface PilotSettings {
  lastAircraftId: string | null
  lastScenarioId: string | null
  glocEnabled: boolean
  autoRudder: boolean
  masterVolume: number
  postFXQuality: PostFXQuality
  lastTimeOfDay: TimeOfDayPreset
  lastWeatherPreset: WeatherPreset
  loadoutByAircraft: LoadoutMap
}

export const DEFAULT_SETTINGS: PilotSettings = {
  lastAircraftId: null,
  lastScenarioId: null,
  glocEnabled: true,
  autoRudder: true,
  masterVolume: 1.0,
  postFXQuality: 'HIGH',
  lastTimeOfDay: 'DAY',
  lastWeatherPreset: 'CLEAR',
  loadoutByAircraft: {},
}

export function loadSettings(): PilotSettings {
  const stored = readJSON<Partial<PilotSettings>>(KEY, {})
  return { ...DEFAULT_SETTINGS, ...stored, loadoutByAircraft: { ...(stored.loadoutByAircraft ?? {}) } }
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
