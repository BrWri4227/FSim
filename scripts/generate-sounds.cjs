#!/usr/bin/env node
/**
 * FSim sound generator
 * Synthesises WAV files for any missing sounds in src/renderer/public/sounds/.
 * Existing files are never overwritten — drop your own real recordings in and
 * this script will skip them automatically.
 *
 * Usage:  node scripts/generate-sounds.js
 */

'use strict'
const fs   = require('fs')
const path = require('path')

const SR  = 44100   // sample rate (Hz)
const DIR = path.join(__dirname, '..', 'src', 'renderer', 'public', 'sounds')

// ── WAV writer ────────────────────────────────────────────────────────────────

function writeWAV(filepath, samples) {
  const n   = samples.length
  const buf = Buffer.alloc(44 + n * 2)

  buf.write('RIFF',  0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE',  8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)       // fmt chunk size
  buf.writeUInt16LE(1,  20)       // PCM
  buf.writeUInt16LE(1,  22)       // mono
  buf.writeUInt32LE(SR, 24)       // sample rate
  buf.writeUInt32LE(SR * 2, 28)   // byte rate
  buf.writeUInt16LE(2,  32)       // block align
  buf.writeUInt16LE(16, 34)       // bits per sample
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)

  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }

  fs.writeFileSync(filepath, buf)
}

// ── Signal helpers ────────────────────────────────────────────────────────────

const TWO_PI = Math.PI * 2

/** Band-limited sawtooth via additive synthesis (8 harmonics). */
function bsaw(t, f) {
  let s = 0, sign = 1
  for (let k = 1; k <= 8; k++, sign = -sign) {
    s += sign * Math.sin(TWO_PI * f * k * t) / k
  }
  return s * (2 / Math.PI)
}

function sin_(t, f) { return Math.sin(TWO_PI * f * t) }

function noise() { return Math.random() * 2 - 1 }

/** One-pole low-pass filter. */
function lpf(samples, cutoff) {
  const a = 1 / (1 + SR / (TWO_PI * cutoff))
  const out = new Float32Array(samples.length)
  let y = 0
  for (let i = 0; i < samples.length; i++) {
    y += a * (samples[i] - y)
    out[i] = y
  }
  return out
}

/** One-pole high-pass filter. */
function hpf(samples, cutoff) {
  const rc = SR / (TWO_PI * cutoff)
  const a  = rc / (rc + 1)
  const out = new Float32Array(samples.length)
  let px = 0, py = 0
  for (let i = 0; i < samples.length; i++) {
    const y = a * (py + samples[i] - px)
    px = samples[i]; py = y
    out[i] = y
  }
  return out
}

function normalise(samples, peak = 0.88) {
  let max = 0
  for (const s of samples) if (Math.abs(s) > max) max = Math.abs(s)
  if (max < 1e-6) return samples
  const g = peak / max
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * g
  return out
}

function alloc(durationSec) {
  return new Float32Array(Math.floor(SR * durationSec))
}

// ── Sound generators ──────────────────────────────────────────────────────────

// engine_ab.wav — afterburner roar (3.2 s, loop-friendly)
// Heavy low-frequency turbine with broadband combustion noise.
function gen_engine_ab() {
  const s = alloc(3.2)
  let   ph1 = 0, ph2 = 0, ph3 = 0

  for (let i = 0; i < s.length; i++) {
    const t   = i / SR
    const ramp = Math.min(1, t / 0.18)       // 180 ms ignition ramp

    // Fundamental frequency with slow waver (simulates turbine speed fluctuation)
    const f0  = 96 + 14 * sin_(t, 0.65)
    ph1 = (ph1 + f0 / SR) % 1
    ph2 = (ph2 + (f0 * 2.08) / SR) % 1
    ph3 = (ph3 + (f0 * 3.15) / SR) % 1

    // Sawtooth oscillators via phase accumulators
    const osc = (ph1 * 2 - 1) * 0.38
              + (ph2 * 2 - 1) * 0.18
              + (ph3 * 2 - 1) * 0.09

    // Broadband combustion noise (two layers: turbulence + crackle)
    const n1 = noise() * 0.20
    const n2 = noise() * 0.10 * sin_(t, 3.1)    // amplitude-modulated crackle

    s[i] = (osc + n1 + n2) * ramp * 0.82
  }

  return normalise(lpf(s, 2800))
}

