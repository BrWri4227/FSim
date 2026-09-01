# Dedicated session server

The multiplayer relay used to live only inside the Electron host ("Host LAN
game" in the lobby). It is now a standalone module (`src/server/GameServer.ts`)
with a head-less entry point (`src/server/standalone.ts`), so a session no
longer needs one player running the full game as host. Point it at an
always-on box — a VPS, or a Raspberry Pi on your LAN with one forwarded port —
and everyone (including you) joins as a client.

The Electron "Host LAN game" button still works and now runs the exact same
code path.

## What the server does

It is a pure message relay + validator. No simulation runs on it:

- assigns `peer_N` ids, tracks profiles and last-known state
- relays `join` / `state` / `hit` / `profile-update` between peers
- validates every inbound message (`src/shared/network/validation.ts`) and
  drops malformed / out-of-range / implausible ones
- `permessage-deflate` compression on the snapshot stream
- ping/pong heartbeat — unresponsive sockets are terminated after ~30 s
- per-peer inbound rate limit and a `maxPeers` cap

State is in-memory only; restarting the server drops the session.

## Running it

```bash
npm run build:server        # tsc -> dist-server/
node dist-server/server/standalone.js --port 8080 --max-peers 12
```

Options (flag or environment variable):

| Flag          | Env              | Default   | Meaning                        |
|---------------|------------------|-----------|--------------------------------|
| `--port`      | `FSIM_PORT`      | `8080`    | TCP port to listen on          |
| `--host`      | `FSIM_HOST`      | `0.0.0.0` | bind address                   |
| `--max-peers` | `FSIM_MAX_PEERS` | `16`      | hard cap on connected sockets  |

`npm run server` builds and starts in one step.

Only `dist-server/`, `node_modules/ws`, and a Node ≥ 18 runtime are needed on
the target machine — copy `dist-server/`, `package.json`, and run
`npm install --omit=dev` (or just `npm install ws`).

## Raspberry Pi setup

A Pi 3 or newer easily handles a dozen peers (the relay is I/O bound, not CPU
bound).

1. Install Node 18+ (`sudo apt install nodejs npm`, or nodesource).
2. Copy the repo (or just `dist-server/` + `package.json`) to the Pi and
   `npm install --omit=dev`.
3. Run it under systemd so it restarts on crash / reboot:

   ```ini
   # /etc/systemd/system/fsim-server.service
   [Unit]
   Description=FSim session server
   After=network-online.target

   [Service]
   ExecStart=/usr/bin/node /home/pi/fsim/dist-server/server/standalone.js --port 8080
   Restart=always
   RestartSec=3
   User=pi

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl enable --now fsim-server
   journalctl -u fsim-server -f      # live logs
   ```

## Playing over the internet

The client accepts a bare IP, `host:port`, or a full `ws://` / `wss://` URL in
the lobby "Join" field (see `resolveSessionUrl` in
`src/renderer/network/MultiplayerClient.ts`).

- **Port forwarding**: forward the chosen TCP port on your router to the Pi's
  LAN address. Players connect to `your.public.ip:8080`. Use a dynamic-DNS
  name if your ISP rotates your address.
- **TLS (recommended for anything public)**: terminate `wss://` at a reverse
  proxy and forward plaintext to the server on localhost. Example with Caddy:

  ```
  fsim.example.com {
      reverse_proxy 127.0.0.1:8080
  }
  ```

  Players then join with `wss://fsim.example.com`.
- The server has no authentication. Anyone who can reach the port can join.
  Keep `--max-peers` sane, run it behind a proxy you control, and rotate the
  port / DNS name if you get unwanted traffic. Message validation and rate
  limiting blunt abuse but are not a substitute for access control.

## Netcode notes (for tuning latency)

- Clients send state at 20 Hz; countermeasure payloads are sent only on change
  plus a 2 Hz re-sync, and remote clients age flares/chaff locally in between.
- Snapshots are quantised on the wire (`src/shared/network/serialization.ts`)
  and gzip-compressed by the transport.
- `NetworkAircraft` buffers 12 snapshots and renders 120 ms in the past, with
  up to 250 ms of velocity extrapolation to cover packet loss. Raise
  `INTERP_DELAY_MS` there if you see rubber-banding on a high-jitter link.
