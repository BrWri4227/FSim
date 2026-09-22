#!/usr/bin/env bash
#
# Build the head-less session server and install it on a Raspberry Pi.
#
#   scripts/deploy-pi.sh pi@raspberrypi.local
#   scripts/deploy-pi.sh pi@raspberrypi.local /home/pi/fsim
#
# Copies dist-server/ and package.json, installs only the runtime dependency
# (ws), and installs the systemd *template* unit. It deliberately does not
# start anything: several concurrent sessions are several instances of that
# template, one per port, and only you know which ports you want.
#
# After this runs, see docs/dedicated-server.md — the short version is:
#
#   sudo mkdir -p /etc/fsim
#   printf 'FSIM_NAME=Alpha\nFSIM_PASSWORD=changeme\n' | sudo tee /etc/fsim/45454.env
#   sudo chmod 600 /etc/fsim/45454.env
#   sudo systemctl enable --now fsim-server@45454
#
set -euo pipefail

TARGET="${1:-}"
REMOTE_DIR="${2:-/home/pi/fsim}"

if [[ -z "$TARGET" ]]; then
  echo "usage: $0 user@host [remote-dir]" >&2
  exit 64
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Building the server bundle"
npm run build:server

if [[ ! -f dist-server/server/standalone.js ]]; then
  echo "build produced no dist-server/server/standalone.js" >&2
  exit 1
fi

echo "==> Creating ${TARGET}:${REMOTE_DIR}"
ssh "$TARGET" "mkdir -p '${REMOTE_DIR}'"

echo "==> Copying dist-server/ and package.json"
# --delete so a removed file on this side does not linger on the Pi.
rsync -az --delete dist-server/ "${TARGET}:${REMOTE_DIR}/dist-server/"
rsync -az package.json "${TARGET}:${REMOTE_DIR}/package.json"

echo "==> Installing runtime dependencies (ws only)"
ssh "$TARGET" "cd '${REMOTE_DIR}' && npm install --omit=dev --no-audit --no-fund"

echo "==> Installing the systemd template unit"
# %i is the instance name after the @, which is the port. One unit file serves
# every concurrent session.
ssh "$TARGET" "sudo tee /etc/systemd/system/fsim-server@.service > /dev/null" <<UNIT
[Unit]
Description=FSim session server on port %i
After=network-online.target

[Service]
ExecStart=/usr/bin/node ${REMOTE_DIR}/dist-server/server/standalone.js --port %i
# Per-session FSIM_NAME / FSIM_PASSWORD / FSIM_MAX_PEERS. The leading dash
# means "start anyway if this file does not exist".
EnvironmentFile=-/etc/fsim/%i.env
Restart=always
RestartSec=3
User=$(ssh "$TARGET" 'id -un')

[Install]
WantedBy=multi-user.target
UNIT

ssh "$TARGET" "sudo systemctl daemon-reload"

RUNNING="$(ssh "$TARGET" "systemctl list-units 'fsim-server@*' --no-legend --plain 2>/dev/null | awk '{print \$1}'" || true)"

echo
echo "Deployed to ${TARGET}:${REMOTE_DIR}"
if [[ -n "$RUNNING" ]]; then
  echo "Restarting the sessions already installed:"
  echo "$RUNNING" | sed 's/^/  /'
  # shellcheck disable=SC2086
  ssh "$TARGET" "sudo systemctl restart $RUNNING"
else
  echo "No sessions configured yet. To start one on port 45454:"
  echo "  ssh ${TARGET}"
  echo "  sudo mkdir -p /etc/fsim"
  echo "  printf 'FSIM_NAME=Alpha\\n' | sudo tee /etc/fsim/45454.env"
  echo "  sudo chmod 600 /etc/fsim/45454.env"
  echo "  sudo systemctl enable --now fsim-server@45454"
fi
echo
echo "Logs:  ssh ${TARGET} journalctl -u 'fsim-server@*' -f"
