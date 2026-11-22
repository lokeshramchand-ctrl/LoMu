# Deploying LoMu on Coolify (CT 136, coolify.example.com)

Apps go on `*.example.com` (see HOMELAB.md). Coolify's Traefik terminates TLS, so
the container only speaks HTTP on port 4100.

1. **New resource → Public/Private Git repository** → this repo, branch `music`/`main`.
2. **Build Pack: Dockerfile**, **Base Directory: `/web`**, Dockerfile location `/Dockerfile`.
3. **Ports Exposes: `4100`**. **Domain:** `https://lomu.example.com`.
4. **Persistent Storage:** add a volume mounted at `/data` (holds `lomu.db`: back it up).
   Optional second volume at `/cache`.
5. **Environment variables** (Runtime only):
   - `LOMU_SETUP_CODE` = any random string. Required once to create the owner account;
     without it anyone who finds the URL could claim the app.
   - `LOMU_REGION` = `IN` (optional).
   - `LOMU_LAN_ADDRESS` = `192.168.1.10,192.168.1.20` (recommended): the server's addresses on the
     home network, in the order to try. `192.168.1.10` is the Coolify container itself;
     `192.168.1.20` is the Proxmox host (nginx), which any device on the Wi-Fi can reach. Signed-in
     clients learn the list and use it when the public name does not work from inside the LAN
     (see "Same network as the server" below).
   - `LOMU_MAX_USERS` = `4` (default). Seats on this server: the owner plus three guests.
   - `LOMU_PROXY_HOPS` = number of reverse proxies in front of the app (default `1`; nginx then
     Traefik is `2`). Only used to tell clients apart for the sign-in rate limit.
   - `LOMU_MAX_DOCS` = `300000` (default): per-account ceiling on stored library/history rows.
   - `LOMU_SECURE_COOKIES` is already `1` in the image (the site is HTTPS-only).
6. **Health check** is built into the image (`/api/auth/status`). In Coolify you can also
   set path `/api/auth/status`, port `4100`.
7. Deploy, open the domain, create the account (username, password ≥ 8 chars, setup code).
8. Add an Uptime Kuma HTTP check on `https://lomu.example.com/api/auth/status`.

Streaming: Traefik does not buffer, so `/api/stream/*` and `/api/sync/events` (SSE) work as is.
If playback fails for every song, YouTube changed something: bump `youtubei.js`, redeploy.
CT 136 was **stopped** at the last audit: start it first (`pct start 136`).

## Accounts

The first account created is the admin. Settings → Accounts (admin only) adds, pauses and
removes the others, up to `LOMU_MAX_USERS`. Every account has its own library, history,
recommendations, queue and devices; accounts never see each other's data, and removing an
account deletes everything it owned. Passwords: Settings → Account → Password (signs the other
devices out). Nobody can be added without the admin: the setup code only works while no
account exists.

## Same network as the server (WARP, "the domain does not work at home")

`lomu.example.com` resolves to the router's public address. From a device inside the
same network that path often fails: many routers cannot loop a connection back in (no NAT
loopback), and with Cloudflare WARP on, the connection is tunnelled out through Cloudflare and
has to come back in from the internet. WARP excludes `10.0.0.0/8` and `192.168.0.0/16`, so the
private addresses are reachable directly, and both serve the same valid certificate for the
domain (Traefik on `192.168.1.10:443`, nginx on `192.168.1.20:443`).

So at home the clients talk to a private address and still call the server by its public name
(TLS server name and Host header unchanged), which keeps certificate checking fully on.

| Device | How it gets there |
|---|---|
| Desktop app | Learns `LOMU_LAN_ADDRESS` after sign-in; Settings → Home server also has a field (comma separated). Tries the name, then each home address; remembers the one that worked and starts with it next time. |
| Phone | Learns the list at sign-in or the next sync, or type it in Settings → Home network. Probes the addresses for half a second and goes to the one that answers first; away from home the probe fails and it uses the public name. |
| Browser | Cannot be told. Use one hosts line (below). |

### Runbook (run these yourself)

**1. Tell the server its home addresses** (Coolify → LoMu → Environment Variables, runtime only):

```
LOMU_LAN_ADDRESS=192.168.1.10,192.168.1.20
```

then **Redeploy**. The container health check and Uptime Kuma can now use `GET /api/health`
(`{"ok":true,"db":"ok","version":"<commit>","accounts":N}`, 503 if the database fails).

**2. Check which routes work from each device** (any device with Node; read-only):

```
node web/scripts/check-network.mjs
```

It prints the public name and each home address with timing. From the PC the three routes all
answered with a valid certificate (2026-11-22): name 158 ms, 192.168.1.10 16 ms, 192.168.1.20 10 ms.

**3. Browsers at home** (PowerShell as Administrator; WARP can stay on):

```
Add-Content C:\Windows\System32\drivers\etc\hosts "192.168.1.10 lomu.example.com"
ipconfig /flushdns
```

Undo: delete that line from the hosts file. Use `192.168.1.20` instead on a device that has no
route to `10.10.10.0/24` (check: `Test-NetConnection 192.168.1.10 -Port 443`). Phones normally have
no such route, which is why the phone list also contains `192.168.1.20`.

**4. Optional: make `10.10.10.0/24` reachable from every device.** In the router, add a static
route `10.10.10.0/24` via `192.168.1.20` (the Proxmox host). On the Proxmox host confirm it forwards:

```
sysctl net.ipv4.ip_forward        # must print 1
```

Then phones and laptops can use `192.168.1.10` directly. Not required: `192.168.1.20` already works
for them.

**5. Monitoring.** Uptime Kuma: HTTP(s) check on `https://lomu.example.com/api/health`,
expect status 200 and keyword `"ok":true`.
