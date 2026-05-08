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
  | 'PITBULL'
  | 'SHOOT'
  | 'GUN_FIRE_20MM'
  | 'GUN_FIRE_30MM'
  | 'PULL_UP'
  | 'PULL_UP_URGENT'
  | 'ENGINE_FLAMEOUT'

// ─────────────────────────────────────────────────────────────────────────────
// Sound file map
//
// Drop WAV or MP3 files into public/sounds/ (or the path you pass to loadSounds).
// Files that exist replace the synthesized equivalent; missing files fall back
// automatically to the Web-Audio synthesis paths.
//
// Recommended filenames (stereo or mono, any sample rate — the browser resamples):
//
//   engine_idle.wav        — jet engine at idle thrust
//   engine_mil.wav         — military (dry) power
//   engine_ab.wav          — full afterburner
//   engine_flameout.wav    — engine wind-down / compressor stall
//   gun_20mm.wav           — M61A1 burst (looped)
//   gun_30mm.wav           — GSh-30 burst (looped)
//   ir_growl_cold.wav      — AIM-9 / R-73 seeker acquiring (looped)
//   ir_growl_hot.wav       — AIM-9 / R-73 seeker locked   (looped)
//   rwr_search.wav         — single RWR search ping
//   rwr_track.wav          — RWR track ping (faster than search)
//   rwr_lock.wav           — RWR continuous lock tone (looped)
//   missile_launch.wav     — missile motor ignition
//   pitbull.wav            — "pitbull" callout
//   shoot.wav              — "shoot" callout
//   pull_up.wav            — GPWS "pull up" voice
//   pull_up_urgent.wav     — GPWS "pull up pull up" voice
// ─────────────────────────────────────────────────────────────────────────────

const SOUND_FILES: Record<string, string> = {
  engine_idle:       'engine_idle.wav',
  engine_ab:         'engine_ab.wav',
  engine_flameout:   'engine_flameout.wav',
  gun_20mm:          'gun_20mm.wav',
  gun_30mm:          'gun_30mm.wav',
  ir_growl_cold:     'ir_growl_cold.wav',
  ir_growl_hot:      'ir_growl_hot.wav',
  chaff:             'chaff.wav',
  flare:             'flare.wav',
  rwr_search:        'rwr_search.wav',
  rwr_track:         'rwr_track.wav',
  rwr_lock:          'rwr_lock.wav',
  rwr_launch:        'rwr_launch.wav',
  missile_launch:    'missile_launch.wav',
  pitbull:           'pitbull.wav',
  shoot:             'shoot.wav',
  pull_up:           'pull_up.wav',
  pull_up_urgent:    'pull_up_urgent.wav',
}

export class AudioManager {
  private ctx: AudioContext

  // ── Sound buffer cache ──────────────────────────────────────────────────
  private buffers = new Map<string, AudioBuffer>()
  private soundsBasePath = 'sounds/'
  private soundsLoadFinished = false

  // ── Engine (synthesis fallback) ─────────────────────────────────────────
  private engineOsc:  OscillatorNode
  private engineGain: GainNode
  private engineLP:   BiquadFilterNode
  // File-based engine looping nodes
  private engineSrc:  AudioBufferSourceNode | null = null
  private engineSrcGain: GainNode | null = null
  private useFileEngine = false

  // ── RWR / radar tones ───────────────────────────────────────────────────
  private radarToneOsc:      OscillatorNode | null = null
  private radarToneGain:     GainNode | null = null
  private radarToneInterval: ReturnType<typeof setInterval> | null = null
  private radarLockSrc:      AudioBufferSourceNode | null = null
  private activeRWRMode: 'TRACK' | 'LOCK' | 'INCOMING' | null = null
  private prevHasMissile = false
  private seenSearchIds = new Set<string>()
  private prevFlareCount = -1
  private prevChaffCount = -1

