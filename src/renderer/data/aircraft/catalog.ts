import { F16C } from './f16c'
import { F15C } from './f15c'
import { FA18C } from './fa18c'
import { F22 } from './f22'
import { F35A } from './f35a'
import { MIG29 } from './mig29'
import { SU27 } from './su27'
import { SU35 } from './su35'
import { SU57 } from './su57'
import type { AircraftSpec } from '../../types/aircraft'

export { sustainedTurnRateRefDegS } from './turnPerformance'

export const AIRCRAFT_ROSTER: AircraftSpec[] = [
  F22, F35A, F16C, F15C, FA18C, MIG29, SU57, SU27, SU35,
]

export function getAircraftById(id: string): AircraftSpec | null {
  return AIRCRAFT_ROSTER.find(spec => spec.id === id) ?? null
}
