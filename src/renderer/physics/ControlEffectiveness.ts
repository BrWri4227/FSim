import { interp1D } from '../utils/TableLookup'
import type { ControlEffectivenessTable } from '../types/aircraft'

export interface ControlDeltas {
  dCL: number; dCm: number; dCl: number; dCn: number
}

export function computeControlDeltas(
  table: ControlEffectivenessTable,
  mach: number,
  elevatorRad: number,
  aileronRad: number,
  rudderRad: number
): ControlDeltas {
  const { machBreakpoints: bp } = table
  const CLde = interp1D(bp, table.CLde, mach)
  const CMde = interp1D(bp, table.CMde, mach)
  const CLda = interp1D(bp, table.CLda, mach)
  const CNdr = interp1D(bp, table.CNdr, mach)

  return {
    dCL: CLde * elevatorRad,
    dCm: CMde * elevatorRad,
    dCl: CLda * aileronRad,
    dCn: CNdr * rudderRad
  }
}
