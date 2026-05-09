import type { AtmosphericFactors } from '../types/common'

const SEA_LEVEL_DENSITY = 1.225       // kg/m³
const SEA_LEVEL_TEMP    = 288.15      // K
const SEA_LEVEL_PRESSURE = 101325     // Pa
const LAPSE_RATE        = 0.0065      // K/m (troposphere)
const TROPOPAUSE_ALT    = 11000       // m
const TROPOPAUSE_TEMP   = 216.65      // K
const GAS_CONSTANT      = 287.05      // J/(kg·K)
const GAMMA             = 1.4
const G0                = 9.80665

// International Standard Atmosphere
export function computeAtmosphere(altitudeM: number, speedMS: number): AtmosphericFactors {
  altitudeM = Math.max(0, altitudeM)
  let tempK: number
  let pressurePa: number
  let densityKgM3: number

  if (altitudeM <= TROPOPAUSE_ALT) {
    tempK = SEA_LEVEL_TEMP - LAPSE_RATE * altitudeM
    const ratio = tempK / SEA_LEVEL_TEMP
    pressurePa = SEA_LEVEL_PRESSURE * Math.pow(ratio, G0 / (LAPSE_RATE * GAS_CONSTANT))
    densityKgM3 = SEA_LEVEL_DENSITY * Math.pow(ratio, G0 / (LAPSE_RATE * GAS_CONSTANT) - 1)
  } else {
    // Stratosphere (11–20 km): isothermal
    tempK = TROPOPAUSE_TEMP
    const dh = altitudeM - TROPOPAUSE_ALT
    const factor = Math.exp(-G0 * dh / (GAS_CONSTANT * TROPOPAUSE_TEMP))
    pressurePa = 22632 * factor
    densityKgM3 = 0.3639 * factor
  }

  const speedOfSoundMS = Math.sqrt(GAMMA * GAS_CONSTANT * tempK)
  const dynamicPressurePa = 0.5 * densityKgM3 * speedMS * speedMS

  return { densityKgM3, temperatureK: tempK, pressurePa, speedOfSoundMS, dynamicPressurePa }
}

// Thrust lapse with altitude: ~σ^k matches turbofan static thrust vs density (ISA) better than a linear altitude ramp.
// Reference density ratio σ = ρ/ρ₀ at the flight level; k≈0.78 is a common ballpark for military fans.
export function thrustLapseFactor(altitudeM: number): number {
  const { densityKgM3 } = computeAtmosphere(altitudeM, 0)
  const sigma = densityKgM3 / SEA_LEVEL_DENSITY
  return Math.max(0.06, Math.pow(sigma, 0.78))
}
