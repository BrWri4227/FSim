import { clamp } from '../utils/MathUtils'

/**
 * Physiological G-LOC (G-force induced Loss Of Consciousness) model.
 *
 * Replaces the old "instantaneous G → vignette" filter with a time-dose model:
 * the brain runs an oxygen deficit whenever sustained Gz exceeds the pilot's
 * current tolerance, and only loses vision / consciousness once that debt has
 * built up over several seconds. Unloading pays the debt back down.
 *
 * Two things raise tolerance:
 *   • the G-suit  — a fixed bladder-inflation bonus, always on
 *   • the AGSM    — the anti-G straining manoeuvre the pilot performs under load.
 *     Modelled as an auto-strain that ramps in with G, adds a large tolerance
 *     bonus while fresh, and fatigues over a long hard pull (so you cannot hold
 *     max G forever). Fatigue recovers when the pilot relaxes between pulls.
 *
 * Pure module — no THREE / DOM. Deterministic, fixed-step friendly, unit-tested.
 */

export type GLOCPhase = 'NOMINAL' | 'GREYOUT' | 'BLACKOUT' | 'GLOC' | 'RECOVERY'

export interface GLOCState {
  /** Effective onset G right now (base + suit + AGSM), eye-level. */
  gTolerance: number
  /** Accumulated cerebral oxygen deficit, in G·seconds over tolerance. */
  oxygenDebt: number
  /** 1 = fresh, 0 = at the G-LOC threshold. Handy for a HUD reserve bar. */
  reserveFraction: number
  /** 0..1 peripheral dimming + desaturation (leads the tunnel). */
  greyout: number
  /** 0..1 central tunnel-vision / blackout vignette closure. */
  blackout: number
  /** 0..1 negative-G redout. */
  redout: number
  /** 0..1 how hard the pilot is currently straining (AGSM). */
  agsmStrain: number
  /** 0..1 AGSM exhaustion — reduces the straining bonus. */
  agsmFatigue: number
  /** 1 = full authority, ramps to 0 while incapacitated, back up through recovery. */
  controlAuthority: number
  /** True during absolute incapacitation — flight/weapon inputs are locked out. */
  incapacitated: boolean
  phase: GLOCPhase
}

export interface GLOCConfig {
  enabled: boolean
  /** Relaxed, eye-level tolerance with no suit and no straining (~4 G). */
  baseGTolerance: number
  /** Tolerance added by an inflated anti-G suit (~1 G). */
  gSuitBonus: number
  /** Tolerance added by a fresh, maximal AGSM (~3.5 G → ~8.5 G total). */
  agsmBonusMax: number
}

export const DEFAULT_GLOC_CONFIG: GLOCConfig = {
  enabled: true,
  baseGTolerance: 4.0,
  gSuitBonus: 1.0,
  agsmBonusMax: 3.5,
}

// ── Tuning constants ─────────────────────────────────────────────────────────

// Oxygen-debt integrator (units: G·seconds of overload).
const MAX_DEPLETE_RATE_G = 4.0    // cap on overload used for depletion → ~min buffer even at huge G
const DEBT_RECOVER_BASE   = 1.0   // baseline pay-down even at exactly tolerance
const DEBT_RECOVER_RATE   = 0.35  // per (G under tolerance + base) per second

const SYMPTOM_G_S  = 5.0   // tunnel starts closing (≈ the ~5 s functional buffer)
const BLACKOUT_G_S = 9.0   // vision fully gone, still conscious
const GLOC_G_S     = 13.0  // unconsciousness
// Debt saturates a little past the G-LOC threshold: pulling more G once you are
// already out does not deepen the coma, it just delays recovery until G eases.
// Keeps absolute incapacitation bounded to a realistic ~12-15 s.
const MAX_DEBT_G_S = 18.0
const GREY_START_G_S = 2.0 // peripheral grey/dim begins (leads the tunnel)
const GREY_FULL_G_S  = 8.0

// AGSM auto-strain.
const AGSM_ONSET_G = 2.0
const AGSM_FULL_G  = 6.0
const AGSM_TENSE_TC = 0.6   // s — you cannot instantly reach a maximal strain
const AGSM_RELAX_TC = 0.4   // s — release is a little quicker
const AGSM_FATIGUE_FULL_SEC    = 35  // s of maximal strain → fully fatigued
const AGSM_FATIGUE_RECOVER_SEC = 22  // s of relaxation → fully recovered
const AGSM_FATIGUE_PENALTY     = 0.55 // fully fatigued AGSM keeps only 45% of its bonus

// Incapacitation timeline.
const GLOC_ABSOLUTE_SEC = 9.0  // limp, no inputs
const RECOVERY_SEC      = 6.0  // relative incapacitation — vision + control ramp back

