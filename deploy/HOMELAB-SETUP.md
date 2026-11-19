# LoMu: setup after cloning on the homelab

You have cloned this repo on the homelab. This guide takes it from a plain clone to a working
`https://` site and a signed-in phone. It follows the conventions in `HOMELAB.md`
(one service = one container, CTID = last IP octet, nginx on `pve` is the only entry point,
shared wildcard certificate).

LoMu is one Node app (Next.js web player + sync server) with one SQLite file as its database.
It needs Node 24 (it uses the built-in `node:sqlite`) and outbound internet access to YouTube.

Pick **one** of the two paths:

| | Path A: Coolify (Docker) | Path B: LXC + systemd |
|---|---|---|
| Fits | the Coolify plan on CT 136 (`*.example.com`) | the classic pattern: LXC + nginx file on `pve` |
| Uses your clone | no, Coolify pulls from GitHub itself | yes, `install.sh` builds from the clone |
| Updates | push to git, press Deploy (or auto-deploy) | `git pull` + re-run `install.sh` |
| TLS | Coolify/Traefik | wildcard cert on `pve` |

---

## 0. Pre-flight (both paths)

1. **Pick a hostname.** Path A: `lomu.example.com`. Path B: `lomu.example.com`
   (the `*.example.com` wildcard DNS and certificate already cover it, nothing to add).
2. **Make up a setup code**, any random string, for example `openssl rand -hex 8`. It is required
   once, when you create the owner account, so nobody who finds the URL first can claim the app.
3. **Check the clone is complete**, from the repo folder:

   ```bash
   git log --oneline | head -3        # should show recent LoMu commits
   ls web/Dockerfile deploy/install.sh
   git branch --show-current          # use main (or music, they are identical)
   ```

4. Know that the repo on GitHub is named **LoMu** (`your-user/LoMu`) but contains
   LoMu. If it is private, Coolify needs a deploy key (see A2).

---

## Path A: Coolify (Docker)

Coolify runs in **CT 136** (`coolify.example.com`, `192.168.1.10`). At the last audit it was
**stopped**.

### A1. Start Coolify

On the Proxmox host:

```bash
pct start 136
pct status 136                                   # running
curl -sI http://192.168.1.10:8000 | head -1      # expect HTTP 200/302
```

Then open `https://coolify.example.com` and sign in.

### A2. Create the application

