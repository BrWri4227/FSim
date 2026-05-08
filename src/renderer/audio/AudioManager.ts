import type { ControlInputs } from '../types/aircraft'

export type AudioEvent =
  | 'RADAR_SEARCH'
  | 'RADAR_TRACK'
  | 'RADAR_LOCK'
  | 'MISSILE_INCOMING'
  | 'IR_ACQUIRE'
  | 'IR_LOCK'
  | 'MISSILE_LAUNCH_IR'
  | 'MISSILE_LAUNCH_ARH'
  | 'GUN_FIRE_20MM'
  | 'GUN_FIRE_30MM'
  | 'PULL_UP'
  | 'PULL_UP_URGENT'
  | 'ENGINE_FLAMEOUT'

// ─────────────────────────────────────────────────────────────────────────────
// AudioManager
// All synthesis is done with the Web Audio API — no external files required.
// ─────────────────────────────────────────────────────────────────────────────
export class AudioManager {
  private ctx: AudioContext

  // Engine
  private engineOsc: OscillatorNode
  private engineGain: GainNode

  // RWR / radar tones
  private radarToneOsc: OscillatorNode | null = null
  private radarToneGain: GainNode | null = null
  private radarToneInterval: ReturnType<typeof setInterval> | null = null
  private activeRWRMode: 'SEARCH' | 'TRACK' | 'LOCK' | 'INCOMING' | null = null

  // IR seeker growl  (AIM-9 / R-73 lock tone)
  private growlCarrier: OscillatorNode | null = null
  private growlAmpGain: GainNode | null = null
  private growlFmOsc:   OscillatorNode | null = null
  private growlAmOsc:   OscillatorNode | null = null
  private growlLocked = false

  // Cannon (M61A1 / GSh-30)
  private gunOsc:    OscillatorNode | null = null
  private gunModOsc: OscillatorNode | null = null
  private gunGain:   GainNode | null = null
  private gunFiring  = false

  constructor() {
    this.ctx = new AudioContext()

    // ── Engine tone ──────────────────────────────────────────────────────────
    // Sawtooth oscillator pitch-shifted by throttle, light low-pass for warmth.
    this.engineOsc  = this.ctx.createOscillator()
    this.engineOsc.type = 'sawtooth'
    this.engineOsc.frequency.value = 80
    this.engineGain = this.ctx.createGain()
    this.engineGain.gain.value = 0.04

    const engineLP = this.ctx.createBiquadFilter()
    engineLP.type = 'lowpass'
    engineLP.frequency.value = 600

    this.engineOsc.connect(engineLP)
    engineLP.connect(this.engineGain)
    this.engineGain.connect(this.ctx.destination)
    this.engineOsc.start()
  }

  // ── Public update called every frame ──────────────────────────────────────

  update(player: import('../entities/PlayerAircraft').PlayerAircraft, controls?: ControlInputs): void {
    this.resume()
    this.updateEngine(player.state.throttle, player.state.mach)

    // Gun sound — start/stop based on fireGun control.
    // Derive caliber from rate of fire: M61A1 = 6000 RPM (20mm), GSh-30 = ~1800 RPM (30mm)
    if (controls) {
      const isFiring = controls.fireGun && player.gun.getRoundsRemaining() > 0
      const rpm      = player.spec.gunSpec?.rateOfFireRPM ?? 6000
      const caliber: '20mm' | '30mm' = rpm > 3000 ? '20mm' : '30mm'
      if (isFiring && !this.gunFiring) this.startGun(caliber)
      if (!isFiring && this.gunFiring)  this.stopGun()
    }

    // IR seeker growl — check if an IR missile is selected and seeker acquiring/locked
    const irStore = player.state.loadedStores.find(
      s => s.category === 'IR_MISSILE' && s.remainingRounds > 0
    )
    const enemies: import('../entities/Aircraft').Aircraft[] = (window as any)._fsimEnemies ?? []
    if (irStore && enemies.length > 0) {
      // IR seeker tone: target must be in the FORWARD hemisphere (within ≈50° of nose)
      // and within range. A target behind the aircraft produces no tone.
      const playerVel = player.state.velocityNED
      const playerPos = player.state.positionNED
      const fwdSpd = Math.sqrt(playerVel[0]**2 + playerVel[1]**2 + playerVel[2]**2) || 1

      let bestD = Infinity
      let bestInFront = false
      for (const e of enemies) {
        const d = dist3(e.state.positionNED as [number,number,number], playerPos as [number,number,number])
        if (d < bestD) {
          bestD = d
          // Dot product of (target - own) with own velocity vector
          const dx = e.state.positionNED[0] - playerPos[0]
          const dy = e.state.positionNED[1] - playerPos[1]
          const dz = e.state.positionNED[2] - playerPos[2]
          const dot = (dx * playerVel[0] + dy * playerVel[1] + dz * playerVel[2]) / (d * fwdSpd)
          bestInFront = dot > 0.64  // cos(50°) ≈ 0.64 — within ±50° of nose
        }
      }
      const locked   = bestD < 5000  && bestInFront
      const acquired = bestD < 15000 && bestInFront
      this.setIRSeekerState(acquired, locked)
    } else {
      this.setIRSeekerState(false, false)
    }

    // RWR tones
    const threats  = player.rwr.state.threats
    const hasSTT   = threats.some(t => t.type === 'TRACK' && t.priority >= 3)
    const hasTrack = threats.some(t => t.type === 'TRACK')
    const hasScan  = threats.length > 0

    if (hasSTT)        this.setRWRMode('LOCK')
    else if (hasTrack) this.setRWRMode('TRACK')
    else if (hasScan)  this.setRWRMode('SEARCH')
    else               this.setRWRMode(null)
  }

