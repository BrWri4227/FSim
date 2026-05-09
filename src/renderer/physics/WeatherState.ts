import type { Vec3 } from '../types/common'

export type TurbulenceLevel = 'CALM' | 'LIGHT' | 'MODERATE' | 'SEVERE'
export type CloudCover = 'CLEAR' | 'SCATTERED' | 'BROKEN' | 'OVERCAST'

export interface WeatherConfig {
  /** Wind from-direction at the surface, degrees true (meteorological convention). */
  surfaceWindFromDeg: number
  /** Wind speed at the surface, m/s. */
  surfaceWindMS: number
  /** Reference altitude (m) for the upper wind layer. */
  upperWindAltM: number
  /** Wind from-direction at upper layer, degrees true. */
  upperWindFromDeg: number
  /** Wind speed at upper layer, m/s. Typical jet-stream-ish at 10km. */
  upperWindMS: number
  /** Turbulence intensity. */
  turbulence: TurbulenceLevel
  /** Visual-only for now (used by cloud / post-FX in later stages). */
  cloudCover: CloudCover
  /** Visibility in meters (used by fog / post-FX in later stages). */
  visibilityM: number
}

const DEFAULT_CONFIG: WeatherConfig = {
  surfaceWindFromDeg: 0,
  surfaceWindMS: 0,
  upperWindAltM: 10000,
  upperWindFromDeg: 0,
  upperWindMS: 0,
  turbulence: 'CALM',
  cloudCover: 'CLEAR',
  visibilityM: 60000,
}

let _config: WeatherConfig = { ...DEFAULT_CONFIG }

export function getWeather(): WeatherConfig {
  return _config
}

export function setWeather(patch: Partial<WeatherConfig>): void {
  _config = { ..._config, ...patch }
}

export function resetWeather(): void {
  _config = { ...DEFAULT_CONFIG }
}

/**
 * Wind vector in NED frame at the given altitude.
 * Meteorological convention: "wind from 270" means air moves from west toward east,
 * so the air velocity vector points east (+y in NED).
 */
export function windNEDAt(altM: number, cfg: WeatherConfig = _config): Vec3 {
  if (cfg.surfaceWindMS === 0 && cfg.upperWindMS === 0) return [0, 0, 0]

  // Linear interp between surface and upper layer (clamped above)
  const t = Math.max(0, Math.min(1, altM / Math.max(cfg.upperWindAltM, 1)))
  const speed = cfg.surfaceWindMS + (cfg.upperWindMS - cfg.surfaceWindMS) * t

  // Direction interp — handle wraparound via shortest path
  let dDeg = cfg.upperWindFromDeg - cfg.surfaceWindFromDeg
  if (dDeg > 180) dDeg -= 360
  if (dDeg < -180) dDeg += 360
  const fromDeg = cfg.surfaceWindFromDeg + dDeg * t

  // "From" → "to" reversal: wind blows opposite to the from-bearing.
  const toRad = (fromDeg + 180) * (Math.PI / 180)
  // NED: +x=N, +y=E. North = bearing 0, East = bearing 90.
  const vN = Math.cos(toRad) * speed
  const vE = Math.sin(toRad) * speed
  return [vN, vE, 0]
}

/** Peak angular-rate perturbation amplitude (rad/s) by turbulence level. */
export function turbulenceAmplitudeRadS(level: TurbulenceLevel): number {
  switch (level) {
    case 'CALM':     return 0
    case 'LIGHT':    return 0.05
    case 'MODERATE': return 0.15
    case 'SEVERE':   return 0.35
  }
}