1. **Projects → (your project) → New Resource → Application**.
2. Source: **Public Repository** (or **Private Repository (deploy key)**: add the key Coolify
   shows under the repo's *Settings → Deploy keys* on GitHub, read-only is enough).
3. Repository: `https://github.com/your-user/LoMu`, branch `main`.
4. **Build Pack: Dockerfile**.
5. **Base Directory: `/web`**, Dockerfile location: `/Dockerfile`.
6. **Ports Exposes: `4100`**.
7. **Domains:** `https://lomu.example.com`
   (Coolify obtains the certificate and sets up the proxy itself).

### A3. Persistent data (do this before the first deploy)

Under **Persistent Storage** add:

| Type | Mount path | Why |
|---|---|---|
| Volume | `/data` | `lomu.db`, **your whole account, likes, playlists, history. Back this up.** |
| Volume (optional) | `/cache` | YouTube session cache, safe to lose |

Without the `/data` volume the database is wiped on every redeploy.

### A4. Environment variables

Under **Environment Variables** (runtime):

| Variable | Value |
|---|---|
| `LOMU_SETUP_CODE` | the code from step 0.2 |
| `LOMU_REGION` | `IN` (optional, YouTube catalogue region) |

`LOMU_SECURE_COOKIES=1`, `LOMU_DATA_DIR=/data`, `LOMU_CACHE_DIR=/cache` and port 4100 are already
set inside the image. HTTPS is mandatory because the login cookie is `Secure`.

### A5. Deploy and verify

Press **Deploy**. The first build takes a few minutes (it runs `npm ci` and `next build`).

```bash
curl -s https://lomu.example.com/api/auth/status
# {"setup":false,"user":null,"needsCode":true}
```

`"setup":false` and `"needsCode":true` mean the app is running and waiting for you to create
the owner account. Continue at **First run** below.

---

## Path B: LXC + systemd (uses your clone)

### B1. Create the container

Follow runbook step 1 to 3 in `HOMELAB.md`. Use a CTID above 136, for example **137**:

- Debian 13 (or 12), unprivileged, 1 core, 512 MB to 1 GB RAM, 4 GB disk.
- Bridge `vnet1`, **static** IP `192.168.1.11/24`, gateway `10.10.10.1`, DNS `10.10.10.107`.
- `pct set 137 -onboot 1` and `nesting=1`.

### B2. Get the clone into the container

The installer needs the repo inside the container. Clone it there (the simplest way):

```bash
pct enter 137
apt-get update && apt-get install -y git curl ca-certificates
git clone https://github.com/your-user/LoMu.git /root/LoMu
```

If you already cloned somewhere else, copy that folder into the container instead
(`pct push` for single files, or `rsync`/`scp` for the whole folder) and use its path below.

### B3. Run the installer

Inside the container, as root, from the clone:

```bash
cd /root/LoMu
REPO=/root/LoMu bash deploy/install.sh
```

What it does: installs Node 24 if needed, creates the `lomu` system user, copies the repo to
`/opt/lomu`, runs `npm ci` and `npm run build`, installs `lomu.service`, writes
`/etc/lomu.env` with a random `LOMU_SETUP_CODE`, and starts the service.

Read the setup code:

```bash
cat /etc/lomu.env
```

Data lives in `/var/lib/lomu` (`lomu.db`, **back this up**), cache in `/var/cache/lomu`.

### B4. Make it reachable from nginx on `pve`

The unit starts the app on `127.0.0.1:4100`, which only the container itself can reach, but
nginx runs on the **host**. Let the app listen on the container's address with a drop-in
(do not edit the shipped unit):

```bash
systemctl edit lomu
```

Paste:

```ini
[Service]
ExecStart=
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 4100 -H 0.0.0.0
```

```bash
systemctl restart lomu
curl -s http://127.0.0.1:4100/api/auth/status
```

From the host: `curl -s http://192.168.1.11:4100/api/auth/status` must answer too. The lab
network is private (HOMELAB.md section 1), so this is not exposed to the internet.

### B5. nginx site on `pve`

On the Proxmox host, create `/etc/nginx/sites-available/lomu.conf` from the base template
(HOMELAB.md 7.3) plus LoMu's two special blocks. Do **not** add the WebSocket `map` again.

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name lomu.example.com;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    client_max_body_size 5m;

    location / {
        proxy_pass http://192.168.1.11:4100;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Audio proxy: streamed, range-aware, no buffering, long timeouts.
    location /api/stream/ {
        proxy_pass http://192.168.1.11:4100;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        gzip off;
    }

    # Server-sent events: one long-lived connection per open client.
    location /api/sync/events {
        proxy_pass http://192.168.1.11:4100;
        proxy_http_version 1.1;
        proxy_set_header Host       $host;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
        gzip off;
    }
}
```

Enable and reload (back up first: `cp -a /etc/nginx /root/nginx-backup-$(date +%F)`):

```bash
ln -s /etc/nginx/sites-available/lomu.conf /etc/nginx/sites-enabled/lomu.conf
nginx -t && systemctl reload nginx
curl -s https://lomu.example.com/api/auth/status
```

Expected: `{"setup":false,"user":null,"needsCode":true}`.

---

## First run (both paths)

1. Open your URL in a browser. You get the **Create your account** screen.
2. Enter a username, a password (**at least 8 characters**) and the **setup code**.
3. You land on Home. From now on the whole API requires that login.

Then:

- **Phone (Android app):** Settings → Account & sync → enter the server address
  (`https://lomu.example.com` or `https://lomu.example.com`) → sign in.
  To bring your YouTube Music library over: Settings → Import from YouTube Music.
- **Install as an app:** in Chrome/Edge use "Install" (the site is a PWA).
- Optional: remove `LOMU_SETUP_CODE` afterwards. It only matters before the account exists.

---

## Monitoring and backups

- **Uptime Kuma** (`kuma.example.com`): HTTP check on `https://<your-host>/api/auth/status`,
  expect 200.
- **Backups:** the lab has none scheduled, so do this one on purpose.
  - Path A: back up the Coolify volume mounted at `/data`.
  - Path B: include CT 137 in a vzdump job, or copy `/var/lib/lomu/lomu.db*` regularly.
  - Independent of both: Settings → Library → **Export library** downloads your likes,
    playlists and history as JSON.
- Add a row for LoMu to the inventory table in `HOMELAB.md` section 3.

---

## Updating

- **Path A:** push to git, then **Deploy** in Coolify (or turn on auto-deploy on the branch).
- **Path B:** in the container, `cd /root/LoMu && git pull && REPO=/root/LoMu bash deploy/install.sh`
  (it pulls, rebuilds and restarts; the drop-in from B4 survives).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Login works but you are bounced back to the login screen | The site is being served over plain HTTP. The cookie is `Secure`, use `https://`. Check `X-Forwarded-Proto` is passed by the proxy. |
| Everything is empty after a redeploy (Path A) | No volume on `/data`. Add it (A3). The old data is gone. |
| 502 from nginx (Path B) | App not listening on the container IP: redo B4. Check `systemctl status lomu`, `journalctl -u lomu -n 100`. |
| Songs start then stall, or never start | A proxy is buffering `/api/stream/`. Make sure the `location /api/stream/` block above is present. |
| Live sync between devices does not update | The `/api/sync/events` block is missing or buffered. |
| Search/play fails for every song | YouTube changed something. `cd web && npm update youtubei.js`, rebuild/redeploy. `node web/scripts/probe-full.mjs <videoId>` shows which clients still download. |
| "needs setup code" but you forgot it | Path A: read the env var in Coolify. Path B: `cat /etc/lomu.env`. |
| Wrong region catalogue | Set `LOMU_REGION` (for example `IN`, `US`) and restart. |

Useful commands (Path B): `systemctl status lomu`, `journalctl -u lomu -f`,
`ls -la /var/lib/lomu`.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `LOMU_DATA_DIR` | `~/.lomu` (`/data` in the image, `/var/lib/lomu` in the unit) | where `lomu.db` lives |
| `LOMU_CACHE_DIR` | OS temp (`/cache` in the image) | YouTube session cache |
| `LOMU_SECURE_COOKIES` | off (`1` in the image and unit) | send the login cookie only over HTTPS |
| `LOMU_SETUP_CODE` | unset | required to create the owner account |
| `LOMU_REGION` | `IN` | YouTube catalogue region |
