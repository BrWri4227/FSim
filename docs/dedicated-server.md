# Dedicated session server

The multiplayer relay is a standalone module (`src/server/GameServer.ts`) with a
head-less entry point (`src/server/standalone.ts`), so a session does not need
one player running the full game as host. Point it at an always-on box — a VPS,
or a Raspberry Pi with one forwarded port per session — and everyone, you
included, joins as a client.

The in-app **HOST** button in the multiplayer lobby runs the exact same code,
inside the Electron main process.

## Concurrent sessions: one process per session

**A session is a process. Several sessions are several processes, each on its
own port.** There is no room or lobby concept inside the server; a client picks
a session by typing its port.

This is why the port field in the lobby is editable and remembered, and why
saved addresses exist — `192.168.1.50:45454` and `192.168.1.50:45455` are two
independent sessions on one Pi. Give each one a `--name` and the lobby's `TEST`
and `REFRESH` buttons will tell them apart at a glance.

The cost is one forwarded TCP port per session (and one TLS route each, if you
want `wss://`). The benefit is that the server stays a pure relay with no
routing, and a crash in one session cannot touch another.

## What the server does

It is a message relay and validator. No simulation runs on it:

- assigns `peer_N` ids, tracks profiles and last-known state
- relays `join` / `state` / `hit` / `profile-update` between peers
- relays `ai-state` and `ai-death`, but only from the elected host, and keeps
  each AI's last team and position so hits involving one are range- and
  team-checked like any other
- owns the match: scores, phase, host election, the score and time limits
- validates every inbound message (`src/shared/network/validation.ts`) and drops
  malformed, out-of-range or implausible ones
- answers `query` with a `server-info` summary, without taking a player slot
- refuses a join with a reason (`full`, `bad-password`, `version`) instead of
  dropping the socket silently
- `permessage-deflate` compression on the snapshot stream
- ping/pong heartbeat — unresponsive sockets are terminated
- per-peer inbound rate limit, a `maxPeers` cap, and a handshake timeout on
  sockets that connect and never join

State is in-memory only; restarting the server drops the session.

## Running it

```bash
npm run build:server        # tsc -> dist-server/
node dist-server/server/standalone.js --port 45454 --max-peers 12 --name "Alpha"
```

Options (flag or environment variable):

| Flag            | Env                 | Default            | Meaning                                  |
|-----------------|---------------------|--------------------|------------------------------------------|
| `--port`        | `FSIM_PORT`         | `45454`            | TCP port to listen on                    |
| `--host`        | `FSIM_HOST`         | `0.0.0.0`          | bind address                             |
| `--max-peers`   | `FSIM_MAX_PEERS`    | `16`               | hard cap on joined players               |
| `--name`        | `FSIM_NAME`         | `FSim session :<port>` | shown to anyone who probes the address |
| `--description` | `FSIM_DESCRIPTION`  | none               | second line in the probe readout          |
| `--password`    | `FSIM_PASSWORD`     | none               | required to join, when set               |

`npm run server` builds and starts in one step.

> **Set the password through the environment, not the flag.** A password on the
> command line is visible to every user on the box via `ps`. The systemd unit
> below reads it from a root-only file.

The default port matches `DEFAULT_SESSION_PORT` in
`src/shared/network/MultiplayerTypes.ts`, which is also what the lobby starts
with — so a player who changes nothing and a server started with no flags will
find each other.

Only `dist-server/`, `node_modules/ws`, and Node ≥ 18 are needed on the target
machine.

## Raspberry Pi setup

A Pi 3 or newer handles a dozen peers comfortably: the relay is I/O bound, not
CPU bound, because it runs no simulation. The practical ceiling across several
concurrent sessions is bandwidth, so pick the number of instances deliberately
rather than starting twenty.

1. Install Node 18+ (`sudo apt install nodejs npm`, or nodesource for a current
   arm64 build).
2. Deploy with `scripts/deploy-pi.sh pi@raspberrypi.local` from a checkout, or
   copy `dist-server/` + `package.json` by hand and run `npm install --omit=dev`.
3. Install the **template** unit — one file, any number of sessions:

   ```ini
   # /etc/systemd/system/fsim-server@.service
   [Unit]
   Description=FSim session server on port %i
   After=network-online.target

   [Service]
   # %i is the port, taken from the instance name after the @.
   ExecStart=/usr/bin/node /home/pi/fsim/dist-server/server/standalone.js --port %i
   # Per-session name / password / cap. The dash means "carry on if absent".
   EnvironmentFile=-/etc/fsim/%i.env
   Restart=always
   RestartSec=3
   User=pi

   [Install]
   WantedBy=multi-user.target
   ```

