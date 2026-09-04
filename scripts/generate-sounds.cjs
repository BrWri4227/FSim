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

/** Small deterministic PRNG so re-runs produce identical bursts per seed. */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** State-variable band-pass — richer resonance than cascaded one-poles. */
function svfBandpass(samples, freq, q) {
  const out = new Float32Array(samples.length)
  const f = 2 * Math.sin(Math.PI * freq / SR)
  const damp = 1 / q
  let low = 0, band = 0
  for (let i = 0; i < samples.length; i++) {
    low += f * band
    const high = samples[i] - low - damp * band
    band += f * high
    out[i] = band
  }
  return out
}

/** Soft clip — adds grit and loudness without a harsh digital ceiling. */
function saturate(samples, drive = 1.4) {
  const out = new Float32Array(samples.length)
  const k = Math.tanh(drive)
  for (let i = 0; i < samples.length; i++) out[i] = Math.tanh(samples[i] * drive) / k
  return out
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

// ── Aircraft-cannon "buzzsaw" engine ─────────────────────────────────────────
// A looped burst = a train of single-round reports (crack + body thump +
// breech clack) with per-round timing jitter and amplitude/pitch variation,
// over a continuous muzzle-gas roar bed, sub rumble and a faint rotary whine.
// Rounds are stamped modulo the loop length so the pattern is exactly periodic;
// the stationary beds get a short wrap crossfade. The jitter is what keeps it
// from sounding like a flat synthetic tone.

/** One single-round report template (Float32Array of `len` samples). */
function makeShot(o, rng) {
  const s = new Float32Array(o.len)
  const clackDelay = Math.floor(SR * (0.0006 + rng() * 0.0009))
  const thumpF = o.thumpFreq * (0.9 + rng() * 0.2)
  for (let j = 0; j < o.len; j++) {
    const t = j / SR
    const crack = noise() * Math.exp(-t / o.crackDecay) * o.crackLevel
    const thump = (sin_(t, thumpF) + 0.35 * sin_(t, thumpF * 2.02)) *
      Math.exp(-t / o.thumpDecay) * o.thumpLevel
    const ct = j - clackDelay
    const clack = ct > 0 ? noise() * Math.exp(-(ct / SR) / 0.004) * o.clackLevel : 0
    s[j] = crack + thump + clack
  }
  return lpf(hpf(s, o.hpHz), o.lpHz)
}

function buildBurst(c) {
  const rng = mulberry32(c.seed)
  const nShots = Math.round(c.rateHz * c.loopSeconds)   // integer => exact period fit
  const L  = Math.round(SR * c.loopSeconds)             // final looped length
  const xf = Math.floor(SR * 0.045)                     // bed wrap-crossfade length
  const Lp = L + xf
  const period = L / nShots
  const shotLen = Math.floor(SR * c.shotLenSec)

  // Layer 1 — rounds, positions modulo L (exactly L-periodic, loops clean).
  const rounds = new Float32Array(L)
  for (let k = 0; k < nShots; k++) {
    const start = Math.round(k * period + (rng() * 2 - 1) * c.timingJitter * period)
    const amp = 1 - c.ampVar + rng() * (2 * c.ampVar)
    const tmpl = makeShot({ len: shotLen, ...c.shot }, rng)
    for (let j = 0; j < shotLen; j++) {
      rounds[((start + j) % L + L) % L] += tmpl[j] * amp
    }
  }

  // Layer 2 — muzzle-gas roar bed (band-passed noise).
  let roar = new Float32Array(Lp)
  for (let i = 0; i < Lp; i++) roar[i] = noise()
  roar = hpf(lpf(svfBandpass(roar, (c.roarLpHz + c.roarHpHz) / 2, 0.7), c.roarLpHz), c.roarHpHz)

  // Layer 3 — sub rumble (slow random-walk amplitude on a low sine pair).
  const rumble = new Float32Array(Lp)
  let rw = 0
  for (let i = 0; i < Lp; i++) {
    rw += (noise() * 0.5 - rw) * 0.0006
    const t = i / SR
    rumble[i] = (sin_(t, c.rumbleHz) + 0.5 * sin_(t, c.rumbleHz * 1.5)) * (0.6 + rw)
  }

  // Layer 4 — rotary mechanical whine (gently detuned pair).
  let whine = new Float32Array(Lp)
  for (let i = 0; i < Lp; i++) {
    const t = i / SR
    whine[i] = sin_(t, c.whineHz) * 0.6 + sin_(t, c.whineHz * c.whineRatio) * 0.4
  }
  whine = hpf(whine, c.whineHz * 0.7)

  // Bed sum, then heal its wrap by folding the tail over the head.
  const bed = new Float32Array(L)
  for (let i = 0; i < L; i++) {
    const v = roar[i] * c.roarLevel + rumble[i] * c.rumbleLevel + whine[i] * c.whineLevel
    if (i < xf) {
      const a = i / xf
      const vt = roar[L + i] * c.roarLevel + rumble[L + i] * c.rumbleLevel + whine[L + i] * c.whineLevel
      bed[i] = v * a + vt * (1 - a)
    } else {
      bed[i] = v
    }
  }

  const mix = new Float32Array(L)
  for (let i = 0; i < L; i++) mix[i] = rounds[i] + bed[i]

  return normalise(saturate(lpf(hpf(mix, c.hpFinal), c.lpFinal), c.drive), c.peak)
}

// gun_*_tail.wav — released-trigger spin-down: the rotor coasts to a stop
// (falling whine), a few trailing "dwell" rounds fire at a widening interval,
// and the muzzle-gas roar decays through a closing low-pass. One-shot; the
// engine plays it as the firing loop fades out.
function buildTail(c) {
  const rng = mulberry32((c.seed ^ 0x5a5a) | 0)
  const L = Math.floor(SR * c.tailSec)
  const shotLen = Math.floor(SR * c.shotLenSec)
  const out = new Float32Array(L)

  // Trailing dwell rounds — normal spacing at first, then slowing as the rotor
  // loses speed. Not enveloped: they stay punchy at the head of the tail.
  let pos = 0, gap = SR / c.rateHz, amp = 0.9
  for (let k = 0; k < c.dwellRounds; k++) {
    const tmpl = makeShot({ len: shotLen, ...c.shot }, rng)
    const start = Math.round(pos)
    for (let j = 0; j < shotLen && start + j < L; j++) out[start + j] += tmpl[j] * amp
    pos += gap; gap *= 1.7; amp *= 0.55
  }

  // Spin-down whine (pitch + amplitude fall) over a decaying, darkening roar.
  const tau = c.tailSec * 0.32
  let ph = 0, roarY = 0
  for (let i = 0; i < L; i++) {
    const t = i / SR
    const env = Math.exp(-t / tau)
    const f = c.whineHz * (0.38 + 0.62 * env)
    ph += TWO_PI * f / SR
    const whine = (Math.sin(ph) * 0.6 + Math.sin(ph * c.whineRatio) * 0.4) * c.whineLevel * 3.0

    const lpCut = c.roarLpHz * (0.25 + 0.75 * env)
    const a = 1 / (1 + SR / (TWO_PI * lpCut))
    roarY += a * (noise() - roarY)

    out[i] += (whine + roarY * c.roarLevel * 1.3 + Math.sin(t * TWO_PI * c.rumbleHz) * c.rumbleLevel * env) * env
  }

  return normalise(saturate(lpf(hpf(out, c.hpFinal), c.lpFinal), c.drive * 0.85), c.peak * 0.95)
}

// M61A1 Vulcan — 6000 rpm = 100 rounds/s. Tearing "BRRRRT"; rounds fuse into a
// ~100 Hz buzzsaw note. Loop 0.60 s seamless; tail 0.50 s.
const GUN_20MM = {
  rateHz: 100, loopSeconds: 0.60, seed: 1337,
  shotLenSec: 0.028, timingJitter: 0.06, ampVar: 0.16,
  roarLevel: 0.32, roarLpHz: 3800, roarHpHz: 320,
  rumbleLevel: 0.20, rumbleHz: 46,
  whineLevel: 0.05, whineHz: 210, whineRatio: 1.005,
  shot: { crackLevel: 0.85, crackDecay: 0.0016, thumpFreq: 150, thumpDecay: 0.010,
          thumpLevel: 0.55, clackLevel: 0.22, hpHz: 90, lpHz: 5200 },
  drive: 1.5, hpFinal: 60, lpFinal: 6500, peak: 0.94,
  tailSec: 0.50, dwellRounds: 3,
}

// GSh-30-1 — 1800 rpm = 30 rounds/s. Slower, heavier; individual thuds audible
// inside a deep "BRRT". Loop 1.20 s seamless; tail 0.62 s.
const GUN_30MM = {
  rateHz: 30, loopSeconds: 1.20, seed: 4242,
  shotLenSec: 0.060, timingJitter: 0.05, ampVar: 0.22,
  roarLevel: 0.24, roarLpHz: 3400, roarHpHz: 200,
  rumbleLevel: 0.32, rumbleHz: 34,
  whineLevel: 0.03, whineHz: 120, whineRatio: 1.006,
  shot: { crackLevel: 0.82, crackDecay: 0.0024, thumpFreq: 84, thumpDecay: 0.022,
          thumpLevel: 0.85, clackLevel: 0.30, hpHz: 55, lpHz: 4800 },
  drive: 1.5, hpFinal: 40, lpFinal: 5400, peak: 0.95,
  tailSec: 0.62, dwellRounds: 2,
}

function gen_gun_20mm()      { return buildBurst(GUN_20MM) }
function gen_gun_30mm()      { return buildBurst(GUN_30MM) }
function gen_gun_20mm_tail() { return buildTail(GUN_20MM) }
function gen_gun_30mm_tail() { return buildTail(GUN_30MM) }

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

// hit.wav — taking a hit on your own airframe (0.45 s, one-shot)
// Sharp metallic impact: a hard transient over a short low-frequency thud, so it
// reads as damage rather than as a distant explosion.
function gen_hit() {
  const s = alloc(0.45)

  for (let i = 0; i < s.length; i++) {
    const t = i / SR

    // Impact transient — very fast decay, broadband.
    const strike = Math.exp(-t * 90) * noise() * 0.9

    // Metallic ring — two inharmonic partials give it a shell-like character.
    const ring = (sin_(t, 430) * 0.5 + sin_(t, 611) * 0.35) * Math.exp(-t * 22)

    // Body thud so it has weight in the low end.
    const thud = sin_(t, 95) * Math.exp(-t * 14) * 0.7

    s[i] = strike + ring * 0.55 + thud
  }

  // Trim the very top end — a fully broadband transient sounds like static.
  return normalise(lpf(s, 5200))
}

// explosion.wav — detonation / kill (1.4 s, one-shot)
// Noise burst shaped by a fast attack and long decay, with a descending
// low-frequency body for the concussion.
function gen_explosion() {
  const s = alloc(1.4)
  const rumble = alloc(1.4)

  for (let i = 0; i < s.length; i++) {
    const t = i / SR

    // Blast: broadband noise, near-instant attack, exponential tail.
    const attack = t < 0.008 ? t / 0.008 : 1
    const blast  = noise() * attack * Math.exp(-t * 3.4)

    // Concussion: pitch drops from 110 Hz to ~35 Hz as the shockwave expands.
    const f = 110 * Math.exp(-t * 2.2) + 35
    rumble[i] = sin_(t, f) * attack * Math.exp(-t * 2.0)

    s[i] = blast
  }

  // Split the noise into a bright crack and a dark roar, then recombine — a
  // single flat noise burst reads as white noise rather than as an explosion.
  const crack = hpf(s, 900)
  const roar  = lpf(s, 320)

  const out = alloc(1.4)
  for (let i = 0; i < out.length; i++) {
    out[i] = roar[i] * 1.0 + crack[i] * 0.35 + rumble[i] * 0.85
  }

  return normalise(out)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const GENERATORS = {
  'engine_ab.wav':       gen_engine_ab,
  'engine_flameout.wav': gen_engine_flameout,
  'gun_20mm.wav':        gen_gun_20mm,
  'gun_30mm.wav':        gen_gun_30mm,
  'gun_20mm_tail.wav':   gen_gun_20mm_tail,
  'gun_30mm_tail.wav':   gen_gun_30mm_tail,
  'rwr_track.wav':       gen_rwr_track,
  'missile_launch.wav':  gen_missile_launch,
  'pull_up.wav':         gen_pull_up,
  'hit.wav':             gen_hit,
  'explosion.wav':       gen_explosion,
}

// Files whose canonical source is this script — always regenerated, even if a
// WAV already exists. (The default behaviour keeps hand-dropped recordings.)
const REGENERATE = new Set([
  'gun_20mm.wav', 'gun_30mm.wav', 'gun_20mm_tail.wav', 'gun_30mm_tail.wav',
])

console.log('\nFSim sound generator')
console.log('Output: ' + DIR + '\n')

if (!fs.existsSync(DIR)) {
  fs.mkdirSync(DIR, { recursive: true })
}

let generated = 0
for (const [filename, gen] of Object.entries(GENERATORS)) {
  const fp = path.join(DIR, filename)
  if (fs.existsSync(fp) && !REGENERATE.has(filename)) {
    console.log('  skip  ' + filename + '  (already exists)')
    continue
  }
  const verb = fs.existsSync(fp) ? 'regen ' : 'gen   '
  process.stdout.write('  ' + verb + filename + ' ... ')
  const samples = gen()
  writeWAV(fp, samples)
  const kb = (samples.length * 2 / 1024).toFixed(0)
  console.log('done  (' + kb + ' KB)')
  generated++
}

console.log('\n' + generated + ' file(s) generated.\n')
