# FSim — Stage 3–5 Implementation Plan

Companion to [`FRIENDS_RELEASE_AUDIT.md`](FRIENDS_RELEASE_AUDIT.md). Covers §14 Stages 3, 4 and 5.
Every file path and line number below was verified against the working tree at `e2cf8ce` **plus
the uncommitted Stage 1–2 changes present on 2026-09-03** (see the precondition section).

**Total estimate:** ~2 days of focused work (Stage 3 ≈ 5 h, Stage 4 ≈ 8 h, Stage 5 ≈ 2 h).

---

## Status — 2026-09-03 (Stages 1–4 landed; Stage 5 code done, live rehearsal outstanding)

Implemented on `BW/Cursor-Opus-Implement-Sanity`. `npm run ci` exits 0 — **265/265 tests**, 0 lint
warnings. The original plan's "all of it is uncommitted" note is stale: Stages 1–4 are committed
as the log below. Stage 5 (packaged build, two-client rehearsal, audit §15 checklist) was **not**
executed in this session.

```
664b3e9 S4-D/E: kill feed, scoreboard, and in-flight respawn
e119812 S4-C: death events and server-authoritative scoring
5609d60 S4-B: callsigns, so players can tell each other apart
7247e3e S4-A: give multiplayer a scenario that makes sense
8636964 S3-F: graphics quality, store visibility, RWR gating and copy fixes
8e68904 S3-E: tell the player when they are being shot
cc4a26e S3-D: give the player a volume control and combat some weight
b79a355 S3-C: stop a connected gamepad from disabling keyboard flight
f9b8de1 S3-B: fit the window on a 1080p screen and add F11 fullscreen
c3a0d01 S3-A: settings foundation for the usability work
75bfb84 Stage 2: make missiles and guns actually connect
5ce3621 Stage 1: unbreak the CI gate
```

Work stayed on this branch rather than splitting `release/stage-3-usability` /
`release/stage-4-multiplayer`.

### How each item landed

**Stage 1** — `fa18e` turn-rate band, README roster, lint clean-up. Unblocked `npm run ci`.

**Stage 2** — Swept closest-approach fuse (`Warhead.checkProximityFuse` returns
`{ detonate, missDistanceM }`), missile severity `lethality² × 1.15`, swept gun hits via
`segmentPointDistance` with `break` after a hit, explosion pool stepped once from
`FlightSession.tick`.

**S3-A** — `PilotSettings` gained `invertPitch` / `callsign`; defaults `masterVolume: 0.8`,
`glocEnabled: false`. `FlightOptions` carries volume, quality, invert-pitch. Loadout SETTINGS
section (slider + graphics select) between ENVIRONMENT and FLIGHT OPTIONS.

**S3-B** — Window 1600×900. F11 toggles fullscreen via `before-input-event` in `src/main/index.ts`
(not a global shortcut).

**S3-C** — `InputManager` takes `{ invertPitch }`. Keyboard axes always live; pad overlays per-axis
when its deadzoned magnitude wins. RT/RB gun, A missile, B flares. Keyboard throttle always works.

**S3-D** — `setMasterVolume` called on session start and from the pause slider. Speech uses
`utt.volume`. `HIT` / `EXPLOSION` events with synth fallback. Explosions fire through
`setExplosionAudioHook` from `ExplosionManager.spawn`.

**S3-E** — `Aircraft.applyIncomingHit` is the single damage choke point (guns, missiles, frag, MP
inbound). HUD red vignette + damage panel + `NO LOCK` caution with numeric priority so it cannot
outrank `BREAK`.

**S3-F** — Graphics quality drives bloom, shadows and pixel ratio. Fired stores hide when
`remainingRounds === 0`. RWR range-gated. G-LOC default off and relabelled. Wingman keys / F11 /
F12 copy. Free Flight briefing rewritten for a player.

**S4-A** — New `DOGFIGHT` scenario with real lose conditions. `updateMissionEnd` ejected fallback
is unconditional. Lobby locks time-of-day / weather. MP suppresses scenario AI.

**S4-B** — `callsign` on `NetPlayerProfile`, sanitized (1–24 chars, no control characters).
Loadout input, lobby list, HUD marker via `NetworkAircraft.displayName`.

**S4-C** — `{ type: 'death' }` client/server messages. Server stamps victim id, keeps `kills` /
`deaths` on `PeerRecord`, includes scores in `welcome`. Victim attributes killer from last inbound
hit within 10 s.

