# FSim — Friends Release Readiness Audit

**Repo:** `BrWri4227/FSim` · **Version audited:** 0.1.5 · **Branch:** `BW/Release-sanity-check` (`69cd7a5`)
**Date:** 2026-09-03
**Scope:** technical + gameplay readiness for a small private multiplayer playtest with friends.

Evidence markers used throughout:
- **Confirmed** — verified directly from source, a test run, or a build run.
- **Strongly Suspected** — the implementation provides strong evidence, but the exact in-game feel was not observed.
- **Needs Playtesting** — cannot be settled by static analysis.

**Environment limitation:** this audit was performed on Windows without launching the Electron
client or standing up a real two-machine LAN session. `npm run typecheck`, `npm run lint`,
`npm run test`, `npm run build` and `npm run build:server` were all executed. Everything
described as runtime *feel* (frame rate, dogfight pacing, netcode smoothness) is inference from
code, not observation, and is labelled accordingly.

---

## 1. Executive Summary

### Rating: **PLAYABLE WITH MAJOR ISSUES**

FSim is a genuinely impressive piece of engineering for a hobby project. The flight model is a
real 13-state RK4 rigid-body sim with aero coefficient tables, mass properties, atmosphere,
an FCS limiter and a physiological G-LOC model. There are ten flyable airframes with bespoke
exteriors and (mostly) bespoke animated cockpits, a working radar/RWR/CMDS avionics stack, a
serious missile guidance implementation (APN with loft, datalink, ARH seeker SNR, IR/chaff
seduction), a dedicated headless relay server, and a clean codebase: typecheck passes, lint
passes with 16 unused-import warnings and zero errors, 167/168 unit tests pass, and both the
app and the server build cleanly. There are effectively **no TODO/FIXME/HACK comments** in
24k lines of source — this is unusually tidy.

The problem is the gap between what is built and what a **multiplayer friends session** needs.

The single-player mission path is close to ready. The multiplayer path — the entire point of the
upcoming playtest — is not. There is **no PvP game mode**. The five scenarios in the catalog are
all single-player PvE missions; each connected client independently spawns and simulates its own
private copy of the scenario AI, evaluates its own win/lose conditions, and picks its own weather
and time of day. The only scenario two friends can meaningfully share is **Free Flight**, in which
**dying leaves the player permanently frozen in mid-air with no way out except the pause menu**.

On top of that, the combat loop itself has two mechanical defects that will make weapons feel
broken: the missile proximity fuse is a per-tick radius test with a dead closest-approach
fallback (so high-closure missiles routinely pass straight through), and a single missile hit
can never destroy an aircraft by design (max severity 0.65 vs a 1.0 kill threshold). There is
also **no damage indication anywhere in the HUD and no hit or explosion sound**, so a player has
no way to know they were hit, how badly, or by whom.

None of this is a rewrite. The blocking items are a focused set of changes — roughly one to two
solid weekends — and most of the supporting machinery (lobby, relay, hit replication, remote
interpolation, spawn offsets, lobby-preserving debrief flow) already exists and looks correct.

**Bottom line:** do not send this build out yet. Fix the five P0s and the top handful of P1s
and it becomes a legitimate Friends Alpha.

---

## 2. Current Game State

| System | Status | Notes |
|---|---|---|
| Build / packaging | **Working** | `npm run build` and `npm run build:server` both exit 0. `electron-builder` configured for win/mac. Not executed in this audit. |
| Typecheck / lint | **Working** | 0 errors, 16 unused-var warnings. |
| Unit tests | **Partially working** | 167/168 pass. One failure: `fa18e` missing from the turn-rate reference table, so `npm run ci` fails. |
| Flight model | **Working** | RK4 13-state, aero tables, mass props, atmosphere, engine spool + AB light-off, turbulence, weather. Well tested. |
| Ground handling / takeoff / landing | **Working** | Runway spawn, gear animation, tyre friction, sink-rate touchdown grading, gear collapse. |
| G-LOC / physiology | **Working** | Time-dose oxygen debt, AGSM, incapacitation, post-FX vignette. On by default. |
| Guns | **Partially working** | Ballistics fine; hit detection is a per-tick 5 m point test against a ~17 m/tick round → frequent pass-through. |
| Missiles — guidance | **Working** | APN, ARH loft/datalink/terminal, IR gimbal, flare/chaff seduction, coast. Good. |
| Missiles — lethality | **Broken** | Fuse tunnels at high closure; dead closest-approach code; single hit can never kill. |
| Damage model | **Working (invisible)** | Zone damage, cascades, flight penalties, structural failure. Not surfaced to the player anywhere. |
| Radar / RWR / CMDS / TGP | **Working** | Scan bars, RWS/TWS/STT/GMTI, detection ranges, RWR ring, flares/chaff with cooldowns. |
| HUD | **Working, dense** | Very complete F/A-18-style symbology. No damage, no scores, no MP info. |
| Cockpits | **Partially working** | 9 of 10 airframes get a bespoke cockpit; `fa18c` falls back to the generic placeholder tub. |
| AI | **Partially working** | BVR/WVR/evade/follow behaviours work. No terrain avoidance, no collision avoidance, only ever targets the local player. |
| Wingmen + radio commands | **Working** | 1/2/3/4 commands, HUD badge. Keys missing from the in-game controls list. |
| Ground targets / SAMs | **Working** | Health, SAM launches, GMTI, TGP/FLIR, AGM/LGB/bombs. |
| Audio | **Partially working** | 26 WAVs load with synth fallback; engine, RWR, GPWS, gun. **No hit/explosion sound. No volume control.** |
| Mission select / loadout / debrief | **Working** | Clean flow, persisted preferences, per-aircraft loadouts, logbook + career summary. |
| Pause menu | **Working** | Resume / restart / controls / abort. No settings. |
| Persistence | **Working** | Namespaced localStorage, crash-proof, 200-record logbook cap. |
| Multiplayer transport | **Working** | ws relay, validation, rate limits, heartbeat, deflate, quantisation, interpolation + extrapolation. |
| Multiplayer *gameplay* | **Missing** | No mode, no teams, no names, no scores, no kill feed, no respawn, no AI replication. |
| Settings UI (volume / graphics / keybinds) | **Missing** | `masterVolume` and `postFXQuality` are persisted but never read. No remapping, no sensitivity, no fullscreen. |
| Developer tooling in shipped build | **Present by design** | F12 opens a spawn / god-mode / weather panel. **Kept deliberately** — see §13. |

---

## 3. P0 — Release Blockers

### [P0] No multiplayer game mode
**Category:** Add · **System:** Missions / Multiplayer · **Confidence:** Confirmed · **Effort:** Medium · **Playtest Blocker:** Yes

**Current State.** `SCENARIO_CATALOG` ([scenarios.ts:170](src/renderer/mission/scenarios.ts:170)) contains five
entries: Traffic Pattern, Free Flight, Head-On BVR, CAP with Wingman, Strike Package. All five are
single-player PvE. There is no deathmatch, team deathmatch, or "dogfight" scenario.

**Problem.** Every client runs `spawnScenario()` locally ([ScenarioSpawner.ts:115](src/renderer/mission/ScenarioSpawner.ts:115)),
so in a shared session each player spawns their own private AI enemies at their own spawn point.
Those AI are never replicated — nothing in `NetPlayerState` carries them, and
`EntityManager.update` only ever hands AI `playerAsAircraft` as a target
([EntityManager.ts:198](src/renderer/entities/EntityManager.ts:198)). `MissionTracker` also evaluates
independently per client, so "Destroy both bandits" completes for each player separately against
different aircraft. Weather and time of day are chosen per-player on the Loadout screen
([LoadoutScreen.ts:292](src/renderer/ui/LoadoutScreen.ts:292)), so one friend can be flying at dusk in rain
while the other is in clear daylight, in the same shared airspace.

The only scenario that degrades gracefully is Free Flight — and see the next finding.

**Player Impact.** Two friends launch "Head-On BVR" together, each gets attacked by two MiG-29s
the other cannot see, each finishes the mission at a different moment and gets kicked to the
debrief screen while the other is still flying. It reads as completely broken.