// engine_flameout.wav — compressor stall then spindown (2.8 s, one-shot)
// Starts with a sharp bang then pitch falls exponentially.
function gen_engine_flameout() {
  const s = alloc(2.8)
  let   ph = 0

  for (let i = 0; i < s.length; i++) {
    const t = i / SR

    // Compressor stall bang: a short burst of broad noise
    const bang = t < 0.06 ? noise() * Math.exp(-t / 0.014) * 1.3 : 0

    // Turbine spindown: frequency decays from 115 Hz → 22 Hz
    const f   = 22 + 93 * Math.exp(-t * 2.4)
    ph = (ph + f / SR) % 1
    const osc = (ph * 2 - 1)  // sawtooth via phase

    // Amplitude envelope: fast initial decay
    const env = Math.exp(-t * 1.9) * 0.55

    // Random compressor surge pops in first 0.6 s
    const pop = t < 0.6 && Math.random() < 0.0025 ? noise() * 0.45 : 0

    s[i] = bang + osc * env + noise() * env * 0.18 + pop
  }

  return normalise(lpf(s, 1300))
}

// gun_30mm.wav — GSh-30-1 cannon burst (1.5 s, seamless loop)
// ~1800 RPM = 30 rounds/sec. Heavy percussive thuds.
function gen_gun_30mm() {
  const RATE   = 30                             // rounds per second
  const DUR    = 1.5                            // exactly 45 shots
  const s      = alloc(DUR)
  const PERIOD = Math.floor(SR / RATE)          // samples per shot

  // Single-shot template (~35 ms: initial shockwave then low-freq ringing)
  const SHOT_LEN = Math.floor(SR * 0.035)
  const shot = new Float32Array(SHOT_LEN)
  for (let j = 0; j < SHOT_LEN; j++) {
    const t = j / SR
    const shockEnv  = Math.exp(-t / 0.003) * 0.9   // sharp shockwave click
    const ringEnv   = Math.exp(-t / 0.012) * 0.6   // low ringing body tone
    shot[j] = noise() * shockEnv
            + sin_(t, 75) * ringEnv
            + sin_(t, 52) * ringEnv * 0.6
  }

  // Stamp shots at regular intervals
  const nShots = Math.floor(DUR * RATE)
  for (let k = 0; k < nShots; k++) {
    const off = k * PERIOD
    for (let j = 0; j < SHOT_LEN && off + j < s.length; j++) {
      s[off + j] += shot[j]
    }
  }

  // High-pass to remove DC, then low-pass to shape tone colour
  return normalise(lpf(hpf(s, 30), 950))
}

// rwr_track.wav — track-mode RWR ping (0.13 s, one-shot)
// Two quick ascending tones — more urgent than a search ping.
function gen_rwr_track() {
  const s = alloc(0.13)
  for (let i = 0; i < s.length; i++) {
    const t = i / SR

    // First tone: 0–55 ms at 820 Hz
    const e1 = t < 0.055
      ? Math.min(1, t / 0.002) * Math.exp(-t / 0.022)
      : 0.0
    // Second tone: 60–120 ms at 1160 Hz (higher = more urgent)
    const t2 = t - 0.060
    const e2 = t >= 0.060 && t < 0.125
      ? Math.min(1, t2 / 0.002) * Math.exp(-t2 / 0.022)
      : 0.0

    s[i] = sin_(t, 820)  * e1 * 0.72
         + sin_(t, 1160) * e2 * 0.72
         + sin_(t, 1640) * e2 * 0.20  // slight harmonic for bite
  }
  return normalise(s)
}

