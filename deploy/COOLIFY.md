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
   - `LOMU_LAN_ADDRESS` = `192.168.1.20` (optional, recommended): the server's address on the home
     network (the Proxmox host that runs nginx). Signed-in clients learn it and use it when the
     public name does not work from inside the LAN (see "Same network as the server" below).
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
has to come back in from the internet. (WARP excludes `192.168.0.0/16`, so the private address
is always reachable directly.)

The server answers on its private address with the same certificate, so the clients use that
when the name fails. Set `LOMU_LAN_ADDRESS` (above); then:

- **Desktop app:** learns the address after sign-in (Settings → Home server also has a field
  for it). It tries the name first and the home address second, and switches to the home address
  first once that is the one that works ("via home network" shows in the card).
- **Phone:** learns it at sign-in (and on a later sync for older installs). At home, on the
  same subnet, it goes straight to the private address; away from home it uses the name.
- **Browser:** a browser cannot be told this. At home open `https://lomu.example.com`
  with a hosts entry or router DNS override: `192.168.1.20  lomu.example.com` (also
  fixes it for every device on the network at once if set as a local DNS record on the router
  or in dnsmasq on the Proxmox host).
