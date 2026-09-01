import type {
  NetPlayerState,
  NetCountermeasureState,
  NetMissileState,
} from './MultiplayerTypes'

/**
 * Wire quantisation for outbound player-state snapshots.
 *
 * The multiplayer transport is line-delimited JSON. Full IEEE-754 doubles
 * serialise as ~17 significant digits (`positionNED: [1234.5678901234567, …]`)
 * which is both wasteful and pointless — nobody can perceive sub-millimetre
 * position error on a 200 km map. Rounding each field to a sensible precision
 * roughly halves the encoded snapshot with no visible fidelity loss and makes
 * `permessage-deflate` far more effective (repeated short mantissas compress
 * better than high-entropy tails).
 *
 * All helpers return fresh objects — the caller's state is never mutated.
 */

/** Round to `decimals` places; non-finite inputs collapse to 0. */
function round(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

function roundVec3(v: readonly [number, number, number], decimals: number): [number, number, number] {
  return [round(v[0], decimals), round(v[1], decimals), round(v[2], decimals)]
}

// Precision budget — tuned so the smallest step is well below perceptible.
const POS_DP = 2   // 1 cm
const VEL_DP = 2   // 1 cm/s
const QUAT_DP = 5  // ~0.001°
const THROTTLE_DP = 3
const CM_POS_DP = 1   // 10 cm — decoys don't need better
const CM_VEL_DP = 2
const CM_SCALAR_DP = 2

function quantizeMissile(m: NetMissileState): NetMissileState {
  return {
    id: m.id,
    positionNED: roundVec3(m.positionNED, POS_DP),
    velocityNED: roundVec3(m.velocityNED, VEL_DP),
    targetEntityId: m.targetEntityId,
    active: m.active,
  }
}

export function quantizeCountermeasures(cm: NetCountermeasureState): NetCountermeasureState {
  return {
    flares: cm.flares.map(f => ({
      positionNED: roundVec3(f.positionNED, CM_POS_DP),
      velocityNED: roundVec3(f.velocityNED, CM_VEL_DP),
      heatSignatureKW: round(f.heatSignatureKW, CM_SCALAR_DP),
      ageSec: round(f.ageSec, CM_SCALAR_DP),
    })),
    chaffClouds: cm.chaffClouds.map(c => ({
      positionNED: roundVec3(c.positionNED, CM_POS_DP),
      velocityNED: roundVec3(c.velocityNED, CM_VEL_DP),
      rcsM2: round(c.rcsM2, CM_SCALAR_DP),
      ageSec: round(c.ageSec, CM_SCALAR_DP),
    })),
  }
}

/**
 * Quantise a full snapshot for transmission. `countermeasures` is passed
 * through as-is when `null` (the "unchanged since last send" sentinel — see
 * `MultiplayerClient.flushStateSend`).
 */
export function quantizePlayerState(s: NetPlayerState): NetPlayerState {
  return {
    positionNED: roundVec3(s.positionNED, POS_DP),
    velocityNED: roundVec3(s.velocityNED, VEL_DP),
    attitudeQuat: [
      round(s.attitudeQuat[0], QUAT_DP),
      round(s.attitudeQuat[1], QUAT_DP),
      round(s.attitudeQuat[2], QUAT_DP),
      round(s.attitudeQuat[3], QUAT_DP),
    ],
    throttle: round(s.throttle, THROTTLE_DP),
    ejected: s.ejected,
    structuralFailure: s.structuralFailure,
    radar: { mode: s.radar.mode, sttTargetId: s.radar.sttTargetId },
    missiles: s.missiles.map(quantizeMissile),
    countermeasures: s.countermeasures ? quantizeCountermeasures(s.countermeasures) : null,
  }
}

/** Stable identity key for a missile set — used to detect launches/impacts for eager sends. */
export function missileSetKey(missiles: readonly NetMissileState[]): string {
  if (missiles.length === 0) return ''
  // ids are monotonic (`missile_<ts>_<rand>`); order is stable within a session.
  return missiles.map(m => m.id).join('|')
}