// missile_launch.wav — rocket motor ignition + receding roar (1.8 s, one-shot)
// Crackle → rapid roar buildup → Doppler-fade as missile flies away.
function gen_missile_launch() {
  const s = alloc(1.8)
  let ph1 = 0, ph2 = 0

  for (let i = 0; i < s.length; i++) {
    const t = i / SR

    // Ignition crack: white noise burst (0–80 ms)
    const crack = t < 0.08
      ? noise() * Math.exp(-t / 0.018) * 1.4
      : 0

    // Rocket motor roar: builds in 0.12 s, then Doppler-fades
    const roarEnv = t < 0.04 ? 0
                  : t < 0.16 ? (t - 0.04) / 0.12
                  : Math.exp(-(t - 0.16) / 0.65)

    // Frequency rises slightly on departure (Doppler)
    const f_r = 165 + 55 * Math.exp(-(t - 0.1) / 0.3)
    ph1 = (ph1 + f_r / SR) % 1
    ph2 = (ph2 + (f_r * 2.1) / SR) % 1
    const roar = ((ph1 * 2 - 1) * 0.38 + (ph2 * 2 - 1) * 0.18 + noise() * 0.30) * roarEnv * 0.80

    // High-frequency motor shriek / whoosh layer (exhaust nozzle)
    const whooshEnv = t > 0.06 ? Math.min(1, (t - 0.06) / 0.15) * Math.exp(-(t - 0.1) / 0.55) : 0
    const whoosh    = noise() * whooshEnv * 0.28

    s[i] = crack + roar + whoosh
  }

  return normalise(lpf(s, 3500))
}

// pull_up.wav — GPWS "whoop-whoop" warning (0.9 s, one-shot)
// Two rising chirps from 310 Hz → 680 Hz matching classic GPWS character.
function gen_pull_up() {
  const s      = alloc(0.9)
  const SWEEP  = 0.36        // duration of each whoop (s)
  const GAP    = 0.45        // start of second whoop (s)
  const F_LO   = 310
  const F_HI   = 680

  for (let i = 0; i < s.length; i++) {
    const t = i / SR

    // Whoop 1: 0 → SWEEP
    let e1 = 0, f1 = 0
    if (t < SWEEP) {
      const p  = t / SWEEP
      f1 = F_LO + (F_HI - F_LO) * p
      const on = t < 0.015 ? t / 0.015 : (t > SWEEP - 0.03 ? (SWEEP - t) / 0.03 : 1)
      e1 = on * 0.80
    }

    // Whoop 2: GAP → GAP+SWEEP
    let e2 = 0, f2 = 0
    const t2 = t - GAP
    if (t2 >= 0 && t2 < SWEEP) {
      const p  = t2 / SWEEP
      f2 = F_LO + (F_HI - F_LO) * p
      const on = t2 < 0.015 ? t2 / 0.015 : (t2 > SWEEP - 0.03 ? (SWEEP - t2) / 0.03 : 1)
      e2 = on * 0.80
    }

    s[i] = sin_(t, f1)      * e1
         + sin_(t, f1 * 2)  * e1 * 0.18   // 2nd harmonic adds urgency
         + sin_(t, f2)      * e2
         + sin_(t, f2 * 2)  * e2 * 0.18
  }

  return normalise(s)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const GENERATORS = {
  'engine_ab.wav':       gen_engine_ab,
  'engine_flameout.wav': gen_engine_flameout,
  'gun_30mm.wav':        gen_gun_30mm,
  'rwr_track.wav':       gen_rwr_track,
  'missile_launch.wav':  gen_missile_launch,
  'pull_up.wav':         gen_pull_up,
}

console.log('\nFSim sound generator')
console.log('Output: ' + DIR + '\n')

if (!fs.existsSync(DIR)) {
  fs.mkdirSync(DIR, { recursive: true })
}

let generated = 0
for (const [filename, gen] of Object.entries(GENERATORS)) {
  const fp = path.join(DIR, filename)
  if (fs.existsSync(fp)) {
    console.log('  skip  ' + filename + '  (already exists)')
    continue
  }
  process.stdout.write('  gen   ' + filename + ' ... ')
  const samples = gen()
  writeWAV(fp, samples)
  const kb = (samples.length * 2 / 1024).toFixed(0)
  console.log('done  (' + kb + ' KB)')
  generated++
}

console.log('\n' + generated + ' file(s) generated.\n')