**S4-D** — Kill feed (4 lines, 6 s fade, below the FLIR's max extent) and hold-**N** scoreboard
(Tab stays camera). Both timers are in the HUD `needsFlash` check. Inbound-missile markers now
query `['player', localNetworkId]` so MP shots are visible.

**S4-E** — MP death intercepts `scheduleMissionEnd` and shows `RespawnOverlay` (5 s, standings,
Esc still opens pause). `PlayerAircraft.respawn()` resets damage / stores / G-LOC / FCS / STT and
calls `MissileSystem.clear()` / `BombSystem.clear()` (not `dispose()`). Respawn scatters ±3 km at
scenario altitude with a random heading. Respawn timer is cleared in `dispose()`. Single-player
death still goes to debrief.

### Stage 5 — partly done (2026-09-03)

`npm run ci` exits 0 — **265/265 tests, 27 files, 0 lint warnings**.

```
7c94dc7 S5: cover the multiplayer receive path end to end
51ce0f8 S5: make the version badge tell the truth, bump to 0.2.0
```

**Done and verified:**

| Item | Result |
|---|---|
| Version single-sourced | `electron.vite.config.ts` injects `__APP_VERSION__` from `package.json` via `define`; preload no longer hard-codes it. `window.fsim.version` stays synchronous, so the two badge call sites are unchanged. Verified `version: "0.2.0"` baked into `dist-electron/preload/index.mjs`. |
| Version bumped | 0.1.5 → **0.2.0** |
| Packaged build | `npm run dist:win` exit 0 → `release/FSim Setup 0.2.0.exe` (107.7 MB) + blockmap |
| Packaged audio | All **29 WAVs** present under `release/win-unpacked/resources/app.asar.unpacked/dist-electron/renderer/sounds/`, including the new `hit.wav` / `explosion.wav` / gun tails. `asarUnpack` config is correct. |
| Dedicated server | `npm run build:server` + live `node dist-server/server/standalone.js --port 45455`: real client joined, server logged `Player Probe joined (F22)` and returned `welcome` with `score`. The path `docs/dedicated-server.md` tells friends to use works. |
| MP receive path | New `MultiplayerSession.integration.test.ts` — 7 tests, real clients ↔ real `GameServer` over real sockets. Stable across 5 consecutive runs. Covers callsign exchange, state relay, targeted hit delivery, kill scoring agreeing on both clients, **late-joiner standings**, peer departure, mid-session callsign change. |
| Risk-register spot checks | `respawnTimer` **is** cleared in `FlightSession.dispose()`; kill feed, scoreboard and hit flash **are** all in the HUD `needsFlash` check. Both risks closed. |
| Housekeeping | `eslint_out.txt` already gone; tree clean. |

**Still to do — needs a second machine and a human:**

1. **Two-client rehearsal with eyes on it.** The protocol is now covered by tests, but nobody has
   watched remote-aircraft interpolation for rubber-banding, read the kill feed mid-fight, or
   confirmed the respawn overlay feels right. Run `npm run server` on a third box and connect two
   real clients.
2. **Fresh-install test.** Install `release/FSim Setup 0.2.0.exe` on a machine that has never run
   the dev server: confirm the console reports `29 / 29 sound files loaded` (a silent fallback to
   synthesis is easy to miss), DevTools stay closed, the version badge reads `v0.2.0`, and the
   Windows Defender prompt on first host is accepted and then joinable.
3. **Audit §15 checklist**, the remaining boxes.

**Two cosmetic findings from the packaging run** (neither blocks the playtest):

- `default Electron icon is used — application icon is not set`. The installer, taskbar and Start
  menu entry all show the stock Electron logo. A single 256×256 `build/icon.ico` plus
  `"win": { "icon": "build/icon.ico" }` fixes it, and it is the first thing a friend sees.
- `author is missed in the package.json`. Harmless, but electron-builder uses it for installer
  metadata and the publisher string.

Still out of scope: the P2 IR seeker quaternion-as-direction bug at `IRSeeker.ts` (`forward =
[attitudeQuat[0], attitudeQuat[1], attitudeQuat[2]]` — fix is `quatRotateVec(state.attitudeQuat,
[1, 0, 0])`), server-authoritative damage, AI replication, teams, full keybind remapping.

---

## Precondition — Stages 1 and 2 are already done ✅

Verified in the working tree on 2026-09-03. `npm run ci` exits 0 — **169/169 tests, 18/18 files,
0 lint warnings** (was 167/168 with 16 warnings at audit time). Confirmed present:

| Stage | Item | State |
|---|---|---|
| 1 | `fa18e: { min: 12, max: 20 }` in `turnPerformance.ts:11` | done |
| 1 | 16 lint warnings cleared; `prevMissDistanceM` removed from `types/weapons.ts` | done |
| 1 | README roster updated | done |
| 2 | Swept closest-approach fuse — `checkProximityFuse(missile, targetState, dt)` now returns `{ detonate, missDistanceM }` and threads the real miss distance into `computeLethality` | done |
| 2 | `severity = lethality * lethality * 1.15` (`MissileSystem.ts:444`) — a centre hit now kills | done |
| 2 | Swept gun hit test via `segmentPointDistance` + `break` after hit (`GunSystem.ts:119,135`) | done |
| 2 | `stepExplosionPool(scene, dt)` called once per tick from `FlightSession.ts:363`; `ExplosionManager.update` deprecated | done |

**The gate is green — start at Stage 3.**

Two notes on the current tree before you branch:

- **All of it is uncommitted.** 22 modified files sit on `BW/Cursor-Opus-Implement-Sanity` with no
  commit since `e2cf8ce`. Commit Stages 1–2 as their own commits *before* opening the Stage 3
  branch, or the branch structure below is meaningless and a bad Stage 3 experiment takes the
  combat fixes down with it.
- **`eslint_out.txt` is untracked in the repo root** (a stray captured lint run). Delete it or add
  it to `.gitignore`. It will not ship — `electron-builder`'s `files` array only includes
  `dist-electron/**` and `dist/**` — but it should not be committed either.

One P2 item from the audit is *not* done and is easy to mistake for done: the IR aspect bug at
`IRSeeker.ts:16` still reads `forward = [attitudeQuat[0], attitudeQuat[1], attitudeQuat[2]]` —
quaternion components used as a direction vector. The lint fix removed the unused `bodyForwardNED`
line above it, which makes the surrounding code *look* addressed. It is P2 and stays out of scope
here; the fix is `quatRotateVec(state.attitudeQuat, [1, 0, 0])` whenever you get to it.

---

## Branch and commit structure

Suggested: one branch per stage off `main`, with the work items below as individual commits so
anything can be reverted in isolation.

```
release/stage-3-usability     → 6 commits (S3-A … S3-F)
release/stage-4-multiplayer   → 5 commits (S4-A … S4-E)
```

Stage 5 produces no code, only verification and possibly small fixes.

Run `npm run ci` before every commit — it is fast (~10 s) and the typecheck catches most of the
plumbing mistakes these changes invite.

---

# Stage 3 — Make it playable by someone who is not you

**Goal:** a friend can install it, launch it, configure it, fly it and fight in it without asking
you a question. Everything here is single-player-testable.

**Estimate:** ~5 hours. **Depends on:** Stage 2. **Blocks:** nothing (but skipping it means you
narrate the whole playtest).

---

## S3-A — Settings foundation *(45 min)*

Everything else in Stage 3 needs somewhere to store a preference and somewhere to change it. Do
this first or you will do it three times.

**Files:** `src/renderer/persistence/Settings.ts`, `src/renderer/FlightSession.ts`,
`src/renderer/ui/LoadoutScreen.ts`

**1. Extend `PilotSettings`** (`Settings.ts:16-40`). `masterVolume` and `postFXQuality` already
exist and are already persisted — they are simply never read. Add the three new fields:

```ts
export interface PilotSettings {
  // … existing …
  masterVolume: number          // exists, currently unread
  postFXQuality: PostFXQuality  // exists, currently unread
  invertPitch: boolean          // new
  callsign: string              // new — used in Stage 4, added now so it persists from day one
}

export const DEFAULT_SETTINGS: PilotSettings = {
  // … existing …
  masterVolume: 0.8,            // was 1.0 — 0.8 leaves headroom over voice chat
  postFXQuality: 'HIGH',
  invertPitch: false,
  callsign: '',                 // empty → LoadoutScreen falls back to `Pilot ${peerN}`
  glocEnabled: false,           // changed from true — see S3-F
}
```

**2. Extend `FlightOptions`** (`FlightSession.ts:37-49`) so the session receives them:

```ts
export interface FlightOptions {
  glocEnabled: boolean
  autoRudder: boolean
  timeOfDay: TimeOfDayPreset
  weather: WeatherPreset
  masterVolume: number      // new
  postFXQuality: PostFXQuality  // new
  invertPitch: boolean      // new
}
```
Update `DEFAULT_FLIGHT_OPTIONS` to match, and the `saveSettings({...})` call and `options` object
in `LoadoutScreen`'s launch handler (`LoadoutScreen.ts:509-523`).

**3. Add a SETTINGS section to `LoadoutScreen.render()`.** There is already a `mkSelectRow` helper
scoped inside `render()` for the ENVIRONMENT block (`LoadoutScreen.ts:265-290`) — reuse the same
pattern. Add a sibling `mkSliderRow` for volume. Put the new section between ENVIRONMENT and
FLIGHT OPTIONS:

- `Master volume` — range slider 0–100, writes `this.masterVolume`
- `Graphics` — select HIGH / MEDIUM / LOW, writes `this.postFXQuality`
- `Invert pitch` — checkbox next to the existing Auto Rudder checkbox in FLIGHT OPTIONS

**Verify:** set each, launch, abort to loadout, confirm the values survived; restart the app and
confirm they survived that too (they go through `saveSettings` → `localStorage`).

---

## S3-B — Shell: fullscreen and window size *(15 min)*

**File:** `src/main/index.ts:46-87`

The window is `{ width: 1920, height: 1080, fullscreen: false }` with `setMenuBarVisibility(false)`,
so on a 1080p monitor it is taller than the screen and there is no accelerator to fix it.

```ts
const win = new BrowserWindow({
  width: 1600, height: 900,   // was 1920×1080
  // …
})

win.webContents.on('before-input-event', (event, input) => {
  if (input.type === 'keyDown' && input.key === 'F11') {
    event.preventDefault()
    win.setFullScreen(!win.isFullScreen())
  }
})
```

Use `before-input-event` rather than `globalShortcut` — a global shortcut would steal F11 from
every other app while FSim runs.

**Verify:** F11 toggles in both the menus and in flight; the HUD reflows correctly (it already
listens for `resize` at `FlightSession.ts:215`, so this should just work — confirm the radar scope
and RWR ring are not clipped at 1600×900).

---

## S3-C — Input: gamepad blend and invert pitch *(45 min)* — **P0**

**File:** `src/renderer/input/InputManager.ts:54-142`

The current branch at line 59 is exclusive and permanent: once `navigator.getGamepads()[0]` is
non-null, W/A/S/D/Q/E/Shift/Ctrl are dead for the rest of the session.

**1. Constructor takes options:**
```ts
constructor(private opts: { invertPitch?: boolean } = {}) { /* … existing listeners … */ }
```
Wire it at `FlightSession.ts:136`: `new InputManager({ invertPitch: options.invertPitch })`.

**2. Replace the branch with a blend.** Read the keyboard *always*; overlay the pad only when it is
actually deflected:

```ts
const gp = navigator.getGamepads()[0]
const pad = (i: number) => this.applyAxisDeadzone(gp?.axes[i] ?? 0, i === 2 ? 0.10 : 0.08)
const padRoll = pad(0), padPitch = -pad(1), padYaw = pad(2)
const rt = gp?.buttons[7]?.value ?? 0, lt = gp?.buttons[6]?.value ?? 0

// keyboard always live
let pitch = this.axis(DEFAULT_BINDINGS.pitchUp, DEFAULT_BINDINGS.pitchDown)
let roll  = this.axis(DEFAULT_BINDINGS.rollRight, DEFAULT_BINDINGS.rollLeft)
let yaw   = this.axis(DEFAULT_BINDINGS.yawRight, DEFAULT_BINDINGS.yawLeft)

// pad wins only on the axes it is actually moving
const pick = (k: number, p: number) => (Math.abs(p) > Math.abs(k) ? p : k)
pitch = pick(pitch, padPitch); roll = pick(roll, padRoll); yaw = pick(yaw, padYaw)

// throttle: keyboard keys and pad triggers both contribute
if (this.keys.has(DEFAULT_BINDINGS.throttleUp))   this.throttle = clamp(this.throttle + 0.25 * dt, 0, 1)
if (this.keys.has(DEFAULT_BINDINGS.throttleDown)) this.throttle = clamp(this.throttle - 0.25 * dt, 0, 1)
if (rt > 0.05 || lt > 0.05) this.throttle = clamp(this.throttle + (rt - lt) * 0.02, 0, 1)

if (this.opts.invertPitch) pitch = -pitch
```

Note `applyAxisDeadzone` already exists at line ~44 — reuse it rather than raw axis reads, so an
idle stick with drift never wins the `pick`.

**3. Minimum pad buttons.** Full gamepad mapping is P3, but three bindings stop a pad user being
half-locked-out. Add to the returned `ControlInputs`, OR-ed with the keyboard:
`fireGun` ← button 7 (RT) or 5 (RB), `fireMissile` ← button 0 (A/cross, edge-detected),
`dispenseFlare` ← button 1 (B/circle).

**Verify:** plug in a controller, deflect the stick, then fly the whole circuit on WASD without
touching the pad again. Both must work. Then repeat with no controller connected at all
(`getGamepads()[0]` is `null` — the `?? 0` fallbacks must not throw).

---

## S3-D — Audio: volume, speech, hit and explosion *(1 h)*

**Files:** `src/renderer/audio/AudioManager.ts`, `src/renderer/FlightSession.ts`,
`src/renderer/scene/ExplosionEffect.ts`, `src/renderer/ui/PauseMenu.ts`

**1. Wire the existing volume control.** `setMasterVolume` already exists
(`AudioManager.ts:800`) and does the right thing. It is simply never called. In the `FlightSession`
constructor, after `new AudioManager()` (line 138):
```ts
this.audioManager.setMasterVolume(options.masterVolume)
```

**2. Make speech obey it.** `speak()` and `speakUtterance()` (`AudioManager.ts:889-903`) go through
`window.speechSynthesis`, which is not connected to `masterGain` and cannot be attenuated by it.
One-line fix in both: `utt.volume = this.masterVolumeValue`. Store the value in `setMasterVolume`
alongside the gain ramp — `GainNode.gain.value` is not a reliable read-back after
`setTargetAtTime`.

**3. Add the two missing events.** Extend the `AudioEvent` union (`AudioManager.ts:3-17`) with
`'HIT'` and `'EXPLOSION'`, add cases to the `play()` switch (`AudioManager.ts:428`), and add
`hit: 'hit.wav'` / `explosion: 'explosion.wav'` to `SOUND_FILES` (line 46) **and to
`OPTIONAL_SOUND_FILES`** (line 74) so the loader does not warn when the WAVs are absent:

```ts
case 'HIT':
  if (!this.playOnce('hit', 0.9)) this.playTone(140, 0.5, 0.18)
  break
case 'EXPLOSION':
  if (!this.playOnce('explosion', 0.85)) this.playTone(70, 0.6, 0.5)
  break
```

The synth fallback means this ships working with no new assets. Record real WAVs later, or add
them to `scripts/generate-sounds.cjs`.

**4. Fire them.** `HIT` is wired in S3-E via the new damage hook. `EXPLOSION` goes in
`ExplosionManager.spawn()` — the single choke point for every detonation. `ExplosionManager` has
no `AudioManager` reference, so pass a callback: add a module-level
`setExplosionAudioHook(cb: (worldPos: THREE.Vector3) => void)` set once from `FlightSession`, and
attenuate by camera distance in the handler.

**5. Volume in the pause menu.** Add the same slider to `PauseMenu` (it takes callbacks already —
add `onVolumeChange`). Being unable to turn the game down mid-session without quitting is the
thing that will actually annoy people.

**Verify:** slider at 0 silences engine, RWR, gun *and* the AWACS voice. Slider changes take effect
immediately mid-flight.

---

## S3-E — Damage feedback and "NO LOCK" *(1 h 15 min)*

The highest-value item in Stage 3. Currently: grepping `damage` across `HUD.ts`, `HUDElements/*`
and `MFDPages/*` returns **zero matches**.

### E1 — Single choke point for incoming damage *(20 min)*

There are exactly four `applyHit` call sites outside the definition, so this refactor is small:

| Site | Currently |
|---|---|
| `GunSystem.ts:131` | `applyHit(enemy.damage, zone, severity, enemy.state.invincible)` |
| `MissileSystem.ts:445` | `applyHit(target.damage, zone, severity, target.state.invincible)` |
| `MissileSystem.ts:451` | `applyHit(target.damage, sz, lethality * 0.15)` (secondary frag) |
| `FlightSession.ts:586` | `applyHit(this.player.damage, hit.zone, hit.severity, …)` (MP inbound) |

Add to `Aircraft` (`src/renderer/entities/Aircraft.ts`):

```ts
onHitTaken: ((zone: DamageZone, severity: number) => void) | null = null

applyIncomingHit(zone: DamageZone, severity: number): boolean {
  const destroyed = applyHit(this.damage, zone, severity, this.state.invincible)
  if (!this.state.invincible) this.onHitTaken?.(zone, severity)
  return destroyed
}
```

Replace all four call sites with `target.applyIncomingHit(zone, severity)`. This also gives Stage 4
its kill-attribution hook for free.

Then in `FlightSession`'s constructor:
```ts
this.player.onHitTaken = (zone, severity) => {
  this.hud.notifyHitTaken(zone, severity)
  this.audioManager.play('HIT')
}
```

### E2 — Hit flash *(15 min)*

`HUD` already has the exact pattern to copy: `decoyFlashRemainSec` / `notifyDecoySuccess`
(`HUD.ts:78-79, 116-120`), decremented from wall-clock delta at `HUD.ts:146-148` and included in
the `needsFlash` repaint check at line 124.

Add `hitFlashRemainSec` the same way (0.45 s), and in `render()` draw a red vignette — four edge
gradients or a single `strokeRect` with `globalAlpha` proportional to remaining time and severity.

### E3 — Damage panel *(30 min)*

New `drawDamagePanel(ctx, x, y, damage, uiScale)` in `src/renderer/ui/HUDElements/DamagePanel.ts`,
following the shape of the existing `HUDElements/*` draw functions (they are all pure
`(ctx, x, y, …) => void`).

Six cells labelled `ENG L-WG R-WG FUS TAIL CPT`, coloured from `damage.zones[zone]`:
`< 0.25` green `#00ff44` · `< 0.6` amber `#ffb000` · else red `#ff2020`. Plus `FIRE` and `ENG FAIL`
flags from `damage.onFire` / `damage.engineFailed`.

Placement: top-left, below the wingman badge (`edgePadY + headingBandH + 40`). That corner is
otherwise empty; the bottom-left is already crowded with G-meter, throttle, fuel, CMDS and weapons
status. Eyeball it at both 1600×900 and 1920×1080.

### E4 — "NO LOCK" feedback *(10 min)*

`PlayerAircraft.ts:343` returns silently when an AIM-120 is selected with no STT lock:

```ts
if (store.weaponId === 'aim120b' && !sttTargetId) {
  this.weaponInhibit = 'NO LOCK'   // new public field, cleared by the HUD after display
  return
}
```
Have `HUD.drawMasterCaution` (`HUD.ts:653`) pick it up as a top-priority amber cue for ~1.5 s. It
already sorts cues by `warn` and handles flashing, so this is one entry in the `cues` array.

Consider applying the same rule to the R-77 — right now the two nations behave differently for no
player-visible reason.

**Verify:** take a gun hit from an AI and confirm sound + flash + a zone going amber. Press F with
an AMRAAM and no lock, confirm "NO LOCK" appears. Take enough damage to lose an engine and confirm
`ENG FAIL` lights before the thrust loss becomes confusing.

---

## S3-F — Small fixes batch *(45 min)*

Six unrelated one-to-five-line changes. One commit.

| # | Change | File |
|---|---|---|
| 1 | Graphics quality: pass `options.postFXQuality` into `new PostFXManager(...)` (4th arg, already supported) and extend the presets to also set `shadowMap.enabled` / `mapSize` / `setPixelRatio` | `FlightSession.ts:183`, `PostFXManager.ts:9-13`, `SceneManager.ts:25-41` |
| 2 | Fired stores stay on the pylons: `activeHardpoints` ignores `remainingRounds` — add `.filter(s => s.remainingRounds > 0)` | `Aircraft.ts:397` |
| 3 | RWR range gate: skip contacts beyond ~150 km and those whose `getRadarInfo()` is `null` | `RWR.ts:18-33` |
| 4 | G-LOC default off + relabel to "G-LOC blackout (realistic G tolerance — you can pass out in a hard sustained turn)" | `Settings.ts`, `FlightSession.ts:45`, `LoadoutScreen.ts:317-321` |
| 5 | Controls reference: add a WINGMEN group (1/2/3/4), add F11, relabel F12 as "Sandbox / debug panel" | `controlsReference.ts:11-60` |
| 6 | Free Flight briefing: reword for a player, keep the F12 pointer | `scenarios.ts:7` |

For #1, suggested preset extension:

| Quality | Bloom | Shadows | Pixel ratio |
|---|---|---|---|
| HIGH | full-res | PCFSoft 2048 | ≤ 2 |
| MEDIUM | half-res | PCF 1024 | ≤ 1.5 |
| LOW | off | disabled | 1 |

**Verify #1 specifically:** run the same scenario at HIGH and at LOW on the weakest machine in the
group and compare frame times. This is the single largest GPU lever in the build.

---

## Stage 3 exit criteria

Hand the build to one person with no instructions beyond *"fly and shoot something."* Every
question they have to ask is a bug in this stage. Specifically they should not need to ask: how do
I turn it down, how do I make it fullscreen, why is my keyboard dead, why did my plane stop
turning, why won't my missile fire.

---

# Stage 4 — Build the multiplayer game

**Goal:** the thing the playtest is actually for. **Estimate:** ~8 hours.
**Depends on:** Stages 2 and 3. **Blocks:** the playtest.

The internal order matters: the callsign field must land before the kill feed, and the death event
before the scoreboard.

---

## S4-A — Mission plumbing and the dogfight scenario *(1 h)* — **P0**

**Files:** `src/renderer/mission/scenarios.ts`, `src/renderer/FlightSession.ts`,
`src/renderer/ui/LoadoutScreen.ts`

**1. New scenario** in `scenarios.ts`, added to `SCENARIO_CATALOG` (line 170):

```ts
export const DOGFIGHT: ScenarioDescriptor = {
  id: 'dogfight',
  name: 'Dogfight (Multiplayer)',
  description: 'Free-for-all against other players. No AI, no objectives.',
  briefing:
    'Free-for-all. Everyone else in the session is hostile — there are no teams and no AI. ' +
    'You respawn automatically a few seconds after you are shot down. ' +
    'Host or join a lobby on this screen, then launch.',
  playerSpawn: { positionNED: [0, 0, -5000], velocityNED: [250, 0, 0] },
  enemies: [], wingmen: [], groundTargets: [], objectives: [],
  winConditions: [],
  loseConditions: ['player_killed', 'player_ejected'],   // ← the bit that matters
  timeOfDay: 'DAY',
  weather: 'CLEAR',
}
```

The `loseConditions` are what make death produce an outcome at all — see the next item for why
that is not sufficient on its own.

**2. Fix the unreachable ejected fallback.** `FlightSession.updateMissionEnd` (line ~455) puts the
`player.state.ejected` fallback in the `else` branch of `if (this.missionTracker)`. A tracker
always exists, so it never runs — which is why dying in Free Flight freezes the aircraft forever.
Restructure so it fires whenever the tracker returned no outcome:

```ts
if (this.missionTracker) {
  const evaluation = this.missionTracker.evaluate({ /* … */ })
  if (evaluation.outcome) { this.scheduleMissionEnd(evaluation.outcome, DELAY[evaluation.outcome]); return }
}
// unconditional safety net — any scenario authored without lose conditions still terminates
if (this.player.state.ejected) {
  this.scheduleMissionEnd(playerKilled ? 'killed' : 'ejected', 4)
}
```

**3. Lock the environment in multiplayer.** In `LoadoutScreen.render()`, when `this.lobbyConnected`
is true: force `this.timeOfDay = this.scenario.timeOfDay ?? 'DAY'` and
`this.weather = this.scenario.weather ?? 'CLEAR'`, set `sel.disabled = true` on both ENVIRONMENT
selects, and show a one-line note ("Environment is locked to the mission default in multiplayer so
all players see the same sky"). Otherwise two friends fly in the same airspace at different times
of day.

**4. Suppress AI spawning in multiplayer**, belt-and-braces, so picking Head-On BVR in a lobby
cannot produce phantom per-client bandits. In `FlightSession.startInternal` (line ~283):

```ts
const isMultiplayer = this.multiplayerConfig.mode !== 'single' && this.multiplayer !== null
const spawnCounts = isMultiplayer
  ? { enemies: 0, groundTargets: 0 }
  : spawnScenario(this.scenario, this.entityManager, this.player)
```
Plus a warning banner on `LoadoutScreen` when connected to a lobby with a non-dogfight scenario
selected.

**Verify:** single-player Free Flight — die, confirm the debrief appears instead of the freeze.
Then dogfight solo — confirm no AI spawn and death produces a `killed` outcome.

---

## S4-B — Callsigns end to end *(1 h 15 min)*

`NetPlayerProfile` is currently `{ aircraftId: string }` — the entire player identity. The lobby
shows `peer_1 - F-22A Raptor - IN LOBBY`.

**Files:** `src/shared/network/MultiplayerTypes.ts`, `src/shared/network/validation.ts`,
`src/renderer/ui/LoadoutScreen.ts`, `src/renderer/ui/HUD.ts`, `src/renderer/FlightSession.ts`

1. `NetPlayerProfile` gains `callsign: string`.
2. `isValidProfile` (`validation.ts:25`) gains: `typeof o['callsign'] === 'string'`, length 1–24,
   and **strip control characters** — it is rendered as text on every other client, so treat it as
   untrusted input. `validation.test.ts` already covers `isValidProfile`; extend it.
3. `LoadoutScreen`: a text input above the aircraft grid, persisted via
   `saveSettings({ callsign })`, defaulting to `''`. On change call the existing
   `this.lobbyClient?.updateProfile({ aircraftId, callsign })` (the `profile-update` path already
   works end to end at `LoadoutScreen.ts:213`).
4. Empty callsign → fall back to the peer id at render time, never store a fabricated one.
5. `getLobbyRows()` (`LoadoutScreen.ts:598`) renders callsign instead of `peer_N`.
6. `HUD.drawSituationalMarkers` (`HUD.ts:1109`) labels remote aircraft. It iterates
   `entityManager.getEnemies()`, which returns `Aircraft`, so the callsign needs to reach
   `NetworkAircraft` — add a `callsign` field set in `EntityManager.upsertRemotePlayer` (it already
   receives the profile's `aircraftId`; pass the whole profile through from
   `FlightSession.syncMultiplayer:570`).

**Verify:** two clients, both set a callsign, both see the other's in the lobby list and floating
above the aircraft in flight. Change it mid-lobby and confirm it propagates.

---

## S4-C — Death events and scoring *(1 h 30 min)*

**Files:** `src/shared/network/MultiplayerTypes.ts`, `src/shared/network/validation.ts`,
`src/server/GameServer.ts`, `src/renderer/network/MultiplayerClient.ts`,
`src/renderer/FlightSession.ts`

**Protocol.** Follow the existing `hit` precedent, which has the right security shape already:
the client never states its own id, the server stamps it.

```ts
// ClientMessage
| { type: 'death'; killerId: string | null }
// ServerMessage
| { type: 'death'; victimId: string; killerId: string | null; victimKills: number; victimDeaths: number }
```

**Server** (`GameServer.ts`, alongside the `hit` handler at line 193):

```ts
if (msg['type'] === 'death') {
  if (!peer.profile) return
  const killerId = msg['killerId']
  if (killerId !== null && typeof killerId !== 'string') return
  peer.deaths++
  const killer = typeof killerId === 'string' ? peers.get(killerId) : undefined
  if (killer && killer.id !== peerId) killer.kills++
  broadcast({ type: 'death', victimId: peerId, killerId: killer ? killer.id : null,
              victimKills: peer.kills, victimDeaths: peer.deaths })
  return
}
```

Add `kills` / `deaths` to `PeerRecord` (line 47) initialised to 0, and include them in the
`welcome` peer list — this is ~10 extra lines and it means **late joiners see correct standings**
instead of starting everyone at zero. Note `broadcast` here has no `exceptPeerId`: the victim
needs its own confirmed event back so every client's scoreboard is built from the same stream.

**Killer attribution** is client-side on the victim, using the hook from S3-E1. In
`FlightSession.syncMultiplayer`'s inbound-hit loop (line ~584), record
`this.lastDamage = { sourceId: hit.sourceId, atMs: performance.now() }` before applying. On death,
the killer is `lastDamage.sourceId` if it is within ~10 s, else `null` (crashed into the ground,
flew into a hill, ejected voluntarily).

Emit from `scheduleMissionEnd` when the outcome is `killed` or `ejected` and multiplayer is live.

**Verify:** `GameServer.test.ts` already exists and exercises the relay — add a case for the death
message. Then two clients: A guns down B, both clients log the same death event with A as killer.
Then B crashes into terrain solo and the killer is `null`.

---

## S4-D — Kill feed and scoreboard *(1 h 30 min)*

**Files:** `src/renderer/ui/HUD.ts`, new `src/renderer/ui/HUDElements/KillFeed.ts`,
new `src/renderer/ui/HUDElements/Scoreboard.ts`

**Kill feed.** Four lines max, `KILLER ▸ VICTIM`, fading after 6 s, own kills highlighted. Feed it
from a `HUD.notifyKill(killerName, victimName, involvedLocal)` method called by `FlightSession`
when a death event arrives. Reuse the `decoyFlashRemainSec` timer pattern and remember to include
the feed in the `needsFlash` repaint check at `HUD.ts:124` — the HUD is capped at 30 Hz and skips
repaints when nothing changed, so a fading element that is not in that check will visibly stutter.

Placement: below the missile TTI panel on the right (`ttiPanelY + 90`). Check the collision case
where the targeting pod is active — the FLIR overlay is a 180 px square in that same corner
(`HUD.ts:~280`).

**Scoreboard.** Held-key overlay listing callsign / kills / deaths / aircraft, sorted by kills.

**Key choice: hold `KeyN`.** Tab is the conventional scoreboard key but it is already the camera
toggle (`CameraManager.ts:34`), documented in both the README and the in-game reference — changing
a documented control days before a playtest is exactly the churn the audit warns against.
Verified free: `H I J M N Y`, `Digit5-0`, `F3-F10`. Also show the standings automatically on the
respawn overlay (S4-E), which is when people most want to see them and are not flying.

**Verify:** three-way session; kill feed lines appear on all three clients with correct names;
scoreboard totals agree across clients after several kills; a late joiner sees non-zero standings.

---

## S4-E — In-flight respawn *(2 h 30 min)*

The largest single item. Currently death tears down the entire session — scene, HUD, audio graph,
cockpit, post-FX — and routes through debrief → loadout → relaunch.

**Files:** `src/renderer/entities/PlayerAircraft.ts`, `src/renderer/FlightSession.ts`,
new `src/renderer/ui/RespawnOverlay.ts`

**1. `PlayerAircraft.respawn()`.** `resetPosition()` already exists (line 486) and clears `ejected`,
fuel, gear and gear collapse — but it hardcodes `[0,0,-5000]` and does not touch damage, stores or
control shaping. Put the whole thing behind one method on `PlayerAircraft`, because
`resetFlightControlShaping()` is `protected` on `Aircraft` and cannot be called from the session:

```ts
respawn(): void {
  this.resetPosition()
  this.damage = defaultDamageState()
  this.reloadWeapons()          // stores + gun + CMDS
  this.voluntaryEject = false
  this.gloc.reset()
  this.resetFlightControlShaping()
  this.radar.unlockSTT()
  this.missiles.dispose()       // drop missiles the dead pilot still had in flight
  this.selectedWeaponIndex = 0
}
```
Check `MissileSystem.dispose()` leaves the system reusable — it removes meshes and disposes
thrusters/trails but does not clear the `missiles` array. Add a `clear()` if needed rather than
overloading `dispose()`.

**2. Session flow.** In `updateMissionEnd`, intercept before `scheduleMissionEnd`:

```ts
const isMultiplayer = this.multiplayerConfig.mode !== 'single' && this.multiplayer !== null
if (isMultiplayer && (outcome === 'killed' || outcome === 'ejected')) {
  this.beginRespawn(outcome)   // does NOT call onComplete
  return
}
```
`beginRespawn` sends the death event (S4-C), shows the overlay, and sets a 5 s timer. Track it in
the same `completionTimer` slot or add a `respawnTimer` — either way it **must** be cleared in
`dispose()` (line 634 already clears `completionTimer`; miss this and you get a callback into a
torn-down session).

Keep `sortieStats` and `entityManager.killCount` accumulating across respawns so the eventual
debrief covers the whole session. Also clear `seenInboundMissileIds` on respawn or the RWR
"new missile" detection will suppress the first warning of your next life.

**3. Respawn position.** Reusing the scenario spawn point exactly means everyone stacks and you
respawn next to whoever just killed you. Apply `applyPlayerSpawn` then `applyPeerSpawnOffset`
(existing, line 290), then scatter ±3 km horizontally with a random heading at scenario altitude.

**4. Overlay.** New `RespawnOverlay` class following the `PauseMenu` precedent (own `<div>`
appended to `document.body`, `dispose()` removes it). Shows "SHOT DOWN BY <callsign>" or
"DESTROYED", a 5→0 countdown, and the current standings. **Esc must still open the pause menu**
while it is up so ABORT TO DEBRIEF remains reachable — that is now the only way to leave a
multiplayer session deliberately.

**5. Single-player is unchanged.** Missions depend on death ending the sortie; do not touch that
path.

**Verify:** die five times in a row as fast as possible. No leaked overlays, no stacked timers, no
audio duplication, no growing entity count, ammo restored each time, and the scoreboard reads 0/5.
Then abort to debrief and confirm the accumulated stats look right.

---

## Stage 4 exit criteria

Two clients against a local `npm run server`, in this order:

1. Both see each other's callsigns in the lobby and in flight
2. A gun kill produces a kill-feed line naming both, on both clients
3. The victim respawns in place without leaving the flight
4. The scoreboard increments and agrees across clients
5. A mid-session join lands correctly and sees existing standings
6. Alt-F4 on one client removes the aircraft cleanly on the other

---

# Stage 5 — Pre-flight

**Estimate:** ~2 hours. **Depends on:** everything. No new code — this stage finds the problems
that only exist in a packaged build.

## S5-A — Local two-client rehearsal *(30 min)*

Run `npm run server` on one machine and connect two dev clients. Walk the entire Stage 4 exit
criteria plus the stress list from audit §16: simultaneous kills, late join, ungraceful
disconnect, countermeasure saturation, missile saturation, deck-level fight. Keep the server log —
it timestamps every join, disconnect and terminated socket.

## S5-B — Packaged build and fresh install *(1 h)*

```bash
npm run ci && npm run dist:win
```

Install on a machine that has **never run the dev server** — no `localStorage`, no `node_modules`,
no `ELECTRON_RENDERER_URL`. This is where the distinct packaging failures show up:

- **Audio paths.** `getAudioBaseUrls()` (`main/index.ts:96`) probes three locations; only the
  `app.asar.unpacked` one is correct in a packaged build. Confirm the console reports
  `25 / 25 sound files loaded` — a silent fallback to synthesis is easy to miss.
- **DevTools** must not open (gated on `ELECTRON_RENDERER_URL`).
- **Version badge** — `src/preload/index.ts:143` hardcodes `'0.1.5'` independently of
  `package.json`. Bump both or the badge lies.
- **Firewall.** First host attempt triggers a Windows Defender prompt. Confirm allowing it works
  and that a second machine can then connect.
- **Fresh settings.** With no stored `PilotSettings`, every new field from S3-A must fall back to
  its default without throwing.

## S5-C — Checklist sign-off *(30 min)*

Work audit §15 top to bottom, every box. Then do one full two-player session end to end **before**
inviting the wider group — the first real session should surface content problems, not setup
problems.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Respawn leaks timers/overlays across a `dispose()` | Medium | Clear every timer in `dispose()`; hammer-test with five rapid deaths |
| `MissileSystem.dispose()` is not reusable after respawn | Medium | Add an explicit `clear()`; do not overload `dispose()` |
| Kill feed stutters because it is missing from the HUD `needsFlash` check | Medium | Add it when you add the timer, not after |
| Scoreboards diverge between clients | Low | Server-side counters in `welcome` (S4-C) make this self-correcting |
| Callsign renders as untrusted text | Low | Length-cap and strip control chars in `isValidProfile` |
| Graphics presets do not actually help the weak machine | Low | Measure HIGH vs LOW before the session, not during |
| Stage 1–2 work is lost or entangled because it is uncommitted | Medium | Commit it before branching for Stage 3 — see the precondition section |
| Parallel sessions editing the same files | Medium | Stages 1–2 landed in this tree while this plan was being written. Check `git status` before starting each work item; the line numbers cited here were re-verified against the current tree but will drift |

---

## What is explicitly *not* in this plan

Per audit §6 and §13: server-authoritative damage, AI replication, teams, full keybind remapping,
complete gamepad mapping, ping display, match timer, reconnect, extra game modes. The debug
overlay ships as-is (audit §13).

Also untouched by design: the flight model and physics stack, the networking transport, the
avionics suite, the existing HUD symbology, the procedural models, and the persistence layer —
all of which work and none of which the playtest depends on changing.
