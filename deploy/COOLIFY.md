# Deploying LoMu on Coolify (CT 136, coolify.lokeshrc.me)

Apps go on `*.deploy-ui.lokeshrc.me` (see HOMELAB.md). Coolify's Traefik terminates TLS, so
the container only speaks HTTP on port 4100.

1. **New resource → Public/Private Git repository** → this repo, branch `music`/`main`.
2. **Build Pack: Dockerfile**, **Base Directory: `/web`**, Dockerfile location `/Dockerfile`.
3. **Ports Exposes: `4100`**. **Domain:** `https://lomu.deploy-ui.lokeshrc.me`.
4. **Persistent Storage:** add a volume mounted at `/data` (holds `lomu.db`: back it up).
   Optional second volume at `/cache`.
5. **Environment variables** (Runtime only):
   - `LOMU_SETUP_CODE` = any random string. Required once to create the owner account;
     without it anyone who finds the URL could claim the app.
   - `LOMU_REGION` = `IN` (optional).
   - `LOMU_SECURE_COOKIES` is already `1` in the image (the site is HTTPS-only).
6. **Health check** is built into the image (`/api/auth/status`). In Coolify you can also
   set path `/api/auth/status`, port `4100`.
7. Deploy, open the domain, create the account (username, password ≥ 8 chars, setup code).
8. Add an Uptime Kuma HTTP check on `https://lomu.deploy-ui.lokeshrc.me/api/auth/status`.

Streaming: Traefik does not buffer, so `/api/stream/*` and `/api/sync/events` (SSE) work as is.
If playback fails for every song, YouTube changed something: bump `youtubei.js`, redeploy.
CT 136 was **stopped** at the last audit: start it first (`pct start 136`).
