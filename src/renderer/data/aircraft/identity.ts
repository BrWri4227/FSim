/**
 * Player-facing aircraft identity — the roster's differences, made legible.
 *
 * The sim already tells these ten airframes apart at coefficient-table
 * resolution: the F-22 has 312 kN of wet thrust and a 0.05 m² head-on RCS, the
 * MiG-29 has 163 kN and 5.0 m². The selection card showed *Nation, Max G, Max
 * AoA* — and `maxGPositive` is 9.0 on almost the whole roster — so from the UI
 * every aircraft was the same aircraft in a different colour.
 *
 * The five bars here are **computed from the specs**, never hand-authored, so
 * they stay honest if an airframe is ever retuned. Only the role tag and the
 * one-line character note are editorial, because no formula produces those.
 */
import type { AircraftSpec } from '../../types/aircraft'
import { AIRCRAFT_ROSTER } from './catalog'
import { sustainedTurnRateRefDegS } from './turnPerformance'

export type AircraftRole =
  | 'Air Superiority'
  | 'Stealth Interceptor'
  | 'Multirole'
  | 'Knife-fighter'
  | 'Heavy Interceptor'
  | 'Strike'

export interface AircraftBars {
  /** Thrust-to-weight at combat load. */
  acceleration: number
  /** Sustained turn rate toward corner speed. */
  turn: number
  /** Fuel and station count — how long you can stay out and how much you bring. */
  reach: number
  /** How late the other pilot sees you. */
  stealth: number
  /** Countermeasures on board. */
  survivability: number
}

export interface AircraftIdentity {
  role: AircraftRole
  /** Each 0..1, normalised across the roster so the bars read comparatively. */
  bars: AircraftBars
  blurb: string
}

/** Editorial. Everything else on the card is derived. */
const CHARACTER: Record<string, { role: AircraftRole; blurb: string }> = {
  f22: {
    role: 'Stealth Interceptor',
    blurb: 'Sees you first and accelerates away from the answer. Expensive to turn with.',
  },
  f35a: {
    role: 'Stealth Interceptor',
    blurb: 'Hard to find and hard to shake, but it will not win a drag race.',
  },
  f16c: {
    role: 'Multirole',
    blurb: 'Light and eager in the turn. Short legs — pick your fights close to home.',
  },
  f15c: {
    role: 'Heavy Interceptor',
    blurb: 'Reach and raw power. Big on radar, so it fights on its own terms or not at all.',
  },
  fa18c: {
    role: 'Multirole',
    blurb: 'Superb at low speed and high alpha. Slow to build energy back up.',
  },
  fa18e: {
    role: 'Strike',
    blurb: 'Carries the most and stays out the longest. Bring a friend to cover you.',
  },
  mig29: {
    role: 'Knife-fighter',
    blurb: 'Vicious inside five kilometres. Thirsty, short-ranged, and light on flares.',
  },
  su57: {
    role: 'Stealth Interceptor',
    blurb: 'Thrust vectoring plus a small radar return. Points its nose almost anywhere.',
  },
  su27: {
    role: 'Air Superiority',
    blurb: 'Enormous fuel load and a heavy punch. Sluggish to change direction.',
  },
  su35: {
    role: 'Air Superiority',
    blurb: 'Vectored thrust on a big airframe — turns like something much smaller.',
  },
}

const FALLBACK: { role: AircraftRole; blurb: string } = {
  role: 'Multirole',
  blurb: 'A balanced fighter with no pronounced strengths or weaknesses.',
}

/** Combat weight: empty plus half fuel, the standard basis for a T/W figure. */
function combatMassKg(spec: AircraftSpec): number {
  return spec.mass.emptyMassKg + spec.mass.fuelCapacityKg * 0.5
}

function rawAcceleration(spec: AircraftSpec): number {
  return spec.engine.maxThrustWetN / combatMassKg(spec)
}

function rawTurn(spec: AircraftSpec): number {
  const ref = sustainedTurnRateRefDegS(spec.id)
  if (ref) return ref.max
  // No EM reference for this airframe — fall back to a wing-loading proxy so a
  // newly added aircraft still gets a plausible bar instead of a zero one.
  return 1000 * (spec.mass.wingAreaM2 / combatMassKg(spec))
}

function rawReach(spec: AircraftSpec): number {
  // Fuel dominates; station count is a secondary term so a tanker-legged jet
  // with few pylons does not outrank a fighter that can actually carry a war load.
  return spec.mass.fuelCapacityKg + spec.hardpoints.length * 250
}

function rawStealth(spec: AircraftSpec): number {
  // RCS spans 0.05–14 m² across the roster, so compare on a log scale or the
  // Raptor and the F-35 would be indistinguishable at the bottom of a linear one.
  const headOnM2 = Math.max(spec.rcsTableM2[0] ?? 5, 0.001)
  return -Math.log10(headOnM2)
}

function rawSurvivability(spec: AircraftSpec): number {
  return (spec.cmdsFlareCount ?? 120) + (spec.cmdsChaffCount ?? 120)
}

const METRICS: Record<keyof AircraftBars, (spec: AircraftSpec) => number> = {
  acceleration: rawAcceleration,
  turn: rawTurn,
  reach: rawReach,
  stealth: rawStealth,
  survivability: rawSurvivability,
}

/**
 * Min-max range of each metric over the roster, computed once. Normalising
 * against the roster rather than an absolute scale is what makes the bars
 * answer the question the player is actually asking: *compared to what else I
 * could fly.*
 */
const RANGES: Record<keyof AircraftBars, { min: number; max: number }> = (() => {
  const out = {} as Record<keyof AircraftBars, { min: number; max: number }>
  for (const key of Object.keys(METRICS) as Array<keyof AircraftBars>) {
    const values = AIRCRAFT_ROSTER.map(METRICS[key])
    out[key] = { min: Math.min(...values), max: Math.max(...values) }
  }
  return out
})()

function normalise(key: keyof AircraftBars, spec: AircraftSpec): number {
  const { min, max } = RANGES[key]
  const span = max - min
  // A roster where every aircraft scores the same on a metric would divide by
  // zero; show it as full rather than blank, since none of them is weak at it.
  if (span <= 1e-9) return 1
  // Floored at 0.08 so the worst airframe still shows a visible stub — an empty
  // bar reads as missing data rather than as a weakness.
  return 0.08 + 0.92 * ((METRICS[key](spec) - min) / span)
}

export function deriveAircraftIdentity(spec: AircraftSpec): AircraftIdentity {
  const character = CHARACTER[spec.id] ?? FALLBACK
  return {
    role: character.role,
    blurb: character.blurb,
    bars: {
      acceleration: normalise('acceleration', spec),
      turn: normalise('turn', spec),
      reach: normalise('reach', spec),
      stealth: normalise('stealth', spec),
      survivability: normalise('survivability', spec),
    },
  }
}

/** Display order and labels for the bars, so every card reads the same way. */
export const BAR_LABELS: ReadonlyArray<[keyof AircraftBars, string]> = [
  ['acceleration', 'ACCEL'],
  ['turn', 'TURN'],
  ['reach', 'REACH'],
  ['stealth', 'STEALTH'],
  ['survivability', 'SURVIV'],
]
