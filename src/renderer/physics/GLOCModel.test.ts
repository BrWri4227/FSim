import { describe, it, expect } from 'vitest'
import { GLOCModel } from './GLOCModel'

const DT = 1 / 60

/** Hold a constant Gz for `seconds` and return the model. */
function hold(model: GLOCModel, gz: number, seconds: number): GLOCModel {
  const steps = Math.round(seconds / DT)
  for (let i = 0; i < steps; i++) model.update(gz, DT)
  return model
}

describe('GLOCModel', () => {
  it('does nothing at 1 G — full reserve, no vision loss', () => {
    const m = new GLOCModel()
    hold(m, 1, 60)
    expect(m.state.oxygenDebt).toBe(0)
    expect(m.state.reserveFraction).toBe(1)
    expect(m.state.greyout).toBe(0)
    expect(m.state.blackout).toBe(0)
    expect(m.state.phase).toBe('NOMINAL')
    expect(m.state.controlAuthority).toBe(1)
  })

  it('AGSM ramps in with G and raises tolerance well above the relaxed 5 G', () => {
    const m = new GLOCModel()
    // Relaxed baseline (base 4 + suit 1) before any straining.
    expect(m.state.gTolerance).toBeCloseTo(5, 1)
    hold(m, 6, 3)
    expect(m.state.agsmStrain).toBeGreaterThan(0.8)
    expect(m.state.gTolerance).toBeGreaterThan(7.5)
  })

  it('sustained 9 G drives greyout then blackout then G-LOC in a realistic order', () => {
    const m = new GLOCModel()
    hold(m, 9, 6)
    expect(m.state.greyout).toBeGreaterThan(0)           // peripheral symptoms first
    expect(m.state.blackout).toBeLessThan(m.state.greyout) // grey leads the tunnel
    const greyMid = m.state.greyout
    hold(m, 9, 10)
    expect(m.state.blackout).toBeGreaterThan(0.4)        // tunnel closing down
    expect(m.state.greyout).toBeGreaterThanOrEqual(greyMid)
    hold(m, 9, 30)
    expect(m.state.phase).toBe('GLOC')                   // unconscious
    expect(m.state.incapacitated).toBe(true)
    expect(m.state.controlAuthority).toBe(0)
  })

  it('AGSM makes 7 G survivable far longer than the relaxed tolerance would allow', () => {
    const strained = hold(new GLOCModel(), 7, 12)
    expect(strained.state.phase).not.toBe('GLOC')
    expect(strained.state.reserveFraction).toBeGreaterThan(0.3)
  })

  it('AGSM fatigues over a long hard pull, lowering effective tolerance', () => {
    const m = new GLOCModel()
    hold(m, 7, 1)                       // strain established, not yet tired
    const freshTol = m.state.gTolerance
    hold(m, 7, 40)                      // long sustained pull
    expect(m.state.agsmFatigue).toBeGreaterThan(0.6)
    expect(m.state.gTolerance).toBeLessThan(freshTol - 0.8)
  })

  it('fatigue recovers when the pilot unloads between pulls', () => {
    const m = new GLOCModel()
    hold(m, 8, 25)
    const tired = m.state.agsmFatigue
    expect(tired).toBeGreaterThan(0.4)
    hold(m, 1, 30)
    expect(m.state.agsmFatigue).toBeLessThan(tired - 0.3)
  })

  it('unloading pays down the oxygen debt and clears the vignette', () => {
    const m = new GLOCModel()
    hold(m, 9, 5)
    expect(m.state.oxygenDebt).toBeGreaterThan(2)
    hold(m, 1, 15)
    expect(m.state.oxygenDebt).toBe(0)
    expect(m.state.blackout).toBeLessThan(0.01)
    expect(m.state.phase).toBe('NOMINAL')
  })

  it('recovers through relative incapacitation after a G-LOC once G is relieved', () => {
    const m = new GLOCModel()
    hold(m, 9, 30)
    expect(m.state.phase).toBe('GLOC')
    // Relieve G — debt pays down, then absolute incapacitation runs ~9 s, then a ramp.
    hold(m, 1, 16)
    expect(m.state.phase).toBe('RECOVERY')
    expect(m.state.incapacitated).toBe(false)
    expect(m.state.controlAuthority).toBeGreaterThan(0.2)
    expect(m.state.controlAuthority).toBeLessThan(1)
    hold(m, 1, 10)
    expect(m.state.phase).toBe('NOMINAL')
    expect(m.state.controlAuthority).toBe(1)
  })

  it('stays unconscious while the aircraft keeps pulling G', () => {
    const m = new GLOCModel()
    hold(m, 9, 30)
    expect(m.state.phase).toBe('GLOC')
    hold(m, 9, 12)            // jet trimmed nose-up, still cranking
    expect(m.state.phase).toBe('GLOC')
    expect(m.state.incapacitated).toBe(true)
  })

  it('produces negative-G redout without cumulative unconsciousness', () => {
    const m = new GLOCModel()
    hold(m, -4, 3)
    expect(m.state.redout).toBeGreaterThan(0.4)
    expect(m.state.blackout).toBe(0)
    expect(m.state.phase).toBe('NOMINAL')
  })

  it('is inert when disabled', () => {
    const m = new GLOCModel({ enabled: false })
    hold(m, 9, 30)
    expect(m.state.oxygenDebt).toBe(0)
    expect(m.state.blackout).toBe(0)
    expect(m.state.incapacitated).toBe(false)
    expect(m.state.controlAuthority).toBe(1)
  })

  it('setEnabled(false) resets an in-progress G-LOC', () => {
    const m = new GLOCModel()
    hold(m, 9, 30)
    expect(m.state.incapacitated).toBe(true)
    m.setEnabled(false)
    expect(m.state.phase).toBe('NOMINAL')
    expect(m.state.controlAuthority).toBe(1)
  })

  it('a brief high-G jerk does not cause instant G-LOC (functional buffer)', () => {
    const m = new GLOCModel()
    hold(m, 9, 0.8)          // snap pull, quickly released
    expect(m.state.phase).not.toBe('GLOC')
    expect(m.state.blackout).toBeLessThan(0.5)
    hold(m, 1, 5)
    expect(m.state.phase).toBe('NOMINAL')
  })
})
