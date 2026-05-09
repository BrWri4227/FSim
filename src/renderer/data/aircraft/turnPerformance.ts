/**
 * Ballpark sustained level turn rate (deg/s) vs combat CAS from EM-style charts.
 * Higher ω toward corner; F/A-18 capped lower by 7.5g structural limit in this sim.
 */
const SUSTAINED_TURN_RATE_DEG_S: Record<string, { min: number; max: number }> = {
  f16c: { min: 16, max: 26 },
  f15c: { min: 14, max: 24 },
  fa18c: { min: 12, max: 21 },
  mig29: { min: 17, max: 27 },
  su27: { min: 16, max: 26 },
  su35: { min: 16, max: 27 },
}

export function sustainedTurnRateRefDegS(specId: string): { min: number; max: number } | undefined {
  return SUSTAINED_TURN_RATE_DEG_S[specId]
}
