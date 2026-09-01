/**
 * Time-of-day lighting presets.
 *
 * Pure data (no three.js) so it can be imported anywhere and unit-tested. The
 * scene layer ([SceneManager], [Sky]) converts the hex colours / direction into
 * three.js objects. `DAY` reproduces the original hard-coded scene lighting so
 * the default preset is a no-op visually.
 */

export type TimeOfDayPreset = 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT'

export const TIME_OF_DAY_PRESETS: TimeOfDayPreset[] = ['DAWN', 'DAY', 'DUSK', 'NIGHT']

export interface SkyGradient {
  top: number
  high: number
  mid: number
  horizon: number
  ground: number
  sun: number
  sunHalo: number
}

export interface TimeOfDayConfig {
  label: string
  /** Sun/moon direction in three.js world space (x=east, y=up, z=south), normalised. */
  sunDirThree: [number, number, number]
  sunColor: number
  sunIntensity: number
  ambientColor: number
  ambientIntensity: number
  hemiSky: number
  hemiGround: number
  hemiIntensity: number
  fogColor: number
  /** Renderer tone-mapping exposure. */
  exposure: number
  /** UnrealBloom strength. */
  bloomStrength: number
  /** Star-field opacity 0..1 (0 = hidden). */
  starOpacity: number
  sky: SkyGradient
}

export const TIME_OF_DAY: Record<TimeOfDayPreset, TimeOfDayConfig> = {
  DAWN: {
    label: 'Dawn',
    sunDirThree: [0.82, 0.2, -0.53],
    sunColor: 0xffd9a0,
    sunIntensity: 1.9,
    ambientColor: 0x6b6a88,
    ambientIntensity: 0.5,
    hemiSky: 0x9a7bb0,
    hemiGround: 0x40402f,
    hemiIntensity: 0.55,
    fogColor: 0xd7b48c,
    exposure: 1.0,
    bloomStrength: 0.5,
    starOpacity: 0.12,
    sky: {
      top: 0x1a2f66,
      high: 0x3f6fb0,
      mid: 0x8a9ec6,
      horizon: 0xe6b98a,
      ground: 0x2a2417,
      sun: 0xffe6c0,
      sunHalo: 0xffb877,
    },
  },
  DAY: {
    label: 'Day',
    sunDirThree: [0.5185, 0.8296, -0.2074],
    sunColor: 0xfff8e8,
    sunIntensity: 3.0,
    ambientColor: 0x8090b0,
    ambientIntensity: 0.6,
    hemiSky: 0x3ab8f0,
    hemiGround: 0x4a7c3f,
    hemiIntensity: 0.8,
    // Aerial-perspective haze: greyer / less saturated than the cyan sky horizon
    // so distant terrain reads as distance rather than dissolving into the sky.
    fogColor: 0xb4c2c6,
    exposure: 1.1,
    bloomStrength: 0.45,
    starOpacity: 0.0,
    sky: {
      top: 0x0a2b6b,
      high: 0x1f6fc4,
      mid: 0x5aa8dc,
      horizon: 0x9fd0e6,
      ground: 0x223417,
      sun: 0xfff5d1,
      sunHalo: 0xffc780,
    },
  },
  DUSK: {
    label: 'Dusk',
    sunDirThree: [-0.79, 0.17, 0.59],
    sunColor: 0xff9042,
    sunIntensity: 1.7,
    ambientColor: 0x50506e,
    ambientIntensity: 0.42,
    hemiSky: 0x8a5a6a,
    hemiGround: 0x2e2e26,
    hemiIntensity: 0.46,
    fogColor: 0xb9663f,
    exposure: 1.0,
    bloomStrength: 0.6,
    starOpacity: 0.35,
    sky: {
      top: 0x0b1c50,
      high: 0x3a4f8f,
      mid: 0x8a6a8c,
      horizon: 0xe07a3c,
      ground: 0x1c1710,
      sun: 0xffb060,
      sunHalo: 0xff7a3a,
    },
  },
  NIGHT: {
    label: 'Night',
    sunDirThree: [0.28, 0.86, -0.42],
    sunColor: 0x9fb4e0,
    sunIntensity: 0.35,
    ambientColor: 0x2a3050,
    ambientIntensity: 0.3,
    hemiSky: 0x1a2540,
    hemiGround: 0x10140f,
    hemiIntensity: 0.34,
    fogColor: 0x0a1526,
    exposure: 0.9,
    bloomStrength: 0.8,
    starOpacity: 1.0,
    sky: {
      top: 0x03060f,
      high: 0x081128,
      mid: 0x101d3c,
      horizon: 0x223350,
      ground: 0x05080c,
      sun: 0xc8d4f0,
      sunHalo: 0x5a6a90,
    },
  },
}

export function getTimeOfDayConfig(preset: TimeOfDayPreset): TimeOfDayConfig {
  return TIME_OF_DAY[preset] ?? TIME_OF_DAY.DAY
}
