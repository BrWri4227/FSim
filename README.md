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

- **Node.js 18+** (recommended; no `engines` field is set in `package.json`)
- **npm** (ships with Node.js)
- **Windows** for `npm run dist:win` packaging (the app runs cross-platform in dev)

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/BrWri4227/FSim.git
cd FSim
npm install
```

## Development

Start the Electron app with hot reload:

```bash
npm run dev
```

## Production Build

Build the app, then launch the built output:

```bash
npm run build
npm run preview
```

## Packaging (Optional)

Create a distributable installer with electron-builder:

```bash
npm run dist        # platform default
npm run dist:win    # Windows NSIS installer (x64)
```

Installers are written to the `release/` directory.

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
| `npm run dist` | Package with electron-builder |
| `npm run dist:win` | Windows NSIS package |