  // ── IR seeker growl ─────────────────────────────────────────────────────
  private growlCarrier: OscillatorNode | null = null
  private growlAmpGain: GainNode | null = null
  private growlFmOsc:   OscillatorNode | null = null
  private growlFmGain:  GainNode | null = null
  private growlAmOsc:   OscillatorNode | null = null
  private growlAmGain:  GainNode | null = null
  private growlSrc:     AudioBufferSourceNode | null = null
  private growlSrcGain: GainNode | null = null
  private growlLocked = false

  // ── Cannon ──────────────────────────────────────────────────────────────
  private gunOsc:    OscillatorNode | null = null
  private gunModOsc: OscillatorNode | null = null
  private gunGain:   GainNode | null = null
  private gunSrc:    AudioBufferSourceNode | null = null
  private gunFiring  = false

  // ── Master gain (global volume) ─────────────────────────────────────────
  private masterGain: GainNode

  constructor() {
    this.ctx = new AudioContext()

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 1.0
    this.masterGain.connect(this.ctx.destination)

    // ── Synthesized engine tone (used until file loads) ──────────────────
    this.engineOsc  = this.ctx.createOscillator()
    this.engineOsc.type = 'sawtooth'
    this.engineOsc.frequency.value = 80

    this.engineLP = this.ctx.createBiquadFilter()
    this.engineLP.type = 'lowpass'
    this.engineLP.frequency.value = 600

    this.engineGain = this.ctx.createGain()
    this.engineGain.gain.value = 0.04

    this.engineOsc.connect(this.engineLP)
    this.engineLP.connect(this.engineGain)
    this.engineGain.connect(this.masterGain)
    this.engineOsc.start()
  }

  // ── Sound file loading ──────────────────────────────────────────────────

  /**
   * Load all sound files from basePath (default: "sounds/").
   * Call once at startup. Missing files are silently skipped — synthesis fills in.
   *
   * Drop WAV/MP3 files into src/renderer/public/sounds/ — Vite serves them at /sounds/.
   * Works in both electron-vite dev mode (http://localhost) and production (file://).
   */
  async loadSounds(basePath?: string): Promise<void> {
    if (basePath) this.soundsBasePath = basePath
    this.soundsLoadFinished = false

    const baseCandidates = await this.getSoundBaseCandidates()
    const loads = Object.entries(SOUND_FILES).map(async ([key, file]) => {
      let loaded = false
      let lastDecodeError: unknown = null
      for (const base of baseCandidates) {
        const url = base + file
        try {
          const arrayBuf = await this.fetchArrayBuffer(url)
          if (!arrayBuf) continue
          const audioBuf = await this.ctx.decodeAudioData(arrayBuf)
          this.buffers.set(key, audioBuf)
          console.log(`[Audio] Loaded ${file} from ${base}`)
          loaded = true
          break
        } catch (err) {
          lastDecodeError = err
        }
      }
      if (!loaded) {
        if (lastDecodeError) {
          console.warn(`[Audio] Failed to decode ${file}; synthesis fallback active.`, lastDecodeError)
        } else {
          console.warn(`[Audio] Missing sound file ${file}; synthesis fallback active.`)
        }
      }
    })
    await Promise.allSettled(loads)
    this.soundsLoadFinished = true

    console.log(`[Audio] ${this.buffers.size} / ${Object.keys(SOUND_FILES).length} sound files loaded.`)

    if (this.buffers.has('engine_idle')) {
      this.startFileEngine()
    }
  }

  private normalizeSoundBase(base: string): string {
    // Build an absolute base URL that works under both http:// (dev) and file:// (prod).
    // Relative paths are resolved against the current page URL.
    let out = base
    if (!out.startsWith('http://') && !out.startsWith('https://') && !out.startsWith('file://')) {
      const pageDir = window.location.href.replace(/\/[^/]*$/, '/')
      out = pageDir + out
    }
    if (!out.endsWith('/')) out += '/'
    return out
  }