**Recommended Change.** Add one scenario, `dogfight`, purpose-built for MP:
- `enemies: []`, `wingmen: []`, `groundTargets: []`
- `playerSpawn` airborne at ~5000 m, 250 m/s (reuse Free Flight's)
- `winConditions: []`, `loseConditions: ['player_killed', 'player_ejected']` — so death actually
  terminates the sortie and routes into the respawn loop (see next finding)
- Briefing text written for a human, not a developer: "Free-for-all. Everyone in the session is
  hostile. Last one flying buys the beer."
- Fix the environment divergence: when a lobby client is connected, either lock time-of-day and
  weather to the scenario defaults, or have the host broadcast them. The cheapest correct fix is
  to disable the two ENVIRONMENT selects in `LoadoutScreen.render()` while `this.lobbyConnected`
  is true and force `this.timeOfDay = scenario.timeOfDay ?? 'DAY'` / `weather = 'CLEAR'`.
- Optionally suppress scenario AI spawning entirely while a lobby client is present, so no mode
  ever produces phantom bandits.

**Implementation Notes.** `src/renderer/mission/scenarios.ts` (new descriptor + catalog entry),
`src/renderer/ui/LoadoutScreen.ts` (env lock when connected),
`src/renderer/mission/ScenarioSpawner.ts` or `FlightSession.startInternal` (skip AI spawn in MP).

---

### [P0] Death in Free Flight is an unrecoverable frozen state
**Category:** Fix · **System:** Mission / Flight session · **Confidence:** Confirmed · **Effort:** Tiny · **Playtest Blocker:** Yes

**Current State.** Free Flight has `winConditions: []` and `loseConditions: []`
([scenarios.ts:16](src/renderer/mission/scenarios.ts:16)).

**Problem.** Three interacting facts:
1. `MissionTracker.evaluate()` short-circuits both condition blocks when the arrays are empty and
   returns `{ outcome: null }` ([MissionTracker.ts:46](src/renderer/mission/MissionTracker.ts:46)).
2. `FlightSession.updateMissionEnd()` puts the "player ejected → end mission" fallback in the
   `else` branch of `if (this.missionTracker)` ([FlightSession.ts:455](src/renderer/FlightSession.ts:455)).
   A tracker always exists, so that fallback is unreachable.
3. `PlayerAircraft.update()` returns immediately when `state.ejected`
   ([PlayerAircraft.ts:145](src/renderer/entities/PlayerAircraft.ts:145)) — no integration, no input, nothing.

So on death in Free Flight the aircraft stops dead in mid-air, the mesh is hidden, no controls
respond, and the mission never completes. The only escape is Esc → ABORT TO DEBRIEF.

**Player Impact.** The first time anyone dies in the only MP-viable scenario, the game appears to
hang. On a Discord call this is the moment you have to explain a keyboard shortcut.

**Recommended Change.** Two independent fixes, both cheap — do both:
- Give the new `dogfight` scenario (and Free Flight) `loseConditions: ['player_killed', 'player_ejected']`.
- Make the fallback unconditional: move the `player.state.ejected` check in `updateMissionEnd`
  out of the `else` so it fires whenever the tracker returned no outcome. Belt and braces against
  any future scenario authored without lose conditions.

**Implementation Notes.** `src/renderer/FlightSession.ts:413-458`, `src/renderer/mission/scenarios.ts:3-18`.

---

### [P0] Missiles pass through targets — proximity fuse tunnels, closest-approach fallback is dead code
**Category:** Fix · **System:** Weapons / Warhead · **Confidence:** Confirmed · **Effort:** Small · **Playtest Blocker:** Yes

**Current State.** [`Warhead.checkProximityFuse`](src/renderer/weapons/Warhead.ts:5):

```ts
if (dist <= gate) return true
const prev = missile.prevMissDistanceM
missile.prevMissDistanceM = dist
if (prev !== null && dist > prev && prev <= gate) return true   // never fires
return false
```

**Problem.** Two compounding defects.

*The fallback is dead.* `prevMissDistanceM` is only ever written on the path where `dist > gate`,
so `prev <= gate` is unreachable. The closest-approach detonation never happens; the fuse is a
plain per-tick radius test.

*That radius test tunnels.* Fuse radii are 9–12 m (`aim9x` 11, `r73` 9, `aim120b`/`r77` 12). At a
head-on merge the missile is doing ~900 m/s against a 300 m/s target — ~1200 m/s closure, ~20 m of
travel per 1/60 s tick. The missile can step from 25 m out to 5 m past the target without ever
sampling inside the gate. A dead-centre pass detonates maybe half the time; a near-miss that
should still frag the target detonates almost never. The missile then either goes COAST or expires
on its battery timer.

**Player Impact.** "I had a perfect lock, the diamond went pitbull, and it flew straight through
him." Repeatedly. This is the single most morale-destroying bug class in an air combat game.

**Recommended Change.** Replace the point test with a swept closest-approach test over the tick.
Given missile position/velocity and target position/velocity, compute the relative closest
approach along the segment:

```
rel   = tgtPos - misPos ;  relV = tgtVel - misVel
t*    = clamp(-dot(rel, relV) / dot(relV, relV), 0, dt)
dmin  = |rel + relV * t*|
detonate if dmin <= gate   (and report dmin as the miss distance to computeLethality)
```

Feed `dmin` (not the end-of-tick distance) into `computeLethality` so grazing hits do
proportionate damage. Then delete `prevMissDistanceM` and its dead branch.

**Implementation Notes.** `src/renderer/weapons/Warhead.ts` (`checkProximityFuse`, `computeLethality`
call site), `src/renderer/weapons/MissileSystem.ts:434-451` (pass the computed miss distance
through instead of recomputing from `m.positionNED`), `src/renderer/types/weapons.ts`
(`prevMissDistanceM` removal). `Warhead.test.ts` already exists — extend it with a high-closure
fly-through case.

---

### [P0] A gamepad silently disables all keyboard flight control
**Category:** Fix · **System:** Input · **Confidence:** Confirmed (code) / Strongly Suspected (frequency) · **Effort:** Tiny · **Playtest Blocker:** Yes

**Current State.** [`InputManager.getControls`](src/renderer/input/InputManager.ts:54):

```ts
const gp = navigator.getGamepads()[0]
if (gp) { roll = gp.axes[0]; pitch = -gp.axes[1]; yaw = gp.axes[2]; /* triggers = throttle */ }
else    { /* WASD/QE/Shift/Ctrl */ }
```

**Problem.** The branch is exclusive and permanent for the session. Once slot 0 reports a gamepad
(Chromium exposes one after its first input event), **W/A/S/D/Q/E/Shift/Ctrl stop doing anything**
— forever, with no on-screen indication and no toggle. There is no fallback if the stick is idle.
Worse, none of the *weapon* controls are mapped to the pad: gun, missile, flares, radar, gear and
camera are all still keyboard-only. So the affected player can steer with a stick they may not
have intended to use, but cannot fly with the keys the game just told them to use.

**Player Impact.** A friend with an Xbox controller charging on the desk knocks it, and their jet
stops responding to the keyboard mid-flight. They will assume the game crashed.

**Recommended Change.** Blend instead of branching, and require actual deflection:

```ts
const gp = navigator.getGamepads()[0]
const padActive = !!gp && (Math.abs(gp.axes[0] ?? 0) > 0.15 || Math.abs(gp.axes[1] ?? 0) > 0.15 ||
                           Math.abs(gp.axes[2] ?? 0) > 0.15 || (gp.buttons[6]?.value ?? 0) > 0.1 ||
                           (gp.buttons[7]?.value ?? 0) > 0.1)
```
Read keyboard axes always; if `padActive`, take whichever of (pad, keyboard) has the larger
magnitude per axis. Keyboard throttle keys must keep working regardless. While you are in there,
map at least `fireGun` (RB / R1), `fireMissile` (A / cross) and `dispenseFlare` (B / circle) so a
pad user is not half-locked-out — or, if that is too much scope, print a one-line HUD advisory
"GAMEPAD ACTIVE — weapons on keyboard" when a pad is detected.

**Implementation Notes.** `src/renderer/input/InputManager.ts:54-142`. Consider a persisted
`inputDevice: 'auto' | 'keyboard' | 'gamepad'` in `PilotSettings` with a Loadout-screen select.

---

### [P0] `npm run ci` fails — FA-18E missing from the turn-rate reference table
**Category:** Fix · **System:** Data / Tests · **Confidence:** Confirmed · **Effort:** Tiny · **Playtest Blocker:** Yes (release gate)

**Current State.** `FA18E` was added to `AIRCRAFT_ROSTER` ([catalog.ts:16](src/renderer/data/aircraft/catalog.ts:16))
but `SUSTAINED_TURN_RATE_DEG_S` in [turnPerformance.ts:5](src/renderer/data/aircraft/turnPerformance.ts:5)
still lists only nine airframes. `TurnRateRegression.test.ts` iterates the roster and asserts
`expect(ref).toBeDefined()`.

**Problem.** Test run output:

```
FAIL  src/renderer/physics/TurnRateRegression.test.ts > fa18e sustained turn rate stays within reference band
AssertionError: expected undefined to be defined
Test Files  1 failed | 17 passed (18)
Tests  1 failed | 167 passed (168)
```

CI (`.github/workflows/ci.yml`) runs `npm run ci` on all three platforms and gates the packaging
jobs on it, so **the distributable build jobs never run**. That alone makes this a blocker for
shipping anything to friends via CI artifacts.

The deeper point: the FA-18E's turn performance has never been validated against a reference
band, unlike every other airframe. The README's feature list also still says nine aircraft and
omits the F/A-18E entirely.

**Player Impact.** None directly. But you cannot produce a signed-off build, and one roster
aircraft has unverified handling.

**Recommended Change.** Add an `fa18e: { min: 12, max: 20 }` entry (heavier and draggier than the
Hornet, so slightly below `fa18c`'s 12/21), then re-run `npm run test` and adjust the band if the
sim result falls outside it. Update the README roster line to list ten aircraft.

**Implementation Notes.** `src/renderer/data/aircraft/turnPerformance.ts`, `README.md`.

---

## 4. P1 — Should Fix Before Playtest

### [P1] No damage feedback anywhere — HUD, MFD, or audio
**Category:** Add · **System:** HUD / Audio · **Confidence:** Confirmed · **Effort:** Small · **Playtest Blocker:** No

**Current State.** A full per-zone damage model exists (`DamageState`, six zones, fire, engine
failure, structural failure, flight penalties). Grepping `damage` across `src/renderer/ui/HUD.ts`,
`src/renderer/ui/HUDElements/*.ts` and `src/renderer/cockpit/MFDPages/*.ts` returns **zero
matches**. `AudioManager`'s `AudioEvent` union has no hit, impact or explosion event, and
`SOUND_FILES` has no corresponding asset.

**Problem.** When you are hit you get: no sound, no flash, no caution light, no readout. The only
cues are indirect and delayed — thrust loss, degraded roll/pitch authority, a fuel leak, and a
damage tint on the external mesh that is invisible in the cockpit view you are almost certainly
flying in. `drawMasterCaution` ([HUD.ts:653](src/renderer/ui/HUD.ts:653)) covers missile threat,
fuel, AoA and gear — nothing about airframe condition.

**Player Impact.** "Why did my plane suddenly stop turning?" Players cannot answer *I was hit →
what hit me → how bad is it → should I disengage*. In a friends dogfight this is the difference
between a readable fight and random deaths.

**Recommended Change.** Three small pieces, in order of value per hour:
1. **Hit flash + audio.** Wire a callback on the *receiving* side. In single-player,
   `GunSystem.update` / `MissileSystem.update` already call `applyHit` on the player when the
   player is the target; in MP, `FlightSession.syncMultiplayer` applies inbound hits at
   [FlightSession.ts:583](src/renderer/FlightSession.ts:583). Add an `onDamageTaken(severity, zone)`
   hook at both sites → red HUD edge vignette for ~0.4 s + a new `HIT` audio event.
2. **Damage panel.** A six-cell zone block near the CMDS counters in `HUD.render` — green /
   amber / red per zone from `player.damage.zones`, plus `FIRE` and `ENG FAIL` flags. ~40 lines.
3. **Explosion sound.** `ExplosionManager.spawn` is the single choke point; give it a distance-
   attenuated boom. There is currently no explosion audio at all, which also makes your own kills
   feel weightless.

**Implementation Notes.** `src/renderer/ui/HUD.ts` (new `drawDamagePanel`, hit-flash timer like
the existing `decoyFlashRemainSec` pattern), `src/renderer/audio/AudioManager.ts` (new
`AudioEvent` members + `SOUND_FILES` entries; the synth fallback path means missing WAVs degrade
gracefully), `src/renderer/scene/ExplosionEffect.ts`, `src/renderer/FlightSession.ts`.

---

### [P1] A single missile hit can never destroy an aircraft
**Category:** Change · **System:** Weapons / Damage · **Confidence:** Confirmed · **Effort:** Tiny · **Playtest Blocker:** No

**Current State.** [MissileSystem.ts:438](src/renderer/weapons/MissileSystem.ts:438): `const severity = lethality * 0.65`.
`computeLethality` returns 1.0 inside the lethal radius, so the best possible primary hit deposits
0.65 into one zone. `applyHit` destroys at `zone >= 1.0`, `FUSELAGE > 0.88`, or `COCKPIT > 0.80`
([DamageModel.ts:29](src/renderer/systems/DamageModel.ts:29)).

Secondary fragmentation adds 0.15 to three other zones — but only when
`!target.state.invincible` ([MissileSystem.ts:442](src/renderer/weapons/MissileSystem.ts:442)), and every
`NetworkAircraft` is constructed with `state.invincible = true`
([NetworkAircraft.ts:45](src/renderer/entities/NetworkAircraft.ts:45)). Furthermore only the *primary*
hit is forwarded over the wire via `setOnTargetHit`, so remote players never receive the
secondaries at all.

`hitZoneFromMissileApproach` can only return ENGINE, WING_LEFT, WING_RIGHT or FUSELAGE — never
COCKPIT — so the 0.80 cockpit shortcut is unreachable from a missile.

**Problem.** It takes two clean direct hits on the *same zone* to kill a player. Since the zone is
chosen from the approach vector, a player can absorb three or four AMRAAMs and keep flying.

**Player Impact.** Missiles feel like fireworks. Combined with the fuse tunneling above, the
expected outcome of a BVR engagement between two friends is that nobody dies and everybody runs
out of missiles.

**Recommended Change.** Raise the primary severity so a lethal-radius hit is a kill and a
near-miss is a mission kill. Suggested: `severity = lethality * lethality * 1.15` — a dead-centre
hit (lethality 1.0) gives 1.15 → clamped to 1.0 → destroyed; lethality 0.7 gives 0.56 → heavy but
survivable; lethality 0.4 gives 0.18 → a scratch. Tune from there. Also replicate the secondary
fragmentation over the network, or simply drop secondaries now that the primary is decisive.

This is a balance value, so treat the exact number as **Needs Playtesting** — but "one good
missile kills" is the right target for a friends dogfight.

**Implementation Notes.** `src/renderer/weapons/MissileSystem.ts:434-448`. `DamageModel.test.ts`
covers `applyHit`; add a case asserting a lethality-1.0 missile destroys.

---

### [P1] Gun rounds tunnel through targets
**Category:** Fix · **System:** Weapons / Guns · **Confidence:** Confirmed · **Effort:** Small · **Playtest Blocker:** No

**Current State.** [GunSystem.ts:10](src/renderer/weapons/GunSystem.ts:10) `const HIT_RADIUS = 5`, and the
hit test at [GunSystem.ts:115](src/renderer/weapons/GunSystem.ts:115) is `v3dist(round.positionNED, enemy.state.positionNED) < HIT_RADIUS`
evaluated once per tick.

**Problem.** An M61 round leaves the muzzle at 1030 m/s plus aircraft velocity — call it 1250 m/s,
or ~21 m of travel per 1/60 s tick, against a 5 m sphere. A round passing exactly through the
target's centre has roughly a 10/21 chance of being sampled inside the sphere; anything off-axis
is worse. Roughly half of well-aimed rounds simply miss.

Secondary issues in the same function: rounds spawn at the aircraft's centre rather than the gun
port, and the inner loop does not `break` after a hit, so two targets within 5 m of each other
both take damage from one round.

**Player Impact.** Guns feel unreliable and unrewarding, which matters most in exactly the
close-in merge that makes a friends dogfight fun. The HUD already draws a proper gun funnel, so
players will be aiming correctly and still missing.

**Recommended Change.** Same swept test as the missile fuse — segment (prev position → new
position) against a sphere of radius ~5–8 m around the target. Cheap: compute the closest point
on the segment to the target centre and compare distance. Add `break` after a hit. Optionally
spawn from the gun port using the aircraft's nose offset.

**Implementation Notes.** `src/renderer/weapons/GunSystem.ts:100-141`. Keep the previous position
on `GunRoundState` (or recompute as `pos - vel*dt`).

---

### [P1] Multiplayer has no player names, no scores, no kill feed, no kill attribution
**Category:** Add · **System:** Multiplayer / HUD · **Confidence:** Confirmed · **Effort:** Medium · **Playtest Blocker:** No

**Current State.** `NetPlayerProfile` is `{ aircraftId: string }`
([MultiplayerTypes.ts:13](src/shared/network/MultiplayerTypes.ts:13)) — that is the entire player
identity. The lobby list renders `peer_1 - F-22A Raptor - IN FLIGHT`
([LoadoutScreen.ts:608](src/renderer/ui/LoadoutScreen.ts:608)). `EntityManager.killCount` only increments
in `despawn()`, which is only reachable for AI aircraft
([EntityManager.ts:109](src/renderer/entities/EntityManager.ts:109)) — killing a remote player credits
nothing. There is no in-flight roster, scoreboard, kill feed, or ping display.

**Problem.** Four friends fly a dogfight and nobody knows who anyone is, who shot them, or who is
winning. The debrief shows `kills: 0` for a session in which they shot down three people.

**Player Impact.** This is the difference between "we flew planes near each other" and "we played
a game." It is the single highest fun-per-hour item in this report.

**Recommended Change.** Minimum viable, in dependency order:
1. **Names.** Add `callsign: string` to `NetPlayerProfile`; extend `isValidProfile` to check it
   (non-empty, ≤ 24 chars, strip control characters — it will be rendered as text). Add a text
   input on the Loadout screen persisted as `PilotSettings.callsign`. Show it in the lobby list
   and above the remote aircraft's HUD marker in `drawSituationalMarkers`.
2. **Death event.** Add `{ type: 'death'; victimId: string; killerId: string | null }` to the
   client/server message unions. The victim's client is authoritative (it already owns its own
   damage state) — emit on `scheduleMissionEnd('killed'|'ejected')`. Track the last inbound hit's
   `sourceId` within ~10 s as the killer.
3. **Kill feed + scoreboard.** A four-line kill feed top-right of the HUD (`KILLER ▸ VICTIM`,
   fading after 6 s) and a Tab-held scoreboard listing callsign / kills / deaths. Note Tab is
   currently the camera toggle ([CameraManager.ts:34](src/renderer/camera/CameraManager.ts:34)) — use a
   different key or move the camera toggle.

**Implementation Notes.** `src/shared/network/MultiplayerTypes.ts`, `src/shared/network/validation.ts`,
`src/server/GameServer.ts` (relay the new message type; it is a pure relay so this is ~8 lines),
`src/renderer/network/MultiplayerClient.ts`, `src/renderer/ui/LoadoutScreen.ts`,
`src/renderer/ui/HUD.ts`, `src/renderer/persistence/Settings.ts`.

---

### [P1] Dying in multiplayer drops you out of the shared flight
**Category:** Change · **System:** Multiplayer / Session flow · **Confidence:** Confirmed · **Effort:** Medium · **Playtest Blocker:** No

**Current State.** Death → `scheduleMissionEnd('killed', 4)` → `finishMission` → `App.enterDebrief`
→ `FlightSession.dispose({ preserveMultiplayer: true })` → DebriefScreen → LoadoutScreen (lobby
restored, `returnToLobby()` sent at [LoadoutScreen.ts:143](src/renderer/ui/LoadoutScreen.ts:143)) → re-pick
aircraft → LAUNCH MISSION.

**Problem.** It works — the lobby survives, which is good design — but every death costs a full
teardown of the scene, HUD, audio graph, cockpit and post-FX, plus two screens of clicking. That
is likely 3–10 seconds of loading and menus per death. In a four-player dogfight where deaths come
every couple of minutes, players will spend a large fraction of the session in menus.

**Player Impact.** Momentum killer. **Needs Playtesting** to know how bad the teardown/rebuild
hitch actually is.

**Recommended Change.** Add an in-session respawn instead of a session exit, for MP only:
- On `outcome === 'killed' | 'ejected'` while `multiplayerConfig.mode !== 'single'`, show a
  5-second "RESPAWN" overlay in-flight rather than calling `onComplete`.
- Respawn = reset the player in place: `PlayerAircraft.resetPosition()` already exists
  ([PlayerAircraft.ts:486](src/renderer/entities/PlayerAircraft.ts:486)) and clears `ejected`, fuel, gear
  and gear collapse. Add `this.damage = defaultDamageState()`, `reloadWeapons()`,
  `resetFlightControlShaping()`, `gloc.reset()`, and apply the peer spawn offset so players do not
  stack. Keep the ESC → ABORT path as the way to actually leave.
- Keep single-player behaviour exactly as it is (debrief on death) — the mission structure depends
  on it.

**Implementation Notes.** `src/renderer/FlightSession.ts` (`updateMissionEnd`, `scheduleMissionEnd`,
new `respawnPlayer()`), `src/renderer/entities/PlayerAircraft.ts` (`resetPosition` completeness),
`src/renderer/entities/Aircraft.ts` (`resetFlightControlShaping` is already `protected`).

---

### [P1] Explosions play 3–7× too fast
**Category:** Fix · **System:** VFX · **Confidence:** Confirmed · **Effort:** Tiny · **Playtest Blocker:** No

**Current State.** The explosion particle pool is a **per-scene singleton** held in a `WeakMap`
([ExplosionEffect.ts:17](src/renderer/scene/ExplosionEffect.ts:17)), but every `MissileSystem.update` calls
`this.explosions.update(dt)` on it ([MissileSystem.ts:235](src/renderer/weapons/MissileSystem.ts:235)).

**Problem.** A session has one `MissileSystem` for the player, one for SAMs, one for debug
missiles, and one per AI aircraft and wingman. In Head-On BVR that is five systems, so the shared
pool is advanced 5 × dt every tick. The 2.2 s explosion lifetime becomes ~0.44 s.

**Player Impact.** Kills and impacts barely register visually — a brief orange pop instead of a
fireball. Directly undermines the combat feedback this build most needs.

**Recommended Change.** Advance the pool exactly once per tick. Cleanest: give the module a
`stepExplosionPool(scene, dt)` free function called once from `FlightSession.tick`, and remove the
`this.explosions.update(dt)` line from `MissileSystem.update`. Alternatively guard with a
per-scene frame stamp.

**Implementation Notes.** `src/renderer/scene/ExplosionEffect.ts`, `src/renderer/weapons/MissileSystem.ts:235`,
`src/renderer/FlightSession.ts` (`tick`).

---

### [P1] No volume control, and AWACS speech bypasses the mixer entirely
**Category:** Add · **System:** Audio / Settings · **Confidence:** Confirmed · **Effort:** Small · **Playtest Blocker:** No

**Current State.** `PilotSettings.masterVolume` exists and defaults to 1.0
([Settings.ts:20](src/renderer/persistence/Settings.ts:20)). `AudioManager.setMasterVolume` exists
([AudioManager.ts:800](src/renderer/audio/AudioManager.ts:800)). **Neither is ever called.** A grep for
`masterVolume` across `src/` finds only the definition and the default. Separately, AWACS BRA
calls and cockpit callouts go through `window.speechSynthesis`
([AudioManager.ts:894](src/renderer/audio/AudioManager.ts:894)), which is not connected to `masterGain`
and cannot be attenuated by it at all.

**Problem.** There is no way to turn the game down or off. The engine loop, RWR tones and a
synthesized voice reading out bandit bearings play at full volume for the whole session, over
whatever voice chat the group is on.

**Player Impact.** Someone will alt-tab and mute the app at the OS level, losing all audio cues
including the missile-launch warning. Predictably the first thing anyone asks for.

**Recommended Change.** Add a master volume slider to the Loadout screen (next to the FLIGHT
OPTIONS block) and to the Pause menu; persist via the existing `masterVolume` field; call
`audioManager.setMasterVolume()` on construction and on change. Add a speech toggle, or fold
speech into the same slider by setting `utt.volume = masterVolume` in `speak` /
`speakUtterance` — `SpeechSynthesisUtterance.volume` is supported and is the one-line fix.

**Implementation Notes.** `src/renderer/ui/LoadoutScreen.ts`, `src/renderer/ui/PauseMenu.ts`,
`src/renderer/FlightSession.ts` (apply on construct), `src/renderer/audio/AudioManager.ts:880-905`.

---

### [P1] No graphics quality control; full-res bloom + soft shadows always on
**Category:** Add · **System:** Rendering / Settings · **Confidence:** Confirmed (code) / Strongly Suspected (impact) · **Effort:** Small · **Playtest Blocker:** No

**Current State.** `PostFXManager` already implements HIGH / MEDIUM / LOW presets with
half-resolution and disabled-bloom paths ([PostFXManager.ts:9](src/renderer/postfx/PostFXManager.ts:9)),
and `PilotSettings.postFXQuality` is persisted. Nothing ever selects anything but the HIGH
default. `SceneManager` unconditionally enables `PCFSoftShadowMap` with a 2048² map
([SceneManager.ts:35](src/renderer/scene/SceneManager.ts:35)) and sets
`setPixelRatio(Math.min(devicePixelRatio, 2))` ([SceneManager.ts:33](src/renderer/scene/SceneManager.ts:33)).

**Problem.** On a friend's laptop with a HiDPI display, the 1920×1080 window renders at up to
3840×2160 internally, then runs a full-resolution `UnrealBloomPass` (a multi-pass Gaussian
pyramid) plus a soft-shadow pass over it. This is the most likely single cause of a bad frame
rate, and the fix is already written — it just is not reachable.

**Player Impact.** "It runs like a slideshow on my machine and there are no settings."

**Recommended Change.** Add a GRAPHICS row to the Loadout screen's ENVIRONMENT block: a
HIGH/MEDIUM/LOW select bound to `postFXQuality`, passed into `FlightSession` → `new PostFXManager(..., quality)`.
Extend the preset to also drive shadows and pixel ratio:
- HIGH: shadows on, PCFSoft 2048, pixelRatio ≤ 2
- MEDIUM: shadows on, PCF 1024, pixelRatio ≤ 1.5
- LOW: `shadowMap.enabled = false`, pixelRatio 1, bloom off

**Implementation Notes.** `src/renderer/ui/LoadoutScreen.ts`, `src/renderer/FlightSession.ts:184`,
`src/renderer/postfx/PostFXManager.ts`, `src/renderer/scene/SceneManager.ts:25-41`.

---

### [P1] AIM-120 silently refuses to launch without a radar lock
**Category:** Add · **System:** Weapons / HUD · **Confidence:** Confirmed · **Effort:** Tiny · **Playtest Blocker:** No

**Current State.** [PlayerAircraft.ts:343](src/renderer/entities/PlayerAircraft.ts:343):

```ts
if (store.weaponId === 'aim120b' && !sttTargetId) {
  return   // no sound, no message, no HUD cue
}
```

**Problem.** The player mashes F, nothing happens, and there is no explanation. Discovering that
you must press T (select track) then L (lock STT) first requires reading the controls table and
inferring the dependency. Note the R-77 has no such restriction, so the two nations behave
differently for no player-visible reason.

**Player Impact.** "My missiles don't work." The `LAUNCH MISSION` screen shows the keys but never
the *sequence*.

**Recommended Change.** Two lines: set a `weaponInhibitMessage = 'NO LOCK'` on the player and have
`drawMasterCaution` (or the weapons status block) flash it for 1.5 s. Also add a `SELECT` /
`LOCK` prompt to the weapons panel when an ARH missile is selected and `radar.mode !== 'STT'`.
Consider applying the same rule to the R-77 for consistency.

**Implementation Notes.** `src/renderer/entities/PlayerAircraft.ts:341-347`,
`src/renderer/ui/HUD.ts` (`drawMasterCaution`, `drawWeaponsStatus` call site).

---

### [P1] No fullscreen, and the window is hard-coded to 1920×1080
**Category:** Add · **System:** Shell · **Confidence:** Confirmed · **Effort:** Tiny · **Playtest Blocker:** No

**Current State.** `new BrowserWindow({ width: 1920, height: 1080, fullscreen: false })`
([main/index.ts:54](src/main/index.ts:54)), `win.setMenuBarVisibility(false)`. There is no F11 handler,
no fullscreen menu item, and no `setFullScreen` call anywhere in `src/`.

**Problem.** On a 1080p monitor the window is taller than the screen once the title bar is added.
With the menu bar hidden there is no default Electron accelerator for fullscreen either, so the
player has no way to get one.

**Player Impact.** Everyone plays windowed with part of the HUD off-screen. Small fix,
disproportionate irritation.

**Recommended Change.** Register a `before-input-event` handler (or a global shortcut) for F11
toggling `win.setFullScreen(!win.isFullScreen())`, and change the default size to
`width: 1600, height: 900` (or call `win.maximize()`). Add F11 to the controls reference. The HUD
already handles `resize` correctly ([FlightSession.ts:215](src/renderer/FlightSession.ts:215)) so this is
purely a shell change.

**Implementation Notes.** `src/main/index.ts:46-87`, `src/renderer/input/controlsReference.ts`.

---

### [P1] Inbound-missile HUD markers do not appear in multiplayer
**Category:** Fix · **System:** HUD / Multiplayer · **Confidence:** Confirmed · **Effort:** Tiny · **Playtest Blocker:** No

**Current State.** `FlightSession.tick` correctly feeds the RWR with
`getInboundMissiles(['player', localNetworkId])` ([FlightSession.ts:365](src/renderer/FlightSession.ts:365)),
but `HUD.drawSituationalMarkers` hard-codes
`this.entityManager.getInboundMissiles(['player'])` ([HUD.ts:1156](src/renderer/ui/HUD.ts:1156)).

**Problem.** A remote player's missile targets you as `peer_N`, not `'player'`, so the pink
inbound diamond never shows it. The RWR ring and the BREAK caution still work, so you get *a*
warning — just not the visual track that tells you where the missile actually is.

**Player Impact.** You know something is inbound but cannot see it, which makes notching and
flaring guesswork exactly when it matters most.

**Recommended Change.** Pass the local network id into the HUD (constructor arg or a
`setLocalNetworkId()` setter called from `syncMultiplayer`) and use the same id list the RWR gets.
Audit `collectMissileTTIInfo` / `drawMissileTTIPanel` for the same hard-coded `'player'` pattern.

**Implementation Notes.** `src/renderer/ui/HUD.ts:1156` and `collectMissileTTIInfo` (~line 1218),
`src/renderer/FlightSession.ts`.

---

### [P1] G-LOC is on by default and labelled in jargon
**Category:** Change · **System:** Physiology / UX · **Confidence:** Confirmed (default) / Needs Playtesting (severity) · **Effort:** Tiny · **Playtest Blocker:** No

**Current State.** `DEFAULT_FLIGHT_OPTIONS.glocEnabled = true`
([FlightSession.ts:45](src/renderer/FlightSession.ts:45)). The Loadout checkbox reads
"G-LOC & AGSM Physiology" with no explanation ([LoadoutScreen.ts:318](src/renderer/ui/LoadoutScreen.ts:318)).
Under incapacitation, `applyGLOC` zeroes pitch/roll/yaw, the trigger and the eject handle
([PlayerAircraft.ts:98](src/renderer/entities/PlayerAircraft.ts:98)).

**Problem.** A friend who has never flown a sim will pull max G through a merge, grey out, black
out, lose all control for several seconds, and hit the ground — with no idea why. The G-meter does
show a reserve bar, but nothing explains it.

**Recommended Change.** Do not remove it — it is well built and it is a good feature. Default it
**off** for the first playtest, and relabel: "G-LOC blackout (realistic G tolerance — you can pass
out in a hard sustained turn)". Turn it back on once players know the game.