4. Give each session its own environment file, readable only by root so the
   password does not leak to other users on the box:

   ```bash
   sudo mkdir -p /etc/fsim
   printf 'FSIM_NAME=Alpha\nFSIM_MAX_PEERS=12\nFSIM_PASSWORD=changeme\n' \
     | sudo tee /etc/fsim/45454.env > /dev/null
   printf 'FSIM_NAME=Bravo\nFSIM_MAX_PEERS=8\n' \
     | sudo tee /etc/fsim/45455.env > /dev/null
   sudo chmod 600 /etc/fsim/*.env
   ```

5. Start as many as you want:

   ```bash
   sudo systemctl enable --now fsim-server@45454 fsim-server@45455
   systemctl status 'fsim-server@*'
   journalctl -u 'fsim-server@*' -f       # live logs from every session
   ```

   Stopping one leaves the other running:
   `sudo systemctl stop fsim-server@45455`.

## Is it up?

From any machine with Node, ask the server what it is — the same `query` the
lobby's `TEST` button sends:

```bash
node -e "const W=require('ws'),s=new W('ws://raspberrypi.local:45454');\
s.on('open',()=>s.send(JSON.stringify({type:'query'})));\
s.on('message',m=>{console.log(m.toString());process.exit(0)});\
s.on('error',e=>{console.error(e.message);process.exit(1)});\
setTimeout(()=>{console.error('no answer');process.exit(1)},4000)"
```

A healthy session answers with a `server-info` frame carrying its name, player
count and whether it wants a password.

## Playing over the internet

The client accepts a bare IP, `host:port`, or a full `ws://` / `wss://` URL in
the lobby's join field (see `resolveSessionUrl` in
`src/renderer/network/MultiplayerClient.ts`).

- **Port forwarding**: forward one TCP port per session to the Pi's LAN address.
  Players connect to `your.public.ip:45454`. Use a dynamic-DNS name if your ISP
  rotates your address.
- **TLS (recommended for anything public)**: terminate `wss://` at a reverse
  proxy and forward plaintext to localhost. One route per session:

  ```
  alpha.fsim.example.com {
      reverse_proxy 127.0.0.1:45454
  }
  bravo.fsim.example.com {
      reverse_proxy 127.0.0.1:45455
  }
  ```

  Players then join with `wss://alpha.fsim.example.com`.
- **Access control is the password and nothing else.** Message validation, rate
  limiting and `--max-peers` blunt abuse but are not access control. A publicly
  routable port with no password is a public server. Damage is
  client-authoritative — the server range-checks and team-checks hits but does
  not simulate — so a modified client can cheat, which is fine among friends and
  is not fine on an open port.

## AI in a session

AI is simulated by one client — the elected host — and replicated to everyone
else, rather than by the server. The relay runs no physics, and a box hosting
several concurrent sessions could not simulate several worlds anyway.

On the receiving side a replicated AI is an ordinary remote aircraft: the same
interpolation, team filtering, radar and HUD treatment as a human, which is why
none of that needed an AI case.

Consequences worth knowing:

- Damage to AI is decided by the host, the way damage to a player is decided by
  that player. The server range- and team-checks, but does not simulate.
- AI kills give personal credit and a kill-feed line, but do not move the team
  score. That number is the race to `scoreLimit` between players, and AI kills
  driving it would let a match be won without meeting anyone.
- If the host leaves, its AI is cleared for everyone and a new host is elected.
  A half-simulated aircraft is not handed over.

## Netcode notes (for tuning latency)

- Clients send state at 20 Hz; countermeasure payloads go out only on change
  plus a 2 Hz re-sync, and remote clients age flares and chaff locally between.
- Snapshots are quantised on the wire
  (`src/shared/network/serialization.ts`) and deflated by the transport.
- `NetworkAircraft` renders each peer in the past by a delay that **follows the
  measured arrival jitter of that peer** (`interpolationDelay.ts`), clamped to
  100–400 ms, with up to 400 ms of velocity extrapolation to cover loss. A fixed
  LAN-sized delay is what caused rubber-banding over the internet: the
  interpolator ran out of future and started guessing.
- Round-trip time is measured with an application-level `ping`/`pong` at 1 Hz,
  because a browser `WebSocket` cannot observe the protocol-level pong. It is
  shown bottom-left in flight as `LINK <n>ms`, turning amber past 120 ms and red
  past 250 ms or whenever snapshots stop arriving.
- A server that stops, restarts, or becomes unreachable ends the sortie with the
  reason on screen and returns to the lobby with the address still filled in.
  There is deliberately no silent auto-reconnect: rejoining assigns a fresh peer
  id, so the server's record of that player's kills and deaths would restart at
  zero, and a scoreboard that quietly resets mid-match is worse than a clear
  trip back to the lobby.
