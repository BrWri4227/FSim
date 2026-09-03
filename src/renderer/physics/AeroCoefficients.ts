import { interp2D } from '../utils/TableLookup'
import { clamp, lerp } from '../utils/MathUtils'
import type { AeroTable } from '../types/aircraft'

const DEG2RAD = Math.PI / 180

export interface AeroCoeffs {
  CL: number; CD: number; Cm: number
  CY: number; Cl: number; Cn: number
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
  const alphaMin = alphaBP[0]!
  const alphaMax = alphaBP[alphaBP.length - 1]!
  const alphaLook = Math.max(alphaMin, Math.min(alphaMax, alphaDeg))
  const machLook  = Math.max(machBP[0]!, Math.min(machBP[machBP.length - 1]!, machNumber))

  let CL = interp2D(alphaBP, machBP, aero.CL, alphaLook, machLook)
  let CD = Math.max(0, interp2D(alphaBP, machBP, aero.CD, alphaLook, machLook))
  let Cm = interp2D(alphaBP, machBP, aero.Cm, alphaLook, machLook)

  // ─── Post-stall extension ──────────────────────────────────────────────────
  // The tables stop at ~±30° AoA. Past that, blend from the table edge into a
  // fully-separated flat-plate model so high-alpha maneuvers (cobra, high-AoA
  // snap turns) bleed energy hard and get a strong nose-down pitch break that
  // makes recovery automatic. Without this the coefficients simply froze at the
  // 30° values and nothing interesting happened past the stall.
  if (alphaDeg > alphaMax || alphaDeg < alphaMin) {
    const sign = alphaDeg >= 0 ? 1 : -1
    const edgeAbs = alphaDeg >= 0 ? alphaMax : -alphaMin
    const aAbs = Math.abs(alphaDeg)
    const t = clamp((aAbs - edgeAbs) / (90 - edgeAbs), 0, 1)
    const s = t * t * (3 - 2 * t)  // smoothstep

    const aRad = clamp(alphaDeg, -90, 90) * DEG2RAD
    const sa = Math.sin(aRad)
    const CL_plate = 0.95 * Math.sin(2 * aRad)        // ≈ sin(2α), peak ~1.0 near 45°
    const CD_plate = 0.10 + 1.90 * sa * sa            // flat-plate drag, ~2.0 at 90°
    const Cm_plate = -0.45 * sign                     // firm nose-down break

    CL = lerp(CL, CL_plate, s)
    CD = lerp(CD, CD_plate, s)
    Cm = lerp(Cm, Cm_plate, s)
  }

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