**Implementation Notes.** `src/renderer/FlightSession.ts:44-49`,
`src/renderer/persistence/Settings.ts:31` (`glocEnabled: false`),
`src/renderer/ui/LoadoutScreen.ts:317-321`.

---

### [P1] No keybind remapping and no control sensitivity
**Category:** Add · **System:** Input / Settings · **Confidence:** Confirmed · **Effort:** Medium · **Playtest Blocker:** No

**Current State.** `InputManager` reads `DEFAULT_BINDINGS` directly
([InputManager.ts:135](src/renderer/input/InputManager.ts:135)); the `KeyBindings` interface exists but
nothing ever produces a non-default instance, and nothing is persisted.

**Problem.** The scheme is unusual: **W is pitch DOWN and S is pitch UP** (inverted, sim-standard,
but not what a non-sim player expects), throttle is on Shift/Ctrl, and Ctrl+W is intercepted to
stop it closing the window. Left-handed players, AZERTY keyboards and anyone who wants
non-inverted pitch have no recourse.

**Player Impact.** Some fraction of the group will spend the session fighting inverted pitch.

**Recommended Change.** For the first playtest, the 90% fix is much smaller than a full remapper:
a single **"Invert pitch"** checkbox next to Auto Rudder, persisted in `PilotSettings`, that flips
the sign in `getControls`. Ship the full remapping UI post-playtest (see P3) once you know whether
anyone actually asked for it.