  // ── One-shot audio events ─────────────────────────────────────────────────

  play(event: AudioEvent): void {
    switch (event) {
      case 'MISSILE_LAUNCH_IR':   this.speak('Fox Two');          break
      case 'MISSILE_LAUNCH_ARH':  this.speak('Fox Three');        break
      case 'PULL_UP':             this.speak('Pull up, terrain'); break
      case 'PULL_UP_URGENT':      this.speak('Pull up, pull up'); break
      case 'ENGINE_FLAMEOUT':
        this.speak('Engine flameout')
        this.engineGain.gain.setTargetAtTime(0.005, this.ctx.currentTime, 0.5)
        break
    }
  }

  // ── Engine ────────────────────────────────────────────────────────────────

  private updateEngine(throttle: number, _mach: number): void {
    // 80 Hz idle → 280 Hz full afterburner
    const freq = 80 + throttle * 200
    const vol  = 0.02 + throttle * 0.07
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.3)
    this.engineGain.gain.setTargetAtTime(vol,  this.ctx.currentTime, 0.2)
  }

  // ── M61A1 / GSh-30 cannon BRRRT ──────────────────────────────────────────
  //
  // Synthesis: FM sawtooth carrier (base freq = firing rate) → bandpass filter.
  // The firing rate modulates the carrier frequency giving the mechanical "chug".
  // 20 mm: 6000 RPM = 100 Hz carrier → bright metallic tear
  // 30 mm: 1800 RPM = 30 Hz carrier  → heavy percussive thud chain

  private startGun(caliber: '20mm' | '30mm'): void {
    if (this.gunFiring) return
    this.gunFiring = true
    const ctx = this.ctx

    const rateHz   = caliber === '20mm' ? 100 : 30
    const baseFreq = caliber === '20mm' ? 140 : 80   // mechanical resonance
    const fmDepth  = caliber === '20mm' ? 60  : 30   // ±Hz frequency wobble
    const bpFreq   = caliber === '20mm' ? 900 : 250  // bandpass centre
    const gain     = caliber === '20mm' ? 0.22 : 0.40

    // Carrier — sawtooth for gritty metallic texture
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = baseFreq

    // FM modulator — same frequency as firing rate gives per-shot pulse feel
    const modOsc = ctx.createOscillator()
    modOsc.type = 'square'
    modOsc.frequency.value = rateHz
    const modGainNode = ctx.createGain()
    modGainNode.gain.value = fmDepth
    modOsc.connect(modGainNode)
    modGainNode.connect(osc.frequency)   // FM: modulates pitch

    // Bandpass to shape tone
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = bpFreq
    bp.Q.value = 1.8

    // Soft high-shelf to add crack on 20 mm
    const shelf = ctx.createBiquadFilter()
    shelf.type = 'highshelf'
    shelf.frequency.value = 2000
    shelf.gain.value = caliber === '20mm' ? 8 : 0

    const gainNode = ctx.createGain()
    gainNode.gain.value = gain

    osc.connect(bp)
    bp.connect(shelf)
    shelf.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start()
    modOsc.start()

    this.gunOsc    = osc
    this.gunModOsc = modOsc
    this.gunGain   = gainNode
  }

  private stopGun(): void {
    if (!this.gunFiring) return
    this.gunFiring = false
    const now = this.ctx.currentTime
    // Quick 60 ms fade-out so the burst doesn't click
    this.gunGain?.gain.setTargetAtTime(0, now, 0.02)
    const osc    = this.gunOsc
    const modOsc = this.gunModOsc
    setTimeout(() => {
      try { osc?.stop()    } catch { /* already stopped */ }
      try { modOsc?.stop() } catch { /* already stopped */ }
    }, 80)
    this.gunOsc    = null
    this.gunModOsc = null
    this.gunGain   = null
  }

  // ── AIM-9 / R-73 IR seeker growl ─────────────────────────────────────────
  //
  // Synthesis:
  //   • Sawtooth carrier at ~480 Hz (the seeker gyro/cooling noise pitch)
  //   • FM LFO at ~40 Hz with deep index → creates the characteristic pitch warble
  //   • AM LFO at ~38 Hz (slightly offset from FM for complexity) → amplitude rattle
  //     that gives the "rattlesnake" / "GROWL" sensation
  //   • Cold (acquiring): lower amplitude, slower LFOs, lower carrier
  //   • Hot (locked):     higher amplitude, faster LFOs, higher carrier

  private startGrowl(locked: boolean): void {
    this.stopGrowl()
    const ctx = this.ctx

    const carrierFreq = locked ? 480 : 340
    const fmRate      = locked ? 42  : 22   // Hz wobble rate
    const fmDepth     = locked ? 130 : 60   // ±Hz
    const amRate      = locked ? 38  : 18   // Hz rattle rate
    const baseGain    = locked ? 0.11 : 0.05
    const amDepth     = locked ? 0.08 : 0.04

    // ── Carrier
    const carrier = ctx.createOscillator()
    carrier.type = 'sawtooth'
    carrier.frequency.value = carrierFreq

    // ── FM (pitch wobble → rattlesnake quality)
    const fmOsc  = ctx.createOscillator()
    fmOsc.frequency.value = fmRate
    const fmGain = ctx.createGain()
    fmGain.gain.value = fmDepth
    fmOsc.connect(fmGain)
    fmGain.connect(carrier.frequency)

    // ── AM (amplitude rattle → the iconic "growl" character)
    //    ampGain.gain starts at baseGain; amOsc adds ±amDepth on top.
    //    Result: gain oscillates between (baseGain - amDepth) and (baseGain + amDepth)
    const amOsc  = ctx.createOscillator()
    amOsc.frequency.value = amRate
    const amScaleGain = ctx.createGain()
    amScaleGain.gain.value = amDepth
    amOsc.connect(amScaleGain)

    const ampGain = ctx.createGain()
    ampGain.gain.value = baseGain
    amScaleGain.connect(ampGain.gain)  // AM modulates the amp gain

    // ── Slight high-pass to cut mud
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 200

    carrier.connect(hp)
    hp.connect(ampGain)
    ampGain.connect(ctx.destination)

    carrier.start()
    fmOsc.start()
    amOsc.start()

    this.growlCarrier  = carrier
    this.growlAmpGain  = ampGain
    this.growlFmOsc    = fmOsc
    this.growlAmOsc    = amOsc
    this.growlLocked   = locked
  }

  private stopGrowl(): void {
    const now = this.ctx.currentTime
    this.growlAmpGain?.gain.setTargetAtTime(0, now, 0.05)
    const c = this.growlCarrier, f = this.growlFmOsc, a = this.growlAmOsc
    setTimeout(() => {
      try { c?.stop() } catch { /* */ }
      try { f?.stop() } catch { /* */ }
      try { a?.stop() } catch { /* */ }
    }, 100)
    this.growlCarrier = null
    this.growlAmpGain = null
    this.growlFmOsc   = null
    this.growlAmOsc   = null
    this.growlLocked  = false
  }

  setIRSeekerState(acquired: boolean, locked: boolean): void {
    if (locked) {
      if (this.growlCarrier && this.growlLocked) return   // already hot
      this.startGrowl(true)
    } else if (acquired) {
      if (this.growlCarrier && !this.growlLocked) return  // already cold
      this.startGrowl(false)
    } else {
      if (!this.growlCarrier) return
      this.stopGrowl()
    }
  }

  // ── RWR radar warning tones ───────────────────────────────────────────────

  setRWRMode(mode: 'SEARCH' | 'TRACK' | 'LOCK' | 'INCOMING' | null): void {
    if (mode === this.activeRWRMode) return
    this.activeRWRMode = mode
    this.stopRadarTone()
    if (!mode) return

    if (mode === 'LOCK') {
      this.playTone(880, 0.15, 0)   // continuous STT lock
    } else {
      const ms = mode === 'SEARCH' ? 1000 : mode === 'TRACK' ? 333 : 100
      this.radarToneInterval = setInterval(() => this.playTone(660, 0.12, 0.08), ms)
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.stopGun()
    this.stopGrowl()
    this.stopRadarTone()
    try { this.engineOsc.stop() } catch { /* */ }
    try { this.ctx.close()      } catch { /* */ }
  }

  resume(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private playTone(freq: number, gain: number, duration: number): void {
    const osc = this.ctx.createOscillator()
    const g   = this.ctx.createGain()
    osc.frequency.value = freq
    g.gain.value = gain
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start()
    if (duration > 0) {
      osc.stop(this.ctx.currentTime + duration)
    } else {
      if (this.radarToneOsc) { try { this.radarToneOsc.stop() } catch { /* */ } }
      this.radarToneOsc  = osc
      this.radarToneGain = g
    }
  }

  private stopRadarTone(): void {
    if (this.radarToneInterval !== null) { clearInterval(this.radarToneInterval); this.radarToneInterval = null }
    if (this.radarToneOsc) { try { this.radarToneOsc.stop() } catch { /* */ }; this.radarToneOsc = null }
  }

  private speak(text: string): void {
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate  = 1.2
    utt.pitch = 0.9
    speechSynthesis.speak(utt)
  }
}

function dist3(a: [number,number,number], b: [number,number,number]): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)
}