// Negative-G redout.
const REDOUT_ONSET_G = 2.0
const REDOUT_FULL_G  = 5.0

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export class GLOCModel {
  readonly state: GLOCState = {
    gTolerance: DEFAULT_GLOC_CONFIG.baseGTolerance + DEFAULT_GLOC_CONFIG.gSuitBonus,
    oxygenDebt: 0,
    reserveFraction: 1,
    greyout: 0,
    blackout: 0,
    redout: 0,
    agsmStrain: 0,
    agsmFatigue: 0,
    controlAuthority: 1,
    incapacitated: false,
    phase: 'NOMINAL',
  }

  private config: GLOCConfig
  private glocTimer = 0
  private recoveryTimer = 0

  constructor(config: Partial<GLOCConfig> = {}) {
    this.config = { ...DEFAULT_GLOC_CONFIG, ...config }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    if (!enabled) this.reset()
  }

  reset(): void {
    const s = this.state
    s.gTolerance = this.config.baseGTolerance + this.config.gSuitBonus
    s.oxygenDebt = 0
    s.reserveFraction = 1
    s.greyout = 0
    s.blackout = 0
    s.redout = 0
    s.agsmStrain = 0
    s.agsmFatigue = 0
    s.controlAuthority = 1
    s.incapacitated = false
    s.phase = 'NOMINAL'
    this.glocTimer = 0
    this.recoveryTimer = 0
  }

  /**
   * Advance the model one step.
   * @param gz  accelerometer Gz at the pilot's head (state.gCurrent). +ve = eyeballs-down.
   * @param dt  timestep in seconds.
   */
  update(gz: number, dt: number): void {
    const s = this.state
    if (!this.config.enabled || dt <= 0) {
      if (s.phase !== 'NOMINAL' || s.oxygenDebt !== 0) this.reset()
      return
    }

    const gzPos = Math.max(0, gz)
    const gzNeg = Math.max(0, -gz)

    // ── AGSM auto-strain ─────────────────────────────────────────────────────
    const agsmTarget = clamp((gzPos - AGSM_ONSET_G) / (AGSM_FULL_G - AGSM_ONSET_G), 0, 1)
    const tc = agsmTarget > s.agsmStrain ? AGSM_TENSE_TC : AGSM_RELAX_TC
    s.agsmStrain += (agsmTarget - s.agsmStrain) * (1 - Math.exp(-dt / tc))

    const fatigueBuild = Math.pow(s.agsmStrain, 1.5) / AGSM_FATIGUE_FULL_SEC
    const fatigueRecover = (1 - s.agsmStrain) / AGSM_FATIGUE_RECOVER_SEC
    s.agsmFatigue = clamp(s.agsmFatigue + (fatigueBuild - fatigueRecover) * dt, 0, 1)

    const agsmEffect = s.agsmStrain * (1 - AGSM_FATIGUE_PENALTY * s.agsmFatigue)
    s.gTolerance = this.config.baseGTolerance + this.config.gSuitBonus
                 + this.config.agsmBonusMax * agsmEffect

    // ── Oxygen-debt integrator ───────────────────────────────────────────────
    const overload = gzPos - s.gTolerance
    if (overload > 0) {
      s.oxygenDebt = Math.min(MAX_DEBT_G_S, s.oxygenDebt + Math.min(overload, MAX_DEPLETE_RATE_G) * dt)
    } else {
      const payDown = (-overload + DEBT_RECOVER_BASE) * DEBT_RECOVER_RATE
      s.oxygenDebt = Math.max(0, s.oxygenDebt - payDown * dt)
    }

    // ── Incapacitation state machine ─────────────────────────────────────────
    if (s.phase === 'GLOC') {
      // Consciousness only returns once the debt is actually falling back down.
      if (s.oxygenDebt < BLACKOUT_G_S) this.glocTimer -= dt
      if (this.glocTimer <= 0) {
        s.phase = 'RECOVERY'
        this.recoveryTimer = RECOVERY_SEC
      }
    } else if (s.phase === 'RECOVERY') {
      this.recoveryTimer -= dt
      if (s.oxygenDebt >= GLOC_G_S) {
        s.phase = 'GLOC'
        this.glocTimer = GLOC_ABSOLUTE_SEC
      } else if (this.recoveryTimer <= 0 && s.oxygenDebt < SYMPTOM_G_S) {
        s.phase = 'NOMINAL'
      }
    } else if (s.oxygenDebt >= GLOC_G_S) {
      s.phase = 'GLOC'
      this.glocTimer = GLOC_ABSOLUTE_SEC
    }

    // ── Negative-G redout (near-instantaneous, no cumulative LOC modelled) ────
    const redTarget = clamp((gzNeg - REDOUT_ONSET_G) / (REDOUT_FULL_G - REDOUT_ONSET_G), 0, 1)
    const redTc = redTarget > s.redout ? 0.25 : 0.5
    s.redout += (redTarget - s.redout) * (1 - Math.exp(-dt / redTc))

    // ── Vision + control outputs ─────────────────────────────────────────────
    const debtGrey  = smoothstep(GREY_START_G_S, GREY_FULL_G_S, s.oxygenDebt)
    const debtBlack = smoothstep(SYMPTOM_G_S, BLACKOUT_G_S, s.oxygenDebt)

    if (s.phase === 'GLOC') {
      s.greyout = 1
      s.blackout = 1
      s.controlAuthority = 0
      s.incapacitated = true
    } else if (s.phase === 'RECOVERY') {
      const f = 1 - clamp(this.recoveryTimer / RECOVERY_SEC, 0, 1) // 0 → 1 across recovery
      s.blackout = Math.max(debtBlack, 0.9 * (1 - f))
      s.greyout = Math.max(debtGrey, 0.6 * (1 - f))
      s.controlAuthority = 0.2 + 0.8 * f
      s.incapacitated = false
    } else {
      s.greyout = debtGrey
      s.blackout = debtBlack
      s.controlAuthority = 1
      s.incapacitated = false
      s.phase = debtBlack > 0.85 ? 'BLACKOUT' : debtGrey > 0.15 ? 'GREYOUT' : 'NOMINAL'
    }

    s.reserveFraction = clamp(1 - s.oxygenDebt / GLOC_G_S, 0, 1)
  }
}
