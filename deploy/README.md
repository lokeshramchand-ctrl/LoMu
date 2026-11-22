# Deploying LoMu to the homelab

Status: **prepared, not executed.** These files were written and checked locally (the production
build and the end-to-end tests pass), but nothing has been installed on the Proxmox host. The
steps below are the checklist for doing it.

## 1. LXC

Create a Debian 12/13 LXC with a static IP (CTID = last octet, as usual). 1 vCPU, 512 MB RAM and
2 GB disk are plenty. Node 24 is needed (the server uses the built-in `node:sqlite`).

## 2. Install

Inside the container, as root:

```bash
REPO=<git url of this repo> bash deploy/install.sh
```

This creates a `lomu` system user, builds the app into `/opt/lomu`, installs the systemd unit and
starts it on `127.0.0.1:4100`. Data lives in `/var/lib/lomu` (one SQLite file, `lomu.db`: back this
up), the YouTube session cache in `/var/cache/lomu`.

`/etc/lomu.env` is created with a random `LOMU_SETUP_CODE`. Until you create your account the app
is open to anyone who can reach it, so the code makes sure only you can claim it.

## 3. nginx

Copy `deploy/nginx-lomu.conf` into the nginx site template, set the `server_name` to the subdomain
you choose and use your wildcard certificate. The `/api/stream/` and `/api/sync/events` blocks are
the LoMu-specific parts (no buffering, long timeouts). Reload nginx.

## 4. First run

Open the subdomain, create the account (username, password, setup code). Then in the Android app:
Settings → Account & sync → enter the same address, sign in. To bring your YouTube Music library
over: Settings → Import from YouTube Music (one-time sign-in, the session is discarded afterwards).

## 5. Monitoring and upkeep

- Uptime Kuma: HTTP check on `https://<subdomain>/api/auth/status` (returns 200 with
  `{"setup":true,...}`).
- Update: `REPO=... bash deploy/install.sh` again (pull, rebuild, restart).
- Logs: `journalctl -u lomu -f`.
- If playback starts failing for every song, YouTube changed something: update dependencies
  (`npm update youtubei.js`) and rebuild. `web/scripts/probe-full.mjs <videoId>` shows which
  YouTube clients can currently download a whole file; `LOMU_REGION` sets the catalogue region.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `LOMU_DATA_DIR` | `~/.lomu` | where `lomu.db` lives |
| `LOMU_CACHE_DIR` | OS temp | youtubei.js cache |
| `LOMU_SECURE_COOKIES` | off | set to `1` behind HTTPS |
| `LOMU_SETUP_CODE` | unset | required to create the owner account |
| `LOMU_MAX_USERS` | `4` | accounts allowed (owner + guests), added by the admin in Settings → Accounts |
| `LOMU_LAN_ADDRESS` | unset | the server's private address, advertised to signed-in clients as a way in from inside the LAN |
| `LOMU_PROXY_HOPS` | `1` | reverse proxies in front of the app (sign-in rate limit) |
| `LOMU_MAX_DOCS` | `300000` | per-account row ceiling |
| `LOMU_REGION` | `IN` | YouTube catalogue region |
