# FSim

Combat flight simulator pitting US and Russian fighters against each other. Fly modern jets with a simplified but responsive flight model, radar and weapons systems, AI opponents, and optional LAN multiplayer — all in a desktop app built with Electron and Three.js.

**Version:** 0.1.5

## Features

- **Aircraft roster** — F-22, F-35A, F-16C, F-15C, FA-18C, FA-18E, MiG-29, Su-57, Su-27, Su-35
- **Combat systems** — guns, IR and radar-guided missiles, countermeasures (flares/chaff), RWR, targeting pod
- **Avionics & HUD** — attitude indicator, radar scope, threat display, GPWS callouts
- **AI & wingmen** — enemy AI, wingman radio commands (engage, cover, RTB, rejoin)
- **LAN multiplayer** — host or join via WebSocket (`ws`)
- **Tech stack** — Electron, Vite, Three.js, TypeScript

## Prerequisites

- **Node.js 18+** and **npm** (ships with Node.js) — required on all platforms
- **macOS**, **Windows**, or **Linux** — the dev and CI workflows run on all three
- Platform-specific packaging requires the matching OS (see [Packaging](#packaging-optional))

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/BrWri4227/FSim.git
cd FSim
npm install
```

## Development

Start the Electron app with hot reload — works on macOS, Windows, and Linux:

```bash
npm run dev
```

## Production Build

Compile TypeScript and bundle assets, then preview the built output:

```bash
npm run build
npm run preview
```

## Packaging (Optional)

Create a distributable package with electron-builder. Each script must be run on the matching OS.

### macOS — unsigned DMG + ZIP (Intel and Apple Silicon)

```bash
npm run dist:mac
```

Produces `release/FSim-x.x.x.dmg` and `release/FSim-x.x.x-mac.zip`.

> **Gatekeeper:** Because the build is unsigned, macOS will block the app on first launch.
> Right-click the `.app` → **Open**, then click **Open** in the prompt.
> Alternatively, run once from a terminal:
> ```bash
> xattr -cr /Applications/FSim.app
> ```

### Windows — NSIS installer (x64)

```bash
npm run dist:win
```

Produces `release/FSim Setup x.x.x.exe`.

### Any platform (builds for the current OS)

```bash
npm run dist
```

All installers are written to the `release/` directory.

## Multiplayer

FSim supports 2–N player combat over a LAN or the internet. No account is
required. Everything happens on the **Multiplayer** screen, reached from the
main menu.

### Hosting on your own machine

1. Pick a port (default **45454**) and click **HOST**. Your LAN address is shown
   at the top of the connection panel — share `address:port` with the others.
2. On **Windows**, allow the app through Windows Defender Firewall when prompted.
   Nobody can join until that prompt is accepted.
3. On **macOS**, allow *"FSim would like to accept incoming network connections"*.

### Joining

1. Type the host's address in the join field and click **JOIN**. The field takes
   a bare IP, `host:port`, or a full `ws://` / `wss://` URL.
2. **TEST** asks that address what it is — name, players, ping, and whether it
   wants a password — without joining.
3. **+ SAVE CURRENT** keeps the address for next time. **REFRESH** checks every
   saved address at once, so you can see which of your sessions has people in it.
4. Nothing needs to be open on the joiner's machine.

The port is remembered between runs, and it is how you pick between sessions:
see below.

### Dedicated servers, and several sessions at once

A session can run head-less on an always-on box — a Raspberry Pi is plenty,
since the server relays messages and runs no simulation:

```bash
npm run server -- --port 45454 --name "Alpha"
```

**A session is a process.** Several concurrent, independent sessions are several
processes on several ports — `45454`, `45455`, and so on — which is why the
port field is editable and saved. Give each one a `--name` and `TEST`/`REFRESH`
will tell them apart.

Set a password with the `FSIM_PASSWORD` environment variable for anything on a
publicly routable port. See [docs/dedicated-server.md](docs/dedicated-server.md)
for the systemd template unit, TLS with a reverse proxy, and
`scripts/deploy-pi.sh`.

### Notes

- On a LAN, all players must be on the same subnet.
- If the displayed IP looks wrong (VPN active, multiple adapters), enter the
  correct one manually in the join field.
- Mac and Windows players can play together — the protocol is cross-platform.
- AP client isolation on some routers blocks connections; disable it or use a
  wired switch if joining fails.
- The host picks the scenario for everyone, and simulates the AI in it. Any
  scenario works: AI is replicated from the host, so there is one set of bandits
  rather than a private copy per player.
- Kills against AI count towards your personal score and the kill feed, but not
  towards the team score that ends a match — that race is between players.
- If the host leaves, its AI goes with it and a new host is elected.
- Friendly fire is off, and the server enforces it — you cannot lock or hit
  your own side.

## Audio Assets

Sound effects (WAV) are included under `src/renderer/public/sounds/`. The game loads these automatically; any missing file falls back to synthesized placeholders.

To regenerate missing sounds locally:

```bash
node scripts/generate-sounds.cjs
```

For filenames, sources, and recording tips, see [`src/renderer/public/sounds/README.md`](src/renderer/public/sounds/README.md).

## Controls

Default keyboard bindings are defined in [`src/renderer/input/ControlMapping.ts`](src/renderer/input/ControlMapping.ts). A full control reference is also shown on the in-game loadout screen.

| Category | Keys |
|----------|------|
| **Flight** | W/S pitch, A/D roll, Q/E yaw, Shift/Ctrl throttle, G gear, V flaps, B brakes |
| **Weapons** | Space gun, F missile, C cycle missile |
| **Countermeasures** | Z flares + chaff |
| **Radar** | R mode, T next track, L lock, U unlock |
| **Misc** | Tab camera, F12 debug overlay, ` eject |
| **Wingmen** | 1 engage, 2 cover, 3 RTB, 4 rejoin |
| **Targeting pod** | P toggle, O lock, K unlock |

### Controllers

Xbox and PlayStation gamepads are supported via the W3C standard gamepad mapping
(no configuration — just connect and press a button). The map lives in
[`DEFAULT_GAMEPAD_BINDINGS`](src/renderer/input/ControlMapping.ts).

| Control | Action |
|---------|--------|
| Left stick | Roll / pitch |
| Right stick | Yaw (X), throttle (push up / pull down) |
| RT / LT | Fire gun / fire missile |
| RB / LB | Cycle missile / countermeasures |
| A / B / X / Y | Gear / speed brake / flaps / wheel brakes |
| D-pad | Radar mode · select next · unlock · lock |
| L3 / R3 | TGP power / TGP lock |
| View / Menu | Camera toggle / pause |

Wingman calls, TGP unlock, and eject stay on the keyboard. HOTAS sticks that
don't report the standard mapping get best-effort stick + button handling.

## Changelog

### Combat Core Fixes (Stage 1-2 of `FRIENDS_RELEASE_AUDIT.md`)

A release-readiness audit ([`FRIENDS_RELEASE_AUDIT.md`](FRIENDS_RELEASE_AUDIT.md)) identified a CI-blocking test failure plus several mechanical combat bugs. Stages 1-2 (the release blockers) have been implemented:

**Build gate**
- Added the missing `fa18e` sustained turn-rate reference band (`{ min: 12, max: 20 }` deg/s) to [`turnPerformance.ts`](src/renderer/data/aircraft/turnPerformance.ts) — the F/A-18E had been added to the aircraft roster without a corresponding regression band, so `TurnRateRegression.test.ts` failed and `npm run ci` never went green.
- Cleared all 16 `no-unused-vars` lint warnings (dead imports, two dead computations, two intentionally-unused params renamed with a `_` prefix). No behavior changes.

**Missile proximity fuse — was tunneling through targets**
- `Warhead.checkProximityFuse` previously tested only the missile's end-of-tick distance against a 9-12 m fuse radius, with a "closest-approach" fallback that could never fire because the field it depended on (`prevMissDistanceM`) was only ever written on the branch where it was already too late to help. At realistic head-on closure speeds (~1200 m/s, ~20 m of relative travel per 1/60 s tick) this let missiles fly clean through a target.
- Rewrote it as a swept closest-approach test: treats missile and target as moving in straight lines for the tick, solves for the time of minimum relative separation (clamped to `[0, dt]`), and detonates if that minimum distance is within the fuse gate. It now returns the true miss distance instead of forcing callers to re-derive it from end-of-tick positions.
- `computeLethality` was changed to take that miss distance directly rather than two position vectors.

**Missile lethality — a single hit could never kill**
- Primary-hit severity was raised from `lethality * 0.65` to `lethality² * 1.15` (clamped to 1.0 by the existing damage-zone clamp), so a dead-centre hit now destroys the target in one shot instead of requiring two.

**Gun rounds — tunneling through targets**
- `GunSystem` tested only each round's post-integration position against a 5 m sphere; at ~21 m of travel per tick this missed roughly half of well-aimed shots. It now sweeps the segment between the round's pre- and post-tick positions against the target sphere (new `segmentPointDistance` helper in [`MathUtils.ts`](src/renderer/utils/MathUtils.ts)), and stops checking further enemies after the first hit so one round can no longer damage two aircraft standing close together.

**Explosion visuals — lasted a fraction of a second instead of ~2.2 s**
- The explosion particle pool is shared per-scene, but every `MissileSystem` and `BombSystem` instance (player, each AI aircraft, SAMs, debug spawns) was independently advancing it every tick — in a multi-bandit scenario the pool could be stepped 5-6× per tick, shrinking a 2.2 s explosion to well under half a second. Added an exported `stepExplosionPool(scene, dt)` in [`ExplosionEffect.ts`](src/renderer/scene/ExplosionEffect.ts) that is now called exactly once per tick from `FlightSession.tick()`, and removed the redundant per-system calls.

**Tests**: extended `Warhead.test.ts` with a hand-verified high-closure fly-through case (both tick endpoints outside the fuse gate, true closest approach inside it) and added a `DamageModel.test.ts` case confirming a lethality-1.0 hit destroys. `npm run ci` passes with 169/169 tests.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (electron-vite) |
| `npm run build` | Production build |
| `npm run preview` | Run built app |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run ci` | typecheck + lint + test |
| `npm run dist` | Package for current OS |
| `npm run dist:mac` | macOS DMG + ZIP (run on macOS) |
| `npm run dist:win` | Windows NSIS installer (run on Windows) |
