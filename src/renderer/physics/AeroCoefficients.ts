import { interp2D } from '../utils/TableLookup'
import type { AeroTable } from '../types/aircraft'

export interface AeroCoeffs {
  CL: number; CD: number; Cm: number
  CY: number; Cl: number; Cn: number
}

/** CL-only lookup — avoids the CD/Cm table reads and side-force assembly.
 *  Use when only lift coefficient is needed (e.g. load-factor display in computeDerivedState). */
export function computeCL(aero: AeroTable, alphaDeg: number, machNumber: number): number {
  const { alphaBreakpointsDeg: alphaBP, machBreakpoints: machBP } = aero
  const alphaLook = Math.max(alphaBP[0]!, Math.min(alphaBP[alphaBP.length - 1]!, alphaDeg))
  const machLook  = Math.max(machBP[0]!, Math.min(machBP[machBP.length - 1]!, machNumber))
  return interp2D(alphaBP, machBP, aero.CL, alphaLook, machLook)
}

export function computeAeroCoeffs(
  aero: AeroTable,
  alphaDeg: number,
  betaDeg: number,
  machNumber: number,
  pRad: number, qRad: number, rRad: number,  // body angular rates rad/s
  wingspanM: number, macM: number, speedMS: number
): AeroCoeffs {
  const { alphaBreakpointsDeg: alphaBP, machBreakpoints: machBP } = aero

  // Clamp alpha for table lookup but keep sign
  const alphaLook = Math.max(alphaBP[0]!, Math.min(alphaBP[alphaBP.length - 1]!, alphaDeg))
  const machLook  = Math.max(machBP[0]!, Math.min(machBP[machBP.length - 1]!, machNumber))

  const CL = interp2D(alphaBP, machBP, aero.CL, alphaLook, machLook)
  const CD = Math.max(0, interp2D(alphaBP, machBP, aero.CD, alphaLook, machLook))
  const Cm = interp2D(alphaBP, machBP, aero.Cm, alphaLook, machLook)

  // Reference for damping derivatives: non-dimensionalise p,q,r
  const denom = 2 * Math.max(speedMS, 1)
  const pHat = pRad * wingspanM / denom
  const qHat = qRad * macM / denom
  const rHat = rRad * wingspanM / denom

  // Side force, roll moment, yaw moment from beta and damping.
  // Gains were previously tuned to fight dutch-roll on top of an explicit SAS
  // rate-feedback layer.  With SAS removed, the physical derivatives handle
  // damping directly, so these multipliers are reduced toward 1.0×.
  const betaRad = betaDeg * (Math.PI / 180)
  const CY_STAB_GAIN = 1.0
  const CLLP_DAMP_GAIN = 1.4
  const CNR_DAMP_GAIN = 1.6
  const CNBETA_STAB_GAIN = 1.3
  const CL_R_CROSS_DAMP = -0.05
  const CN_P_CROSS_DAMP = -0.03

  const CY = aero.CYbeta * CY_STAB_GAIN * betaRad
  const Cl = (aero.Clbeta * betaRad) + (aero.Clp * CLLP_DAMP_GAIN * pHat) + (CL_R_CROSS_DAMP * rHat)
  const Cn = (aero.Cnbeta * CNBETA_STAB_GAIN * betaRad) + (aero.Cnr * CNR_DAMP_GAIN * rHat) + (CN_P_CROSS_DAMP * pHat)

  // Add pitch damping to Cm
  const CmWithDamping = Cm + aero.Cmq * qHat

  return { CL, CD, Cm: CmWithDamping, CY, Cl, Cn }
}