  private async getSoundBaseCandidates(): Promise<string[]> {
    const out = new Set<string>()
    out.add(this.normalizeSoundBase(this.soundsBasePath))

    try {
      const getAudioBaseUrls = (window as unknown as {
        fsim?: { assets?: { getAudioBaseUrls?: () => Promise<{ urls: string[] }> } }
      }).fsim?.assets?.getAudioBaseUrls

      if (typeof getAudioBaseUrls === 'function') {
        const payload = await getAudioBaseUrls()
        for (const raw of payload.urls ?? []) {
          if (typeof raw === 'string' && raw.length > 0) out.add(this.normalizeSoundBase(raw))
        }
      }
    } catch {
      // Ignore bridge failures and continue with local relative path fallback.
    }

    return [...out]
  }

  /** Fetch raw bytes — uses fetch first, falls back to XHR for file:// Electron environments. */
  private fetchArrayBuffer(url: string): Promise<ArrayBuffer | null> {
    return fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .catch(() => new Promise<ArrayBuffer | null>(resolve => {
        const xhr = new XMLHttpRequest()
        xhr.open('GET', url, true)
        xhr.responseType = 'arraybuffer'
        xhr.onload  = () => resolve(xhr.status === 200 || xhr.status === 0 ? xhr.response as ArrayBuffer : null)
        xhr.onerror = () => resolve(null)
        xhr.send()
      }))
  }

  // ── Buffer playback helpers ─────────────────────────────────────────────

  /** Play a one-shot sound buffer. Returns the source node so you can stop it. */
  private playOnce(key: string, gainVal = 1.0): AudioBufferSourceNode | null {
    const buf = this.buffers.get(key)
    if (!buf) return null
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const g = this.ctx.createGain()
    g.gain.value = gainVal
    src.connect(g)
    g.connect(this.masterGain)
    src.start()
    return src
  }

  /** Start a looping sound buffer. Caller owns the returned nodes and must stop them. */
  private startLoop(key: string, gainVal = 1.0): [AudioBufferSourceNode, GainNode] | null {
    const buf = this.buffers.get(key)
    if (!buf) return null
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = this.ctx.createGain()
    g.gain.value = gainVal
    src.connect(g)
    g.connect(this.masterGain)
    src.start()
    return [src, g]
  }