**Implementation Notes.** `src/renderer/input/InputManager.ts` (constructor takes options),
`src/renderer/persistence/Settings.ts`, `src/renderer/ui/LoadoutScreen.ts`,
`src/renderer/FlightSession.ts:137`.

---

## 5. P2 — High-Value Improvements

### [P2] IR seeker aspect model uses quaternion components as a direction vector
**Category:** Fix · **System:** Weapons / IR · **Confidence:** Confirmed · **Effort:** Small

[IRSeeker.ts:21](src/renderer/weapons/IRSeeker.ts:21): `const forward = [state.attitudeQuat[0], state.attitudeQuat[1], state.attitudeQuat[2]]`
— that is `[w, x, y]` of the quaternion, not a heading vector. The `aspectFactor` derived from it
is therefore meaningless, so tail-aspect IR shots get no signature advantage and flare seduction
(gated on `flareHeatKW < targetHeatKW * 1.5`, [IRSeeker.ts:39](src/renderer/weapons/IRSeeker.ts:39)) triggers
semi-arbitrarily. The already-computed `bodyForwardNED` above it is unused (and is one of the 16
lint warnings). Fix: `const forward = quatRotateVec(state.attitudeQuat, [1, 0, 0])`.

### [P2] ARH seeker RCS aspect measured against world north
**Category:** Fix · **System:** Weapons / ARH · **Confidence:** Confirmed · **Effort:** Tiny

