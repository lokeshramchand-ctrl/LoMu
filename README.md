# LoMu

A self-hosted music player for YouTube Music. You run one small server, and your Android phone, your browser and your Windows PC all share the same library, history, playlists and recommendations. No ads, no subscription, and your listening data stays in one SQLite file you own.

LoMu is made of three parts that talk to the same server:

| Part | What it is | Folder |
|---|---|---|
| Server and web player | Next.js app with the API, the sync server and the browser UI | `web/` |
| Android app | Kotlin and Jetpack Compose player built on Media3 | `app/`, `innertube/` |
| Windows app | Electron shell that bundles its own copy of the server, so it keeps working when your home server is off | `desktop/` |

## Features

- **Search and browse** the YouTube Music catalogue: home, explore, moods, albums, artists, playlists, radio and synced lyrics.
- **Playback** with whole-file streaming, seeking, queue, crossfade, an equalizer on Android, a sleep timer and background playback.
- **Your own accounts.** The first account is the owner. The owner can add guests (4 accounts by default), and each account keeps its own library and history.
- **Sync across devices.** Likes, history and playlists live in a document log on the server with last-write-wins merging. Clients stay current over server-sent events.
- **LoMu Connect.** See your other signed-in devices and control what they play, from any device.
- **Recommendations.** Daily mixes, time-of-day mixes, Discover Weekly, "because you played", and a yearly Wrapped. They are built on the server from your play, skip and like signals, using YouTube radio results as candidates. An optional OpenAI-compatible model can add AI picks.
- **Bring your history.** Import a YouTube Music library, a Google Takeout archive or a Spotify export.
- **Offline-friendly.** The desktop app caches catalogue answers and the songs you really listen to, and queues edits until the home server is back.

## How it fits together

```
 Android app ─┐
 Browser ─────┼──►  LoMu server (Next.js + node:sqlite)  ──►  YouTube Music
 Windows app ─┘      accounts · sync · recommendations        (youtubei.js / InnerTube)
   └ own local copy of the server, syncs with the home server in the background
```

- The server keeps everything in one SQLite file (`lomu.db`). Back that file up and you have backed up the whole system.
- Auth is a username and password stored with scrypt, short-lived JWT access tokens and rotating refresh tokens.
- Audio is streamed through the server with range support, so clients never talk to YouTube directly.

## Run the server

Requirements: Node.js 24 or newer (the server uses the built-in `node:sqlite`).

```bash
cd web
npm install
npm run dev            # http://localhost:4100
```

Open the page and create the owner account. For a real deployment build once and start:

```bash
npm run build
npm start              # listens on 0.0.0.0:4100
```

### Docker

`web/Dockerfile` builds a standalone image that runs as a non-root user and stores data in `/data`. The image sets `LOMU_SECURE_COOKIES=1`, so serve it over HTTPS, or add `-e LOMU_SECURE_COOKIES=0` to try it over plain HTTP.

```bash
docker build -t lomu web
docker run -d -p 4100:4100 -v lomu-data:/data -e LOMU_SETUP_CODE=pick-a-secret lomu
```

### Linux server without Docker

`deploy/install.sh` installs LoMu into a fresh Debian or Ubuntu machine as a systemd service (`deploy/lomu.service`). `deploy/nginx-lomu.conf` is a reverse proxy site for it with the settings audio streaming and live events need (no buffering, long timeouts). Put the server behind HTTPS and set `LOMU_SECURE_COOKIES=1`.

```bash
REPO=<git url of this repo> bash deploy/install.sh
```

Re-run the same command to update.

### Configuration

All settings are environment variables.

| Variable | Default | Meaning |
|---|---|---|
| `LOMU_DATA_DIR` | `~/.lomu` | Where `lomu.db` lives |
| `LOMU_CACHE_DIR` | OS temp | youtubei.js cache |
| `LOMU_SETUP_CODE` | unset | Code required to create the owner account, so nobody who finds the URL first can claim it |
| `LOMU_SECURE_COOKIES` | off | Set to `1` behind HTTPS |
| `LOMU_MAX_USERS` | `4` | Accounts allowed (owner plus guests) |
| `LOMU_MAX_DOCS` | `300000` | Per-account row ceiling |
| `LOMU_PROXY_HOPS` | `1` | Reverse proxies in front of the app, used by the sign-in rate limit |
| `LOMU_REGION` | `IN` | YouTube catalogue region |
| `LOMU_LAN_ADDRESS` | unset | Comma-separated private addresses of the server, advertised to signed-in clients as a way in from inside your network |
| `LOMU_AUDIO_CACHE_MB` | `2048` | Size of the on-disk audio cache (desktop app) |
| `LOMU_AI_URL`, `LOMU_AI_KEY`, `LOMU_AI_MODEL` | unset | Optional OpenAI-compatible endpoint (`/v1/chat/completions`) for AI recommendations |

## Android app

Requirements: JDK 21 and the Android SDK (compile SDK 37, min SDK 26).

```bash
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The app asks for your server address on the sign-in screen. To change the address it starts with, set it in `local.properties` or in the environment before building:

```properties
MUSIC_SERVER_URL=https://music.example.com
```

The app only allows plain HTTP to the example addresses in `app/src/main/res/xml/network_security_config.xml`. Replace them with your own server's LAN address if you use the home network fallback; everything else must be HTTPS.

Unit tests: `./gradlew :app:testDebugUnitTest :innertube:testDebugUnitTest`. `app/smoke-test.sh` installs a build on a connected device and fails if it crashes on launch.

## Windows app

```bash
cd desktop
npm install
npm run dev      # run against an existing web build
npm run pack     # unpacked app in dist/win-unpacked
npm run dist     # installer in dist/
```

The Electron window starts its own copy of the server on a free `127.0.0.1` port and authenticates with a per-launch secret, so there is no login screen. Data lives in `%APPDATA%\LoMu`. In Settings you can point it at your home server to sync in the background. The installed app updates itself from GitHub Releases through `electron-updater`.

## Tests

```bash
cd web
npm run typecheck
npm test               # vitest unit tests
npm run e2e            # Playwright end-to-end tests
```

The `web-audit` workflow also builds the app on a throwaway data directory and runs a black-box audit (account isolation, auth, body limits, live streams, security headers, concurrency).

## Repository layout

```
web/        Next.js server and web player (src/server, src/app/api, src/player, src/components)
app/        Android app (Compose UI, Room database, Media3 playback, sync client)
innertube/  Kotlin client for the YouTube Music API
desktop/    Electron shell for Windows
deploy/     install script, systemd unit, nginx site
scripts/    helper scripts for icon generation and phone updates
```

## Contributing

Issues and pull requests are welcome. Please keep changes focused, add or update tests for behavior you change, and make sure `npm run typecheck` and `npm test` pass in `web/` before opening a pull request. Do not commit personal data such as listening-history exports, keystores or `.env` files.

## Disclaimer

LoMu is not affiliated with or endorsed by Google, YouTube or Spotify. It reads YouTube Music through unofficial interfaces, which can change or stop working without notice, and using it may be against the terms of service of those platforms. Use it for your own library and at your own risk.

## License

GPL-3.0, see [LICENSE](LICENSE). The Android app started as a fork of BeatWave, which is also GPL-3.0.
