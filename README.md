# FSim

Combat flight simulator pitting US and Russian fighters against each other. Fly modern jets with a simplified but responsive flight model, radar and weapons systems, AI opponents, and optional LAN multiplayer — all in a desktop app built with Electron and Three.js.

**Version:** 0.1.5

## Features

- **Aircraft roster** — F-22, F-35A, F-16C, F-15C, FA-18C, MiG-29, Su-57, Su-27, Su-35
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

## LAN Multiplayer

FSim supports 2–N player combat over a local network. No internet or account is required.

### Hosting a game

1. On the **Loadout** screen, set a port (default **45454**) and click **Host Lobby**.
2. Your LAN IP is shown next to "Host/share IP" — share this with other players.
3. On **macOS**, the OS will prompt *"FSim would like to accept incoming network connections"* — click **Allow**.
4. On **Windows**, allow the app through Windows Defender Firewall if prompted.

### Joining a game

1. Enter the host's LAN IP and port, then click **Join Lobby**.
2. No inbound port needs to be open on the joiner's machine.

### Notes

- All players must be on the same subnet (e.g. the same Wi-Fi or wired LAN).
- If the displayed IP looks wrong (VPN active, multiple adapters), check your OS network settings and enter the correct IP manually in the join field.
- Mac and Windows players can play together — the protocol is cross-platform.
- AP client isolation on some routers will block connections; disable it or use a direct switch if joining fails.

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