[ActiveRadarSeeker.ts:24](src/renderer/weapons/ActiveRadarSeeker.ts:24): `const fwd: Vec3 = [1, 0, 0]` is used as
the target's forward axis when indexing the 8-point RCS table. In NED, `[1,0,0]` is due north, so
a target's radar cross-section depends on the missile's compass bearing rather than the target's
own orientation. Stealth aircraft get no frontal-aspect benefit. Fix: rotate `[1,0,0]` by
`targetState.attitudeQuat`, as in the IR fix above.

### [P2] AI has no terrain avoidance and will fly into the ground
**Category:** Fix · **System:** AI · **Confidence:** Strongly Suspected · **Effort:** Small

`runAIBrain` ([AIBrain.ts:45](src/renderer/ai/AIBrain.ts:45)) dispatches to BVR/WVR/evade with no altitude
floor; the `AVOIDANCE` behaviour exists but hostiles never use it. `evadeRadar` explicitly targets
`initPositionNED[2] + 2500 ft` ([EvadeMissile.ts:48](src/renderer/ai/behaviors/EvadeMissile.ts:48)) — 762 m
below spawn altitude, straight into terrain for any low spawn. The RK4 ground clamp
([FlightModel.ts:220](src/renderer/physics/FlightModel.ts:220)) stops them penetrating, and a hard arrival
triggers the touchdown sink check, so they die rather than glitch — but they die stupidly.
Fix: clamp the pitch command to a positive floor whenever AGL < ~600 m, in `runAIBrain` after the
behaviour returns.

### [P2] Fired stores stay visible on the pylons
**Category:** Fix · **System:** Visuals · **Confidence:** Confirmed · **Effort:** Tiny

[Aircraft.ts:397](src/renderer/entities/Aircraft.ts:397) builds `activeHardpoints` from
`state.loadedStores` regardless of `remainingRounds`, and `PlayerAircraft.fireMissile` sets
`store.remainingRounds = 0` without removing the store. Missiles remain hanging under the wing
after launch. One-line fix: `.filter(s => s.remainingRounds > 0)`.

### [P2] F/A-18C is the only roster aircraft without a bespoke cockpit
**Category:** Change · **System:** Cockpits · **Confidence:** Confirmed · **Effort:** Tiny

`DETAILED_COCKPIT_FACTORIES` ([CockpitController.ts:23](src/renderer/cockpit/CockpitController.ts:23)) maps
`fa18e, f15c, f16c, f22, f35a, mig29, su27, su35, su57` — nine of ten. `fa18c` falls back to
`createPlaceholderCockpit`, a grey box tub. Cheapest fix: map `fa18c` to `new FA18Cockpit()` too
(same airframe family, and the class already exists), or drop the F/A-18C from the selectable
roster for this playtest.

### [P2] RWR shows every contact at unlimited range
**Category:** Change · **System:** Avionics · **Confidence:** Confirmed · **Effort:** Tiny

`RWR.update` ([RWR.ts:18](src/renderer/avionics/RWR.ts:18)) pushes a threat for every entry in `enemies`
with no range gate and regardless of whether their radar is even on. With four players plus AI the
ring is permanently full of SEARCH blips. Add a range cutoff (~150 km) and skip contacts whose
`getRadarInfo()` is `null`.

### [P2] Wingman keys missing from the in-game controls reference
**Category:** Fix · **System:** UX · **Confidence:** Confirmed · **Effort:** Tiny

`CONTROLS_REFERENCE` ([controlsReference.ts:11](src/renderer/input/controlsReference.ts:11)) omits the
1/2/3/4 wingman commands that the README documents and `InputManager` implements. Add a WINGMEN
group. Also add F11 once it exists. Keep the F12 line — the overlay ships enabled by decision
(§13), so it should be documented rather than hidden; consider relabelling it "Sandbox / debug
panel" so players know it is a real feature and not something they were not meant to find.

### [P2] Gun rounds allocate a Three.js Mesh each
**Category:** Optimize · **System:** Weapons / Rendering · **Confidence:** Confirmed · **Effort:** Small

`GunSystem.fire` does `new THREE.Mesh(...)` + `scene.add` per round
([GunSystem.ts:92](src/renderer/weapons/GunSystem.ts:92)), and `update` removes it on expiry. At the tick-
limited ~60 rounds/s with a 5 s lifetime, that is up to ~300 live meshes and 300 add/remove
operations per second, per firing aircraft. Replace with a fixed-size `THREE.Points` or
`InstancedMesh` pool.

### [P2] No aircraft-to-aircraft collision
**Category:** Add · **System:** Physics · **Confidence:** Confirmed · **Effort:** Small

Nothing anywhere tests aircraft-vs-aircraft proximity. Players fly straight through each other at
the merge. A simple sphere test (~15 m) applying `structuralFailure` to both is ~20 lines in
`EntityManager.update` — and produces some of the funniest moments in a friends dogfight.

### [P2] 16 unused-variable lint warnings, two of them dead computations
**Category:** Simplify · **System:** Code health · **Confidence:** Confirmed · **Effort:** Tiny

`npm run lint` is clean of errors but reports 16 warnings. Two are genuinely dead work rather than
stale imports: `bodyForwardNED` in `IRSeeker.ts:14` (see the IR finding above) and `stabZ` in
`PlaceholderMeshes.ts:486`. `Warhead.ts:33` takes a `targetQuat` it never uses. Clearing these is
five minutes and removes noise that hides real warnings.

---

## 6. P3 — Post-Playtest Backlog

- Full keybind remapping UI and per-axis sensitivity/curves (build it after you learn whether
  anyone asked).
- Complete gamepad support: button mapping for all actions, a device selector, HOTAS axis config.
- Server-authoritative damage. The current client-authoritative model is correct for friends and
  wrong for strangers; only worth changing if the game leaves the friend group.
- AI replication in multiplayer (co-op vs AI as a real mode).
- Team play: `team` on the profile, IFF colouring, friendly-fire rules, team scoring.
- Ping/RTT display and connection-quality indicator.
- Host migration / reconnect-into-running-session.
- Match timer, round structure, score limits, automatic map restart.
- Additional game modes (escort, CAS, carrier ops).
- Fix the unreachable COCKPIT and TAIL hit zones in `hitZoneFromMissileApproach`.
- Voice/text chat (probably never — everyone will be on Discord).
- The authentication story for the public dedicated server described in `docs/dedicated-server.md`.

---

## 7. Performance

No confirmed catastrophic hot spot. The codebase already shows real optimization discipline:
module-level RK4 scratch buffers, swap-buffer `Set` reuse in `syncMultiplayer`, an `O(1)` enemy
map in `MissileSystem.update`, a cached enemy list in `EntityManager`, HUD repaint capped at
30 Hz, aircraft LOD at 5 km, AI sim culling at 80 km and mesh culling at 120 km, a pooled
explosion system, and deliberate avoidance of per-detonation `PointLight`s (with a comment
explaining the shader-recompile cost). This is better than most hobby projects.

### REQUIRED

**1. Expose the existing graphics quality presets.** *(see P1)* Full-resolution `UnrealBloomPass`
plus `PCFSoftShadowMap` at 2048² plus `setPixelRatio(min(devicePixelRatio, 2))` is the largest and
least controllable GPU cost in the build, and on a HiDPI laptop it means rendering a 1920×1080
window at up to 3840×2160 before post. The LOW/MEDIUM code paths already exist in `PostFXManager`;
they are simply unreachable. Wiring the selector is the highest-value performance work available
and it is a few hours.
*Verify:* run the same scenario at HIGH and LOW on the weakest machine in the group and compare
frame times.

**2. Fix the explosion pool multi-stepping.** *(see P1)* Not a throughput problem — it is a
correctness bug that happens to live in the particle system — but it is in the same file you will
be in.

### RECOMMENDED

- **Gun round meshes → pooled `Points`/`InstancedMesh`.** Up to ~300 mesh add/removes per second
  per firing aircraft (`GunSystem.fire`/`update`). Worst case is a four-player furball with
  everyone holding the trigger.
- **Per-frame array churn in the render path.** `FlightSession.render` does
  `[...this.player.cmds.getActiveFlares(), ...this.entityManager.getAllAIFlares()]` and the same
  for chaff every frame ([FlightSession.ts:602](src/renderer/FlightSession.ts:602)), and
  `getAllAIFlares`/`getAllAIChaff` each allocate and spread again
  ([EntityManager.ts:343](src/renderer/entities/EntityManager.ts:343)). Small arrays (CMDS cooldowns cap
  each aircraft at ~8 live flares), so this is GC pressure rather than CPU — worth reusing two
  scratch arrays while you are nearby.
- **`getInboundMissiles` is called several times per frame.** Once in `FlightSession.tick` for the
  RWR, again in `HUD.drawSituationalMarkers`, and again in the TTI panel path — each allocating a
  `Set` and an output array while scanning every missile of every AI. Compute once per tick and
  cache on the session.
- **`Radar.update` rebuilds `liveTrackable` every tick** for the player and for each AI. Fine at
  current entity counts; revisit only if you push past ~12 aircraft.

### PREMATURE

- Terrain resolution (`384²` static plane, ~148k tris, built once). Not a bottleneck.
- The RK4 integrator. Already allocation-free apart from one result array per step, with a
  detailed comment explaining the choice. Leave it alone.
- `MissileSystem`'s two `Map` builds per update call. Handfuls of entries.
- Snapshot quantisation / `permessage-deflate` on the wire. At 20 Hz × a handful of peers this is
  nowhere near a LAN's capacity, and the implementation is already careful (countermeasures sent
  on change plus a 2 Hz resync, with local ageing between).
- `PlaceholderMeshes` procedural geometry. Built once at spawn.

---

## 8. Multiplayer Readiness

### Assessment: **transport ready, gameplay not ready**

The plumbing is genuinely good. The gameplay layer on top of it barely exists.

**Model.** Peer relay with client authority. `GameServer` runs no simulation at all — it assigns
`peer_N` ids, tracks last-known profile and state, validates, rate-limits and rebroadcasts. Each
client simulates its own aircraft and its own weapons; hits are asserted by the shooter and
applied by the victim.

