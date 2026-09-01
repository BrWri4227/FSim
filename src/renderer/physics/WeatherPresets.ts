/**
 * Named weather presets that map onto the existing [WeatherState] config so the
 * Loadout screen can offer a small menu instead of raw wind/turbulence fields.
 */
import { setWeather, resetWeather, type WeatherConfig } from './WeatherState'

export type WeatherPreset = 'CLEAR' | 'SCATTERED' | 'BROKEN' | 'OVERCAST'

export const WEATHER_PRESETS: WeatherPreset[] = ['CLEAR', 'SCATTERED', 'BROKEN', 'OVERCAST']

export const WEATHER_PRESET_LABELS: Record<WeatherPreset, string> = {
  CLEAR: 'Clear',
  SCATTERED: 'Scattered cloud',
  BROKEN: 'Broken cloud + wind',
  OVERCAST: 'Overcast + turbulence',
}

export const WEATHER_PRESET_CONFIG: Record<WeatherPreset, Partial<WeatherConfig>> = {
  CLEAR: {
    cloudCover: 'CLEAR',
    turbulence: 'CALM',
    visibilityM: 60000,
    surfaceWindMS: 0,
    upperWindMS: 0,
  },
  SCATTERED: {
    cloudCover: 'SCATTERED',
    turbulence: 'LIGHT',
    visibilityM: 42000,
    surfaceWindFromDeg: 250,
    surfaceWindMS: 4,
    upperWindFromDeg: 260,
    upperWindMS: 18,
  },
  BROKEN: {
    cloudCover: 'BROKEN',
    turbulence: 'MODERATE',
    visibilityM: 20000,
    surfaceWindFromDeg: 220,
    surfaceWindMS: 8,
    upperWindFromDeg: 240,
    upperWindMS: 30,
  },
  OVERCAST: {
    cloudCover: 'OVERCAST',
    turbulence: 'MODERATE',
    visibilityM: 11000,
    surfaceWindFromDeg: 200,
    surfaceWindMS: 10,
    upperWindFromDeg: 230,
    upperWindMS: 38,
  },
}

/** Apply a preset to the global weather state. */
export function applyWeatherPreset(preset: WeatherPreset): void {
  resetWeather()
  setWeather(WEATHER_PRESET_CONFIG[preset] ?? WEATHER_PRESET_CONFIG.CLEAR)
}
