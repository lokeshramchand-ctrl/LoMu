#!/usr/bin/env bash
# Installs LoMu inside a fresh Debian/Ubuntu LXC. Run as root:
#   REPO=<git url or path> bash install.sh
# Re-run it to update: it pulls, rebuilds and restarts.
set -euo pipefail

REPO="${REPO:?set REPO to the LoMu git url or a local path}"
APP=/opt/lomu

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  apt-get update
  apt-get install -y curl ca-certificates git
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

id lomu >/dev/null 2>&1 || useradd --system --home /var/lib/lomu --shell /usr/sbin/nologin lomu
install -d -o lomu -g lomu /var/lib/lomu /var/cache/lomu

if [ -d "$APP/.git" ]; then
  git -C "$APP" pull --ff-only
else
  git clone "$REPO" "$APP"
fi

cd "$APP/web"
npm ci
npm run build
chown -R lomu:lomu "$APP"

install -m 644 "$APP/deploy/lomu.service" /etc/systemd/system/lomu.service
if [ ! -f /etc/lomu.env ]; then
  # First-run guard: only someone who knows this code can create the owner account.
  echo "LOMU_SETUP_CODE=$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 12)" > /etc/lomu.env
  chmod 600 /etc/lomu.env
  echo "Setup code written to /etc/lomu.env (needed once, when you create your account)."
fi
systemctl daemon-reload
systemctl enable --now lomu
systemctl restart lomu
echo "LoMu is listening on 127.0.0.1:4100. Point nginx at it (deploy/nginx-lomu.conf)."