| Concern | State |
|---|---|
| **Reliability** | Good. `maxPeers` cap, 15 s ping/pong with termination of unresponsive sockets, 150 msg/s per-peer rate limit, 64 KB payload cap, `permessage-deflate`, full schema validation on every inbound message (`validation.ts`), plausibility check on hits (range vs weapon type, reject if victim already ejected). Both the in-Electron host and the headless `standalone.ts` run the identical code path. |
| **Synchronisation** | Position/velocity/attitude/throttle/ejected/structuralFailure/radar mode/missiles/countermeasures at 20 Hz, quantised (1 cm position, ~0.001° attitude), with eager sends on missile-set change, radar-mode change, and death. Remote entities buffer 12 snapshots and render 120 ms in the past with up to 250 ms of velocity extrapolation (`NetworkAircraft`). This is a textbook-correct implementation. |
| **Latency handling** | Good for LAN, reasonable for internet. `INTERP_DELAY_MS = 120` is tunable and documented. Duplicate-snapshot dedup by position equality prevents the 60 Hz re-delivery of a 20 Hz stream from collapsing the interpolation window. |
| **Joining** | Works. Lobby-first flow with a live roster; the `welcome` message carries existing peers and their in-flight state. Each peer beyond the first spawns 600 m east (`applyPeerSpawnOffset`). **Late join mid-flight works** — the joiner picks an aircraft and launches into the running session. |
| **Disconnecting** | Handled cleanly. `close` → `peer-leave` → client deletes → `FlightSession.syncMultiplayer` reconciles via the tracked-id swap and calls `removeRemotePlayer`. No ghost aircraft. A player who dies stops sending state, but their last snapshot carries `ejected: true`, which makes them untrackable by radar (`Radar.isRadarTrackable`) and hides their mesh (`Aircraft.updateMesh`) — so even the debrief-screen gap is covered. |
| **Reconnect** | Not supported. Reconnecting produces a new `peer_N` with a fresh identity. Acceptable for friends; just know it. |
| **Respawning** | **Missing.** See P1. Death exits the flight into debrief → loadout → relaunch, with the lobby preserved. Functional but slow. |
| **Combat sync** | Partially working. Hits replicate. Remote missiles render as visuals with explosion-on-expiry (`RemoteMissileVisual`) — you can see incoming missiles. But secondary fragmentation damage never crosses the wire, and there is no death or kill-credit event at all. |
| **AI** | **Not replicated.** Every client spawns and simulates a private copy of the scenario AI, and `EntityManager` only ever hands AI the local player as a target. |
| **Teams / identity / scoring** | **Missing entirely.** `NetPlayerProfile` is `{ aircraftId }`. Every remote player is in `getEnemies()` unconditionally ([EntityManager.ts:338](src/renderer/entities/EntityManager.ts:338)), so it is free-for-all by construction. |
| **Environment consistency** | **Broken.** Time of day and weather are per-player Loadout selections. |

### Edge cases walked through the code

| Scenario | Outcome |
|---|---|
| Player joins late | Works. `welcome` carries live peers with state; `upsertRemotePlayer` creates them on the next snapshot. |
| Player disconnects unexpectedly | Clean. `peer-leave` → removal. |
| Player dies while their missile is in flight | The missile's owner client is disposed, so the missile stops updating and vanishes for everyone. No orphaned kill. Slightly unsatisfying, not broken. |
| Player fires then instantly disconnects | The hit event is only sent when the missile detonates on the shooter's client. Disconnect before that → no hit. Fail-safe direction. |
| Two players kill each other simultaneously | Both hits are relayed and applied independently. Both die. Correct. |
| Player spams controls | Rate limit is 150 msg/s; the client sends ~20 Hz plus eager sends on missile/radar/death — far under. Safe. |
| Player launches many missiles | `MAX_NET_MISSILES = 32` caps the payload; validation rejects over-cap states outright (the whole snapshot is dropped, not truncated). A player with >32 live missiles would go invisible — not reachable with real loadouts. |
| Players collide | Nothing happens. They pass through each other. |
| Rapid respawn | Not reachable — no respawn. |
| Hostile/modified client | `isValidHitEvent` forces `sourceId === senderId` and caps severity at 1.0; `isPlausibleHit` range-checks. A modified client can still claim plausible hits at will, and F12 invincibility is undetectable. Fine for friends, explicitly not fine for strangers (and `docs/dedicated-server.md` already says so). |

---

## 9. Gameplay / Combat Readiness

**Flight — good.** This is the strongest part of the project and the part you should touch least.
RK4 over a 13-state vector with real aero coefficient tables (`AeroCoefficients`), Mach-dependent
control effectiveness, mass properties with CG shift from fuel and stores, ISA atmosphere with
thrust lapse, first-order engine spool with afterburner light-off hysteresis, band-limited
turbulence, and an FCS that limits AoA and G asymmetrically so recovery authority is preserved.
Ground handling is properly done — separate longitudinal and lateral tyre friction, gear-collapse
thresholds on hard landings, belly-landing penalties, sink-rate capture before the integrator's
ground clamp. Keyboard input gets a deliberately short shaping time constant (8 ms) so binary keys
feel responsive while analog axes keep smoothing. Turn rates are regression-tested against
EM-chart reference bands for nine of ten airframes. Verdict: believable, responsive and
consistent. **Needs Playtesting** only for whether the keyboard turn feel is *fun* for non-sim
players.

**Guns — degraded by the tunneling bug.** Ballistics (quadratic drag, gravity, 5 s life) are fine,
tracers and muzzle flash exist, the HUD gun funnel is well implemented, and ammo counts are
realistic (511 for the M61, 150 for the GSh-301). But the per-tick 5 m point test loses roughly
half the well-aimed rounds, and at 0.22 severity per round you need ~5 hits in the same zone.
Effective time-to-kill will feel arbitrary.

**Missiles — sophisticated guidance, broken lethality.** The guidance is the best-implemented
weapon code here: APN with a documented fix for the classic ω_LOS-vs-dLOS/dt bug, an analytic
intercept-time solution, ARH midcourse loft (climb to `min(14 km, 2500 + range*0.12)`) with a
terminal dive bias, an AIM-120 datalink phase that depends on maintaining STT, a real radar-
equation SNR check with Doppler notch in the ARH seeker, IR gimbal limits with irradiance-weighted
flare selection, and beam-aspect-scaled chaff seduction with per-missile ECCM resistance. And then
the fuse tunnels (P0) and a direct hit cannot kill (P1). Two small fixes turn the best-engineered
subsystem in the project from frustrating to excellent.

**Damage — well modelled, completely invisible.** Six zones, fire and engine-failure cascades,
structural failure thresholds, and real flight consequences (roll authority `1 - (wl+wr)*0.65`,
pitch authority from tail and fuselage, thrust scaling, asymmetric drag, fuel leak up to 7×). The
player is shown none of it. Note also an asymmetry: AI die at `ENGINE >= 1.0 || FUSELAGE >= 1.0 ||
COCKPIT >= 1.0 || structuralFailure` ([EntityManager.ts:206](src/renderer/entities/EntityManager.ts:206))
while the player only auto-ejects on `structuralFailure || COCKPIT >= 1.0`
([PlayerAircraft.ts:147](src/renderer/entities/PlayerAircraft.ts:147)) — the player is meaningfully tougher
than an AI of the same type. Symmetric in PvP, inconsistent in PvE.

**Targeting / radar — works, and is legible.** Scan bars with azimuth sweep and elevation
stepping, RCS- and range-dependent detection, track confidence decay, RWS/TWS/STT/GMTI, STT loss
falling back to TWS. The HUD renders a B-scope with a DLZ staple, a target designator with a
lock-acquisition animation and a kinematics block, a staged shoot cue, an off-boresight locator,
a launch-acceptability region, and a missile time-to-impact panel. This is more capable than most
commercial arcade sims. The risk is the opposite of the usual one: **it may be too much** for a
friend's first ten minutes.

**AI — functional and entertaining, with gaps.** BVR does close → shoot → crank with cooldowns and
an Rne concept; WVR does lead-pursuit gun tracking, IR shots inside 3.5 km / 35° aspect, and
energy management (vertical extend on overshoot, nose-on when slow). Missile evasion picks the
right response per seeker type: break turn plus flares for IR, notch plus descent plus chaff for
radar. Cooldowns prevent spam; CMDS cooldowns (0.5 s flares, 0.25 s chaff) bound the flare count.
CPU cost is well controlled by the 80 km sim cull. Gaps: no terrain avoidance, no collision
avoidance, no mutual awareness (AI only ever fights the local player), and the `AVOIDANCE`
behaviour is orphaned. For a friends build the AI is adequate — **Needs Playtesting** on whether
it is too easy or too lethal.

**Combat feedback — the weakest area.** Present: RWR search/track/lock/launch tones, GPWS voice,
missile-launch and pitbull audio, a shoot cue, master caution (BREAK / MISSILE / BINGO / AOA /
GEAR), a decoy-success flash, and a synthesized AWACS BRA callout. Absent: any hit indication,
any damage readout, explosion audio, kill confirmation, and — in MP — who did what to whom.

**Balance — Needs Playtesting**, but two things are predictable from the numbers: with the fuse
and severity fixes, one AMRAAM will kill, so BVR may end fights before the merge; and the stealth
airframes (F-22, F-35, Su-57) have both low RCS *and* the best turn-rate bands, so they may simply
dominate. Consider restricting the first playtest to F-16C / MiG-29 / F-15C / Su-27 to keep the
fight in the merge where it is most fun.

---

## 10. Features to Add

Only what the existing game justifies. Each entry says *why*.

| Feature | Why it is needed |
|---|---|
| **A PvP dogfight scenario** | There is no game mode for the session you are running. Without it the friends build has nothing for friends to do together. *(P0)* |
| **Player callsigns** | Every player currently shows as `peer_1`. Nobody can address anyone. Two fields and a text input. *(P1)* |
| **Damage panel + hit flash + hit sound** | The damage model already drives real flight consequences; players just cannot see them. Without it, combat is unreadable. *(P1)* |
| **Kill feed + scoreboard** | Turns "we flew planes near each other" into "we played a game." The highest fun-per-hour item in the report. *(P1)* |
| **In-flight respawn (MP only)** | Otherwise every death costs a full session teardown and two menu screens. *(P1)* |
| **Master volume slider** | There is currently no way to turn the game down. Universally the first request. *(P1)* |
| **Graphics quality selector** | The LOW/MEDIUM presets already exist and are unreachable; someone's laptop will need them. *(P1)* |
| **Fullscreen toggle (F11)** | The window is bigger than a 1080p screen and there is no way to fix it. *(P1)* |
| **"No lock" weapon feedback** | AIM-120 silently no-ops without STT; players will report missiles as broken. *(P1)* |
| **Invert-pitch option** | W is pitch-down. A meaningful fraction of players will want it flipped, and there is no remapping at all. *(P1)* |
| **A one-screen "how to fight" card** | The controls table lists keys but never the sequence (T → L → F for a radar shot; Z when the RWR screams). One paragraph on the Loadout screen. *(P2)* |

