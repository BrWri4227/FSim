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

export class AudioManager {
  private ctx: AudioContext
  private engineOsc: OscillatorNode
  private engineGain: GainNode
  private radarToneOsc: OscillatorNode | null = null
  private radarToneGain: GainNode | null = null
  private radarToneInterval: ReturnType<typeof setInterval> | null = null
  private missileGrowlOsc: OscillatorNode | null = null
  private missileGrowlGain: GainNode | null = null
  private activeRWRMode: 'SEARCH' | 'TRACK' | 'LOCK' | 'INCOMING' | null = null

  constructor() {
    this.ctx = new AudioContext()

    // Engine tone
    this.engineOsc = this.ctx.createOscillator()
    this.engineOsc.type = 'sawtooth'
    this.engineOsc.frequency.value = 80
    this.engineGain = this.ctx.createGain()
    this.engineGain.gain.value = 0.04
    this.engineOsc.connect(this.engineGain)
    this.engineGain.connect(this.ctx.destination)
    this.engineOsc.start()
  }

  updateEngine(throttle: number, _mach: number): void {
    // Frequency 80 Hz at idle → 220 Hz at full AB
    const freq = 80 + throttle * 140
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.3)
    const vol = 0.02 + throttle * 0.06
    this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2)
  }

  setRWRMode(mode: 'SEARCH' | 'TRACK' | 'LOCK' | 'INCOMING' | null): void {
    if (mode === this.activeRWRMode) return
    this.activeRWRMode = mode
    this.stopRadarTone()
    if (!mode) return

    const intervalMs = mode === 'SEARCH' ? 1000
                     : mode === 'TRACK'  ? 333
                     : mode === 'LOCK'   ? 0   // continuous
                     : 100               // INCOMING rapid

    if (mode === 'LOCK') {
      this.playTone(880, 0.15, 0)
    } else {
      this.radarToneInterval = setInterval(() => this.playTone(660, 0.12, 0.08), intervalMs)
    }
  }

  setIRSeekerState(acquired: boolean, locked: boolean): void {
    if (locked) {
      if (this.missileGrowlOsc) return
      this.missileGrowlOsc = this.ctx.createOscillator()
      this.missileGrowlOsc.type = 'sawtooth'
      this.missileGrowlOsc.frequency.value = 400
      this.missileGrowlGain = this.ctx.createGain()
      this.missileGrowlGain.gain.value = 0.08
      // Growl modulation via rapid LFO
      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = 30
      const lfoGain = this.ctx.createGain()
      lfoGain.gain.value = 60
      lfo.connect(lfoGain)
      lfoGain.connect(this.missileGrowlOsc.frequency)
      lfo.start()
      this.missileGrowlOsc.connect(this.missileGrowlGain)
      this.missileGrowlGain.connect(this.ctx.destination)
      this.missileGrowlOsc.start()
    } else if (acquired) {
      this.stopMissileGrowl()
      this.playSweep(300, 600, 0.3, 0.1)
    } else {
      this.stopMissileGrowl()
    }
  }

  play(event: AudioEvent): void {
    switch (event) {
      case 'MISSILE_LAUNCH_IR':
        this.speak('Fox Two')
        break
      case 'MISSILE_LAUNCH_ARH':
        this.speak('Fox Three')
        break
      case 'PULL_UP':
        this.speak('Pull up, terrain')
        break
      case 'PULL_UP_URGENT':
        this.speak('Pull up, pull up')
        break
      case 'ENGINE_FLAMEOUT':
        this.speak('Engine flameout')
        this.engineGain.gain.setTargetAtTime(0.005, this.ctx.currentTime, 0.5)
        break
      case 'GUN_FIRE_20MM':
        this.playNoise(0.04, 0.05)
        break
      case 'GUN_FIRE_30MM':
        this.playNoise(0.08, 0.07)
        break
    }
  }

  update(player: import('../entities/PlayerAircraft').PlayerAircraft): void {
    this.resume()
    this.updateEngine(player.state.throttle, player.state.mach)

    // RWR tones
    const threats = player.rwr.state.threats
    const hasSTT  = threats.some(t => t.type === 'TRACK' && t.priority >= 3)
    const hasTrack = threats.some(t => t.type === 'TRACK')
    const hasScan  = threats.length > 0

    if (hasSTT)        this.setRWRMode('LOCK')
    else if (hasTrack) this.setRWRMode('TRACK')
    else if (hasScan)  this.setRWRMode('SEARCH')
    else               this.setRWRMode(null)
  }

  dispose(): void {
    this.stopRadarTone()
    this.stopMissileGrowl()
    try { this.engineOsc.stop() } catch { /* already stopped */ }
    try { this.ctx.close() } catch { /* already closed */ }
  }

  resume(): void {
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  private playTone(freq: number, gain: number, duration: number): void {
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.frequency.value = freq
    g.gain.value = gain
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start()
    if (duration > 0) {
      osc.stop(this.ctx.currentTime + duration)
    } else {
      if (this.radarToneOsc) { try { this.radarToneOsc.stop() } catch { /* already stopped */ } }
      this.radarToneOsc = osc
      this.radarToneGain = g
    }
  }

  private playSweep(startFreq: number, endFreq: number, duration: number, gain: number): void {
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + duration)
    g.gain.value = gain
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start()
    osc.stop(this.ctx.currentTime + duration)
  }

  private playNoise(gain: number, duration: number): void {
    const bufSize = Math.floor(this.ctx.sampleRate * duration)
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * gain
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.ctx.destination)
    src.start()
  }

  private speak(text: string): void {
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.2
    utt.pitch = 0.9
    speechSynthesis.speak(utt)
  }

  private stopRadarTone(): void {
    if (this.radarToneInterval !== null) {
      clearInterval(this.radarToneInterval)
      this.radarToneInterval = null
    }
    if (this.radarToneOsc) {
      try { this.radarToneOsc.stop() } catch { /* already stopped */ }
      this.radarToneOsc = null
    }
  }

  private stopMissileGrowl(): void {
    if (this.missileGrowlOsc) {
      try { this.missileGrowlOsc.stop() } catch { /* already stopped */ }
      this.missileGrowlOsc = null
      this.missileGrowlGain = null
    }
  }
}