  private stopLoop(src: AudioBufferSourceNode | null, g: GainNode | null): void {
    if (!src) return
    try {
      if (g) {
        g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04)
        setTimeout(() => { try { src.stop() } catch { /* */ } }, 100)
      } else {
        src.stop()
      }
    } catch { /* */ }
  }

  // ── Public update called every frame ─────────────────────────────────────

  update(player: import('../entities/PlayerAircraft').PlayerAircraft, controls?: ControlInputs): void {
    this.resume()
    this.updateEngine(player.state.throttle, player.state.mach, player.damage.engineFailed)

    // Gun
    if (controls) {
      const isFiring = controls.fireGun && player.gun.getRoundsRemaining() > 0
      const rpm      = player.spec.gunSpec?.rateOfFireRPM ?? 6000
      const caliber: '20mm' | '30mm' = rpm > 3000 ? '20mm' : '30mm'
      if (isFiring && !this.gunFiring) this.startGun(caliber)
      if (!isFiring && this.gunFiring)  this.stopGun()
    }

    // Countermeasures
    const fc = player.cmds.flareCount, cc = player.cmds.chaffCount
    if (this.prevFlareCount >= 0 && fc < this.prevFlareCount) this.playOnce('flare', 0.7)
    if (this.prevChaffCount >= 0 && cc < this.prevChaffCount) this.playOnce('chaff', 0.7)
    this.prevFlareCount = fc
    this.prevChaffCount = cc

    // IR seeker growl
    const selectedWeaponId = player.getSelectedWeaponName().toLowerCase()
    const irStore = player.state.loadedStores.find(s =>
      s.category === 'IR_MISSILE' &&
      s.remainingRounds > 0 &&
      s.weaponId === selectedWeaponId
    )
    const enemies: import('../entities/Aircraft').Aircraft[] = (window as any)._fsimEnemies ?? []
    if (irStore) {
      // Baseline "searching" growl as soon as an IR missile is selected.
      let acquired = true
      let locked = false
      let strength = 0.14

      if (enemies.length > 0) {
        const playerVel = player.state.velocityNED
        const playerPos = player.state.positionNED
        const fwdSpd = Math.sqrt(playerVel[0]**2 + playerVel[1]**2 + playerVel[2]**2) || 1

        let bestD = Infinity, bestInFront = false
        let bestDot = -1
        for (const e of enemies) {
          const d = dist3(e.state.positionNED as [number,number,number], playerPos as [number,number,number])
          if (d < bestD) {
            bestD = d
            const dx = e.state.positionNED[0] - playerPos[0]
            const dy = e.state.positionNED[1] - playerPos[1]
            const dz = e.state.positionNED[2] - playerPos[2]
            const dot = (dx * playerVel[0] + dy * playerVel[1] + dz * playerVel[2]) / Math.max(d * fwdSpd, 1)
            bestDot = dot
            bestInFront = dot > 0.64
          }
        }
        locked   = bestD < 5000  && bestInFront
        acquired = bestD < 15000 && bestDot > 0.35
        const rangeStrength = clamp01((15000 - bestD) / 12000) // 0 at ~15 km, 1 by ~3 km
        const aspectStrength = clamp01((bestDot - 0.35) / 0.65)
        const strengthRaw = 0.6 * rangeStrength + 0.4 * aspectStrength
        const lockStrength = locked ? Math.max(strengthRaw, 0.8) : strengthRaw
        strength = acquired ? clamp01(lockStrength) : strength
      }

      this.setIRSeekerState(acquired, locked, strength)
    } else {
      this.setIRSeekerState(false, false, 0)
    }

    // RWR tones — priority: MISSILE > STT LOCK > TRACK > SEARCH
    const rwrState = player.rwr.state
    const threats  = rwrState.threats
    const hasMissile = threats.some(t => t.type === 'MISSILE')
    const hasSTT     = threats.some(t => t.type === 'TRACK' && t.priority >= 4)
    const hasTrack   = threats.some(t => t.type === 'TRACK')

    // SEARCH: one-shot ping per newly-detected target (never loops)
    const currentSearchIds = new Set(threats.filter(t => t.type === 'SEARCH').map(t => t.entityId))
    for (const id of currentSearchIds) {
      if (!this.seenSearchIds.has(id)) {
        if (!this.playOnce('rwr_search', 0.45)) this.playTone(660, 0.12, 0.08)
      }
    }
    this.seenSearchIds = currentSearchIds

    // Voice callout on new missile detection
    if (rwrState.hasMissileLaunch && !this.prevHasMissile) {
      this.speak('Missile launch')
    }
    this.prevHasMissile = hasMissile

    if (hasMissile)    this.setRWRMode('INCOMING')
    else if (hasSTT)   this.setRWRMode('LOCK')
    else if (hasTrack) this.setRWRMode('TRACK')
    else               this.setRWRMode(null)
  }

  // ── One-shot audio events ─────────────────────────────────────────────────

  play(event: AudioEvent): void {
    switch (event) {
      case 'MISSILE_LAUNCH_IR':
        if (!this.playOnce('missile_launch', 0.8)) this.speak('Fox Two')
        else this.speak('Fox Two')
        break
      case 'MISSILE_LAUNCH_ARH':
        if (!this.playOnce('missile_launch', 0.8)) this.speak('Fox Three')
        else this.speak('Fox Three')
        break
      case 'PITBULL':
        if (!this.playOnce('pitbull', 0.9)) this.speak('Pitbull')
        else this.speak('Pitbull')
        break
      case 'SHOOT':
        if (!this.playOnce('shoot', 0.95)) this.speak('Shoot')
        else this.speak('Shoot')
        break
      case 'PULL_UP':
        if (!this.playOnce('pull_up', 0.9)) this.speak('Pull up, terrain')
        break
      case 'PULL_UP_URGENT':
        if (!this.playOnce('pull_up_urgent', 1.0)) this.speak('Pull up, pull up')
        break
      case 'ENGINE_FLAMEOUT':
        if (!this.playOnce('engine_flameout', 0.8)) this.speak('Engine flameout')
        // Fade out synthesized engine
        if (!this.useFileEngine) {
          this.engineGain.gain.setTargetAtTime(0.005, this.ctx.currentTime, 0.5)
        }
        break
    }
  }

  // ── Engine ─────────────────────────────────────────────────────────────────

  private startFileEngine(): void {
    if (this.engineSrc) return
    this.useFileEngine = true
    // Mute the synthesis path
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1)

    const loop = this.startLoop('engine_idle', 0.3)
    if (!loop) { this.useFileEngine = false; return }
    ;[this.engineSrc, this.engineSrcGain] = loop
  }

  private updateEngine(throttle: number, _mach: number, engineFailed: boolean): void {
    if (engineFailed) {
      if (this.useFileEngine && this.engineSrcGain) {
        this.engineSrcGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8)
      } else {
        this.engineGain.gain.setTargetAtTime(0.002, this.ctx.currentTime, 0.8)
      }
      return
    }

    if (this.useFileEngine && this.engineSrcGain) {
      // Pitch-shift via playbackRate: 0.85 at idle → 1.25 at afterburner
      if (this.engineSrc) this.engineSrc.playbackRate.setTargetAtTime(0.85 + throttle * 0.4, this.ctx.currentTime, 0.3)
      const vol = 0.15 + throttle * 0.45
      this.engineSrcGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2)
    } else {
      const freq = 80 + throttle * 200
      const vol  = 0.02 + throttle * 0.07
      this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.3)
      this.engineGain.gain.setTargetAtTime(vol,  this.ctx.currentTime, 0.2)
    }
  }

  // ── Cannon ────────────────────────────────────────────────────────────────

  private startGun(caliber: '20mm' | '30mm'): void {
    if (this.gunFiring) return
    this.gunFiring = true

    const fileKey = caliber === '20mm' ? 'gun_20mm' : 'gun_30mm'
    const loop = this.startLoop(fileKey, caliber === '20mm' ? 0.7 : 0.85)
    if (loop) {
      ;[this.gunSrc] = loop
      return
    }

    // Synthesis fallback
    const ctx = this.ctx
    const rateHz   = caliber === '20mm' ? 100 : 30
    const baseFreq = caliber === '20mm' ? 140 : 80
    const fmDepth  = caliber === '20mm' ? 60  : 30
    const bpFreq   = caliber === '20mm' ? 900 : 250
    const gain     = caliber === '20mm' ? 0.22 : 0.40

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = baseFreq

    const modOsc = ctx.createOscillator()
    modOsc.type = 'square'
    modOsc.frequency.value = rateHz
    const modGainNode = ctx.createGain()
    modGainNode.gain.value = fmDepth
    modOsc.connect(modGainNode)
    modGainNode.connect(osc.frequency)

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = bpFreq
    bp.Q.value = 1.8

    const shelf = ctx.createBiquadFilter()
    shelf.type = 'highshelf'
    shelf.frequency.value = 2000
    shelf.gain.value = caliber === '20mm' ? 8 : 0

    const gainNode = ctx.createGain()
    gainNode.gain.value = gain

    osc.connect(bp)
    bp.connect(shelf)
    shelf.connect(gainNode)
    gainNode.connect(this.masterGain)
    osc.start()
    modOsc.start()

    this.gunOsc    = osc
    this.gunModOsc = modOsc
    this.gunGain   = gainNode
  }

  private stopGun(): void {
    if (!this.gunFiring) return
    this.gunFiring = false

    if (this.gunSrc) {
      this.stopLoop(this.gunSrc, null)
      this.gunSrc = null
      return
    }

    const now = this.ctx.currentTime
    this.gunGain?.gain.setTargetAtTime(0, now, 0.02)
    const osc = this.gunOsc, modOsc = this.gunModOsc
    setTimeout(() => {
      try { osc?.stop()    } catch { /* */ }
      try { modOsc?.stop() } catch { /* */ }
    }, 80)
    this.gunOsc = null; this.gunModOsc = null; this.gunGain = null
  }

  // ── IR seeker growl ───────────────────────────────────────────────────────

  private startGrowl(locked: boolean, strength: number): void {
    this.stopGrowl()

    const fileKey = locked ? 'ir_growl_hot' : 'ir_growl_cold'
    const loop = this.startLoop(fileKey, locked ? 0.6 : 0.32)
    if (loop) {
      ;[this.growlSrc, this.growlSrcGain] = loop
      this.growlLocked = locked
      this.applyGrowlParams(strength, locked)
      return
    }
    // Avoid startup synth "chirp" before async sound loading has completed.
    // If growl files are truly missing, we allow synthesis only after load settles.
    if (!this.soundsLoadFinished) return

    // Synthesis fallback
    const ctx = this.ctx

    const carrier = ctx.createOscillator()
    carrier.type = 'sawtooth'
    carrier.frequency.value = 340

    const fmOsc  = ctx.createOscillator()
    fmOsc.frequency.value = 22
    const fmGain = ctx.createGain()
    fmGain.gain.value = 60
    fmOsc.connect(fmGain)
    fmGain.connect(carrier.frequency)

    const amOsc  = ctx.createOscillator()
    amOsc.frequency.value = 18
    const amScaleGain = ctx.createGain()
    amScaleGain.gain.value = 0.04
    amOsc.connect(amScaleGain)

    const ampGain = ctx.createGain()
    ampGain.gain.value = 0.05
    amScaleGain.connect(ampGain.gain)

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 200

    carrier.connect(hp)
    hp.connect(ampGain)
    ampGain.connect(this.masterGain)

    carrier.start(); fmOsc.start(); amOsc.start()
    this.growlCarrier = carrier
    this.growlAmpGain = ampGain
    this.growlFmOsc   = fmOsc
    this.growlFmGain  = fmGain
    this.growlAmOsc   = amOsc
    this.growlAmGain  = amScaleGain
    this.growlLocked  = locked
    this.applyGrowlParams(strength, locked)
  }

  private stopGrowl(): void {
    // File-based path
    if (this.growlSrc) {
      this.stopLoop(this.growlSrc, this.growlSrcGain)
      this.growlSrc = null; this.growlSrcGain = null
    }
    // Synthesis path
    const now = this.ctx.currentTime
    this.growlAmpGain?.gain.setTargetAtTime(0, now, 0.05)
    const c = this.growlCarrier, f = this.growlFmOsc, a = this.growlAmOsc
    setTimeout(() => {
      try { c?.stop() } catch { /* */ }
      try { f?.stop() } catch { /* */ }
      try { a?.stop() } catch { /* */ }
    }, 100)
    this.growlCarrier = null; this.growlAmpGain = null
    this.growlFmOsc = null; this.growlFmGain = null
    this.growlAmOsc = null; this.growlAmGain = null
    this.growlLocked = false
  }

  private applyGrowlParams(strength: number, locked: boolean): void {
    const s = clamp01(strength)
    const now = this.ctx.currentTime

    if (this.growlSrc) {
      // Keep full-lock ("solid") tone at a fixed pitch; only acquisition phase ramps pitch.
      const playbackRate = locked ? 1.04 : (0.88 + s * 0.58)
      const gain = locked ? (0.56 + s * 0.12) : (0.22 + s * 0.48)
      this.growlSrc.playbackRate.setTargetAtTime(playbackRate, now, 0.06)
      this.growlSrcGain?.gain.setTargetAtTime(gain, now, 0.05)
      return
    }

    // Synthesis fallback mirrors the same "stronger lock => hotter pitch" behavior.
    if (locked) {
      this.growlCarrier?.frequency.setTargetAtTime(635, now, 0.06)
      this.growlFmOsc?.frequency.setTargetAtTime(40, now, 0.07)
      this.growlFmGain?.gain.setTargetAtTime(160, now, 0.07)
      this.growlAmOsc?.frequency.setTargetAtTime(36, now, 0.07)
      this.growlAmGain?.gain.setTargetAtTime(0.09, now, 0.08)
      this.growlAmpGain?.gain.setTargetAtTime(0.15, now, 0.05)
    } else {
      this.growlCarrier?.frequency.setTargetAtTime(300 + s * 300, now, 0.06)
      this.growlFmOsc?.frequency.setTargetAtTime(16 + s * 34, now, 0.07)
      this.growlFmGain?.gain.setTargetAtTime(45 + s * 120, now, 0.07)
      this.growlAmOsc?.frequency.setTargetAtTime(12 + s * 28, now, 0.07)
      this.growlAmGain?.gain.setTargetAtTime(0.03 + s * 0.08, now, 0.08)
      this.growlAmpGain?.gain.setTargetAtTime(0.03 + s * 0.14, now, 0.05)
    }
  }

  setIRSeekerState(acquired: boolean, locked: boolean, strength = 0): void {
    if (!acquired) {
      if (!this.growlSrc && !this.growlCarrier) return
      this.stopGrowl()
      return
    }

    const hasGrowl = Boolean(this.growlSrc || this.growlCarrier)
    if (!hasGrowl || this.growlLocked !== locked) {
      this.startGrowl(locked, strength)
      return
    }

    this.applyGrowlParams(strength, locked)
  }

  // ── RWR radar warning tones ───────────────────────────────────────────────

  setRWRMode(mode: 'TRACK' | 'LOCK' | 'INCOMING' | null): void {
    if (mode === this.activeRWRMode) return
    this.activeRWRMode = mode
    this.stopRadarTone()
    if (!mode) return

    // Each mode loops its dedicated file. Synthesis is a last-resort fallback only.
    const fileKey =
      mode === 'INCOMING' ? 'rwr_launch' :
      mode === 'LOCK'     ? 'rwr_lock'   : 'rwr_track'

    const gainVal =
      mode === 'INCOMING' ? 0.55 :
      mode === 'LOCK'     ? 0.45 : 0.40

    const loop = this.startLoop(fileKey, gainVal)
    if (loop) {
      this.radarLockSrc = loop[0]   // reuse radarLockSrc to track the active loop
      return
    }

    // Synthesis fallback (no file loaded)
    if (mode === 'INCOMING') {
      const scheduleBeep = (): void => {
        this.playTone(1400, 0.20, 0.07)
        this.radarToneInterval = setTimeout(scheduleBeep, 150) as unknown as ReturnType<typeof setInterval>
      }
      scheduleBeep()
    } else if (mode === 'LOCK') {
      this.playTone(880, 0.15, 0)
    } else {
      // TRACK
      const schedulePing = (): void => {
        this.playTone(880, 0.12, 0.07)
        this.radarToneInterval = setTimeout(schedulePing, 333) as unknown as ReturnType<typeof setInterval>
      }
      schedulePing()
    }
  }

  // ── Master volume ────────────────────────────────────────────────────────

  setMasterVolume(vol: number): void {
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime, 0.05)
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.stopGun()
    this.stopGrowl()
    this.stopRadarTone()
    if (this.engineSrc) { try { this.engineSrc.stop() } catch { /* */ } }
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
    g.connect(this.masterGain)
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
    // Works for both setInterval and setTimeout handles (browser timers share the same namespace)
    if (this.radarToneInterval !== null) { clearTimeout(this.radarToneInterval); this.radarToneInterval = null }
    if (this.radarToneOsc)  { try { this.radarToneOsc.stop()  } catch { /* */ }; this.radarToneOsc  = null }
    if (this.radarLockSrc)  { try { this.radarLockSrc.stop()  } catch { /* */ }; this.radarLockSrc  = null }
  }

  private speak(text: string): void {
    const utt  = new SpeechSynthesisUtterance(text)
    utt.rate   = 1.2
    utt.pitch  = 0.9
    speechSynthesis.speak(utt)
  }
}

function dist3(a: [number,number,number], b: [number,number,number]): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