**Explicitly not recommended now:** team selection, ping display, match timer, win conditions,
host migration, in-game chat. Every one is defensible later; none is justified by a first
free-for-all playtest with people you are already on voice with.

---

## 11. Features to Remove / Disable

| Item | Action | Why |
|---|---|---|
| **F12 debug overlay** | **Keep — decided.** Ships as-is | Explicitly retained by the project owner. See §13 for what that implies for multiplayer trust. |
| **Head-On BVR / CAP with Wingman / Strike Package in a lobby session** | Grey out or warn when a lobby client is connected | They spawn phantom per-client AI and complete independently. Keep them as single-player missions. *(P0-adjacent)* |
| **F/A-18C** | Drop from the roster, or point it at `FA18Cockpit` | Only airframe with the generic placeholder cockpit tub. *(P2)* |
| **F/A-18E** | Keep, but add its turn-rate reference band | Currently the only unvalidated airframe, and it breaks CI. *(P0)* |
| **G-LOC** | Default off, keep the toggle | Feature is good; the default punishes newcomers who do not know why they blacked out. *(P1)* |
| **Stealth airframes (F-22 / F-35 / Su-57) for playtest #1** | Optionally restrict | Low RCS plus top-tier turn rates is likely to be dominant before you have balance data. *(Needs Playtesting)* |
| **AWACS speech synthesis** | Keep, but make it mutable | Currently bypasses the audio mixer entirely and cannot be turned down. *(P1)* |
| **Targeting pod / bombs / AGMs / GMTI** | Leave in — do not disable | They work, they are optional, and they cost nothing to leave. Listed here only to record that they were considered and cleared. |

---

## 12. Quick Wins

Tiny-to-small effort, high player impact. Do these first — most of the list is a single afternoon.

1. **Add `fa18e` to `turnPerformance.ts`** — 1 line. Unblocks `npm run ci` and the CI packaging jobs.
2. **Move the `player.state.ejected` fallback out of the `else` in `updateMissionEnd`** — 3 lines. Kills the Free Flight death freeze.
3. **Make the gamepad branch a blend with a deflection threshold** — ~8 lines. Stops a plugged-in controller from bricking keyboard flight.
4. **Step the explosion pool once per tick** — move one line. Explosions last 2.2 s instead of ~0.4 s.
5. **Raise missile severity so a centre hit kills** — 1 line + tuning. Missiles become weapons.
6. **Swept closest-approach fuse** — ~15 lines in `Warhead.ts`. Missiles stop flying through people.
7. **Master volume slider** — the setting, the persistence and `setMasterVolume` all already exist; wire them plus `utt.volume`. ~25 lines.
8. **Graphics quality select** — `PostFXManager` presets already exist and are unreachable. ~20 lines.
9. **F11 fullscreen + a 1600×900 default window** — ~6 lines in `main/index.ts`.
10. **`.filter(s => s.remainingRounds > 0)` on store mesh visibility** — 1 line. Fired missiles stop hanging under the wing.
11. **Range-gate the RWR** (~150 km, and skip contacts whose radar is off) — ~4 lines. Stops the threat ring being permanently full of blips in a four-player session.
12. **Reword the Free Flight briefing** — 1 string. Keep the F12 pointer, phrase the rest for a player: "Empty skies — practice takeoffs, gun tracking and missile launches with no time pressure. F12 opens the sandbox panel to spawn targets."
13. **Add the WINGMEN group to `controlsReference.ts`** — ~8 lines.
14. **Pass the local network id to the HUD's inbound-missile query** — ~4 lines. Inbound missiles become visible in MP.
15. **`break` after a gun hit, and fix the two dead lint computations** — 3 lines.

Items 1–6 alone move the build from "appears broken" to "appears to work." Items 7–15 are the
polish that stops the questions before they start.

---

## 13. Do Not Touch Yet

These are imperfect and should stay that way through the first playtest. Changing them buys
nothing for the session and risks regressions in code that currently works.

**The flight model and physics stack.** `FlightModel.ts`, `AeroCoefficients.ts`,
`MassProperties.ts`, `ControlEffectiveness.ts`, `Atmosphere.ts`, `FlightKinematics.ts`. This is the
most carefully built and best-tested code in the repo — regression-tested turn rates, allocation-
free RK4 with explanatory comments, documented fixes for subtle prior bugs. Any tuning here has a
large blast radius across all ten airframes *and* the AI, which shares the same integrator. Collect
playtest feedback on *feel* first; do not pre-emptively adjust.

**The networking transport.** `GameServer.ts`, `validation.ts`, `serialization.ts`,
`NetworkAircraft.ts`, `MultiplayerClient.ts`. Quantisation, deflate, heartbeat, rate limiting,
snapshot interpolation with bounded extrapolation, duplicate dedup — all correct and all
documented. The multiplayer problems in this report are *gameplay* problems layered on top of it.
Resist the urge to "improve netcode" — add game features that use it. In particular do **not**
move to server-authoritative damage for a friends build; client authority is the right trade here
and the change would be large and risky.

**Client-authoritative hit detection generally.** It is exploitable in principle. Your friends are
not going to write a packet forger, and `isPlausibleHit` already blocks the accidental cases.

**The F12 debug overlay — kept by decision.** `DebugOverlay` is always constructed in
`FlightSession` and toggled by F12 ([FlightSession.ts:221](src/renderer/FlightSession.ts:221)),
exposing an invincibility checkbox ([DebugOverlay.ts:195](src/renderer/debug/DebugOverlay.ts:195)),
Reload Weapons ([DebugOverlay.ts:222](src/renderer/debug/DebugOverlay.ts:222)), Reset Position
([DebugOverlay.ts:241](src/renderer/debug/DebugOverlay.ts:241)), arbitrary enemy/wingman/ground-target
spawning, a launch-a-missile-at-yourself button, live weather control, and seeker/radar cone
visualisers. **This ships as-is.** It is genuinely useful during a playtest — you can reproduce a
reported bug on the spot, spawn a specific merge geometry, or dial in weather without relaunching,
and Reset Position is currently the only in-flight recovery from the Free Flight death freeze.

Two consequences to be aware of rather than fix:
- Damage is applied on the *receiving* client, so `invincible` in multiplayer is undetectable by
  anyone else — an invincible player simply never takes damage and their opponents get no
  feedback that anything is wrong. Reload Weapons is likewise infinite ammo. This is a social
  contract, not a technical control: tell the group what F12 does up front, and it becomes a
  shared sandbox tool rather than a discovered exploit.
- Because `Reset Position` doubles as an emergency respawn today, its usefulness drops once the
  P1 in-flight respawn lands. Nothing to change either way.

If you ever open the game beyond the friend group, revisit this — an env-var gate
(`FSIM_DEBUG=1` read in `src/main/index.ts`, exposed on `window.fsim`) keeps the tooling for you
and removes it for everyone else. That is a P3 concern, not a playtest one.

**The avionics suite.** `Radar.ts`, `RWR.ts`, `CMDS.ts`, `TargetingPod.ts`, `HMS.ts`, `GPWS.ts`,
`AWACS.ts`. Feature-complete and working. The only avionics changes worth making now are the
two-line RWR range gate and the MP inbound-missile id fix.

**The HUD's existing symbology.** It is dense, but every element is correctly implemented and
correctly positioned with responsive scaling, and it repaints at a capped 30 Hz. Add the damage
panel and the kill feed; do not redesign the layout. If playtesters say it is overwhelming, that
is a *simplified HUD mode* conversation for after the session, not a reason to touch working code.

**Procedural aircraft and cockpit models.** ~30 KB of `PlaceholderMeshes.ts` plus sixteen bespoke
model files. They are recent work (`70d583a`, "Integrate v3 rebuilt procedural cockpits and
exteriors"), they have their own regression tests for nozzle counts and centering, and they look
finished enough. The one exception is pointing `fa18c` at an existing cockpit — a one-line map
entry, not modelling work.

**Terrain, sky, scenery, weather visuals, time-of-day.** Working, atmospheric, cheap enough. No
playtest question depends on them.

**The persistence layer.** `Storage.ts` is genuinely well built — namespaced, versioned,
try/catch-wrapped against private windows and missing `localStorage`, with an injectable backend
for tests and a bounded logbook. It needs two new fields (`callsign`, maybe `invertPitch`), nothing
structural.

**General code health.** No TODO/FIXME/HACK comments, 13 console statements total, no dead
systems, no duplicate implementations, no circular-dependency smells, consistent disposal patterns
throughout. There is no code-health work worth doing before this playtest beyond the 16 lint
warnings. **Do not schedule a refactor.**

---

## 14. Recommended Implementation Order

Five stages. Each stage is independently shippable — if you run out of time, stop at a stage
boundary rather than half-finishing the next one.

### Stage 1 — Unbreak the build gate *(≈30 min)*
**What:** Add the `fa18e` turn-rate reference band. Update the README roster to ten aircraft.
Clear the 16 lint warnings, fixing the two dead computations properly (`IRSeeker.bodyForwardNED`,
`PlaceholderMeshes.stabZ`).
**Why first:** `npm run ci` currently fails, which means CI never reaches the packaging jobs. You
cannot produce a build to test the rest of this plan against until this is green.
**Depends on:** nothing. **Blocks:** every packaged artifact.
**Verify:** `npm run ci` exits 0; the three CI matrix jobs and both dist jobs go green.

### Stage 2 — Fix the combat core *(≈half a day)*
**What:**
- Swept closest-approach proximity fuse in `Warhead.ts`; delete the dead `prevMissDistanceM` branch.
- Raise missile severity so a lethal-radius hit destroys.
- Swept segment-vs-sphere gun hit test; `break` after a hit.
- Step the explosion pool once per tick.

**Why here:** these are the mechanics every later change is judged against. Tuning respawn timing
or scoring before missiles reliably detonate would be tuning against noise.
**Depends on:** Stage 1 (so you can build and test). **Blocks:** all balance judgement in Stage 5.
**Verify:** extend `Warhead.test.ts` with a 1200 m/s head-on fly-through asserting detonation, and
`DamageModel.test.ts` with a lethality-1.0 missile asserting destruction. Then fly Head-On BVR and
confirm you can kill both MiGs with two missiles.

### Stage 3 — Make it playable by someone who is not you *(≈half a day)*
**What:** Gamepad blend fix. Master volume slider (including `utt.volume` for speech). Graphics
quality select. F11 fullscreen + 1600×900 default. "NO LOCK" weapon feedback. Damage panel + hit
flash + hit/explosion audio. Default G-LOC off and relabel it. Invert-pitch option. Fired-store
mesh visibility. Wingman keys in the controls reference. RWR range gate. Reword the Free Flight
briefing. (The debug overlay stays as-is — no work here.)
**Why here:** this is everything that makes the difference between a friend playing the game and a
friend asking you a question on Discord. It is all independent of multiplayer, so it can be
validated single-player before you coordinate a session.
**Depends on:** Stage 2 (the damage panel is only meaningful once damage happens sensibly).
**Blocks:** nothing — but skipping it means you narrate the whole playtest.
**Verify:** hand the build to one person with no instructions beyond "fly and shoot something" and
watch what they ask. Every question they have to ask is a bug in this stage.

### Stage 4 — Build the multiplayer game *(≈1 day)*
**What:**
- New `dogfight` scenario with `loseConditions: ['player_killed', 'player_ejected']`.
- Move the ejected fallback out of the `else` in `updateMissionEnd` (belt and braces).
- Lock time-of-day and weather while a lobby client is connected; suppress scenario AI spawning
  in multiplayer.
- `callsign` on `NetPlayerProfile` + validation + Loadout input + persistence + lobby list +
  HUD marker label.
- `death` message type through `MultiplayerTypes` → `validation` → `GameServer` relay → client.
- Kill feed (4 lines, 6 s fade) and a held-key scoreboard (pick a key that is not Tab).
- In-flight respawn for multiplayer with a 5 s overlay.

**Why here:** this is the largest chunk and it depends on Stage 2 (deaths have to be achievable and
attributable) and Stage 3 (respawn is pointless if players cannot tell they died). The callsign
field must land before the kill feed, and the death event before the scoreboard — hence the
internal ordering.
**Depends on:** Stages 2 and 3. **Blocks:** the playtest itself.
**Verify:** two clients against a local `npm run server`. Confirm in order: both see each other's
callsigns; a gun kill produces a kill-feed line naming both; the victim respawns in place without
leaving the flight; the scoreboard increments; a mid-session join lands correctly; an alt-F4
removes the aircraft cleanly.

### Stage 5 — Pre-flight *(≈2 hours)*
**What:** Work the Release Checklist in section 15. Produce and install a real packaged build
(`npm run dist:win`) on a machine that has never run the dev server. Fresh-install test: no
`localStorage`, no `node_modules`, no dev server. Run one two-player session end to end before
inviting the group.
**Why last:** packaging surfaces a distinct class of problem — asar paths, `asarUnpack` for the
sounds directory, firewall prompts on first host — that never appears in `npm run dev`.
**Depends on:** everything. **Verify:** the checklist below, every box.

### Explicitly deferred until after the playtest
Server-authoritative damage, AI replication, teams, full keybind remapping, complete gamepad
mapping, ping display, match timer, reconnect, extra game modes. None of them changes whether the
first session is fun; all of them are better designed against real feedback.

---

## 15. Release Checklist

Customised to what this project actually contains.

**Build & packaging**
- [ ] `npm run ci` exits 0 (typecheck + lint + 168/168 tests) — *currently failing*
- [ ] `npm run build` and `npm run build:server` exit 0 — *currently passing*
- [ ] `npm run dist:win` produces `release/FSim Setup 0.1.x.exe` — *not verified in this audit*
- [ ] Version bumped in `package.json` **and** in `src/preload/index.ts` (it is hard-coded there
      and drives the on-screen version badge — the two can drift)
- [ ] Installed build launches on a machine that has never run the dev server
- [ ] All 25 WAVs present under `dist-electron/renderer/sounds/` inside the installed app
      (`asarUnpack` covers this — confirm after packaging, not just after `npm run build`)
- [ ] DevTools do not open (gated on `ELECTRON_RENDERER_URL` — confirm in the packaged build)

**First-run experience**
- [ ] Game launches to the mission select screen with no console errors
- [ ] Window fits on a 1080p screen; F11 toggles fullscreen
- [ ] A player can reach flight from a cold start without being told anything
- [ ] Controls reference is complete and accurate (wingman keys present, F11 present, F12 listed)
- [ ] Master volume works and persists; AWACS speech obeys it
- [ ] Graphics quality selector works and persists

**Flight**
- [ ] Keyboard flight works with a gamepad plugged in and idle
- [ ] Keyboard flight works with a gamepad plugged in and actively deflected
- [ ] Takeoff from the runway succeeds in Traffic Pattern
- [ ] Landing completes the mission and grades the touchdown
- [ ] Invert-pitch option works

**Combat**
- [ ] A head-on AMRAAM shot detonates and kills
- [ ] A tail-chase Sidewinder shot detonates and kills
- [ ] Guns register reliably inside the funnel at ~500 m
- [ ] Taking a hit produces a sound, a flash, and a visible change in the damage panel
- [ ] Explosions are visible for a full ~2 s
- [ ] Firing an AIM-120 with no lock shows "NO LOCK" rather than silently doing nothing
- [ ] Flares defeat an IR missile at least sometimes; chaff + notch defeats an ARH missile

**Multiplayer**
- [ ] Host from the Loadout screen; the Windows Firewall prompt appears and is allowed
- [ ] A second machine joins by IP and appears in the roster with the correct callsign
- [ ] Both players launch and see each other's aircraft moving smoothly (no rubber-banding)
- [ ] Both players see each other's missiles and countermeasures
- [ ] A kill produces a kill-feed entry naming killer and victim on **both** clients
- [ ] The victim respawns in flight without leaving the session
- [ ] The scoreboard shows correct kills/deaths on both clients
- [ ] Time of day and weather match on both clients
- [ ] No phantom AI aircraft appear in the dogfight scenario
- [ ] A late joiner enters a running session correctly
- [ ] Alt-F4 on one client removes their aircraft from the other cleanly
- [ ] A 15-minute session stays synchronised (no accumulating position drift)

**Hygiene**
- [ ] The group has been told what F12 does before the session starts (it ships enabled — see §13)
- [ ] Briefing and UI strings read like they were written for a player, not a developer
- [ ] No P0 findings remain open
- [ ] P1 findings 1–8 resolved (damage feedback, missile lethality, gun hits, MP identity/scoring,
      respawn, explosions, volume, graphics)
- [ ] Fresh install tested on the weakest machine in the group

---

## 16. First Playtest Plan

The goal is **to find the next set of priorities**, not to prove the game is done. Plan for things
to break; plan for how you will learn from it.

### Setup
- **Players:** 3 (you + 2). Two is not enough to surface relay contention; four or more multiplies
  the number of unknowns you are debugging simultaneously. Three is the sweet spot.
- **Server:** run `npm run server` on a fourth machine (a spare box, or the Pi described in
  `docs/dedicated-server.md`) rather than hosting from a playing client. It removes a whole class
  of ambiguity — if something desyncs you know it is not "the host had a frame spike" — and its
  `onEvent` log gives you a timestamped connection record for free.
- **Aircraft:** everyone flies **F-16C or MiG-29** for round 1. Same generation, same rough
  performance, no stealth. You are testing the game, not the balance table.
- **Mode:** the new `dogfight` scenario, free-for-all, airborne start.
- **Duration:** 60–75 minutes total, structured as below. Do not plan a marathon; the useful signal
  arrives early and fatigue destroys the debrief.

### Session structure

| Block | Time | Purpose |
|---|---|---|
| **1. Solo warm-up** | 10 min | Everyone flies Traffic Pattern alone. Do they take off, circuit and land without help? This is your first-run-experience test and it costs nothing. |
| **2. Connect** | 5 min | All three join the dedicated server. Time how long from "launch the app" to "everyone airborne together." Note every question anyone asks. |
| **3. Guns-only round** | 15 min | Empty every hardpoint on the Loadout screen. Forces the merge, isolates gun hit registration and the flight model from missile behaviour. |
| **4. Full loadout round** | 20 min | Everything on. Watch the BVR-vs-merge balance and whether fights end before the merge. |
| **5. Stress round** | 10 min | Deliberately abusive: everyone launches everything at once, spams flares, respawns immediately on death, one player alt-F4s and rejoins mid-fight, two players ram each other. |
| **6. Debrief** | 15 min | Questions below, while it is fresh. |

### Systems to stress deliberately
- **Respawn loop** — die on purpose five times in a row as fast as possible.
- **Simultaneous kills** — two players head-on with guns, both firing.
- **Late join** — one player joins during block 4.
- **Ungraceful disconnect** — alt-F4 mid-missile-flight, then rejoin.
- **Countermeasure saturation** — all three holding Z during a merge (up to ~24 live flares
  crossing the wire and being scored by every IR seeker).
- **Missile saturation** — everyone empties their rails at once.
- **Deck-level fight** — take it below 500 m to exercise terrain clamping and GPWS.
- **Long session** — do not restart between blocks; interpolation drift and any leak show up over
  time, not in the first two minutes.

### Bugs to watch for specifically
- Missiles passing through targets without detonating *(should be fixed — confirm)*
- Gun rounds visually hitting with no damage *(should be fixed — confirm)*
- A kill credited to the wrong player, or a death with no kill-feed line
- A player's aircraft freezing or teleporting (interpolation buffer starvation — the symptom of
  packet loss or a client frame-rate collapse)
- Phantom AI aircraft in the dogfight scenario
- Time of day or weather differing between clients
- An aircraft remaining visible after its pilot disconnected
- Someone leaving F12 invincibility on by accident and quietly ruining a round for everyone else
- Audio cutting out, or the AWACS voice talking over everything
- HUD elements off-screen at a non-1080p resolution

### Metrics worth capturing
- **Frame rate** on the weakest machine, in the worst moment (a three-way merge with missiles and
  flares in view). Ask each player for a number, not "it felt fine."
- **Time from app launch to everyone airborne together.** Over three minutes means the lobby flow
  needs work.
- **Deaths per player per 15-minute round.** Under ~2 means missiles or guns are still too weak;
  over ~10 means time-to-kill is too short.
- **Missile hit rate** — shots fired vs kills, self-reported. The single best number for whether
  the Stage 2 fixes landed.
- **Count of questions asked on voice chat.** This is the real readiness metric. Zero is Friends
  Beta. Under five is Friends Alpha. Twenty means go back to Stage 3.
- **Dedicated server log** — keep it. It timestamps every join, disconnect and terminated socket.

### Questions to ask afterwards
1. What was the most fun thing that happened?
2. At any point did you not know what to do next? When?
3. Did anything happen that you could not explain?
4. When you died, did you know who killed you and how?
5. Did the aircraft do what you expected when you moved the controls?
6. Did the missiles feel fair — could you dodge them, could you land them?
7. Was anything on screen confusing or unreadable?
8. Was there anything you wanted to do and could not find a way to do?
9. Would you play again next week?
10. What is the one thing you would change?

Question 4 tests the P1 feedback work directly. Question 9 is the only one whose answer really
matters.

