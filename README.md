# Aether 5.4.0
A graphite, teal, and violet home for browser games, useful apps, three web proxy engines, and a quiet Focus workspace. Production browser engines run on a separate Cloudflare Access protected origin.

## Requirements
- Node.js 22 LTS and npm for a source preview.
- Docker Desktop using Linux containers for a Linux AMD64 image.
- HTTPS or localhost for Ultraviolet and Scramjet service workers. Originals work over ordinary LAN HTTP.

## Run from source
Open PowerShell in this directory:
```powershell
npm ci
$env:PORT = '15000'
$env:USERS_DIR = Join-Path (Get-Location) '.Codex\audit-v5-userdata'
npm start
```
Open [Aether](http://127.0.0.1:15000/) and [health](http://127.0.0.1:15000/health). Stop with Ctrl+C.
The preview uses disposable data under `.Codex/audit-v5-userdata`. Choose a persistent directory for real use. No API keys or account setup are needed in local development.
Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` in the shell. The install hook applies a version-checked patch to restore Rammerhead destination certificate validation.

## Build and run Docker
```powershell
docker build --platform linux/amd64 --build-arg AETHER_VERSION=5.4.0 -t aether:5.4.0 .
docker run -d --name aether-v54-preview --restart unless-stopped -e NODE_ENV=development -p 127.0.0.1:15007:3000 -v aether-v54-preview-data:/app/userdata aether:5.4.0
```
Open [Docker preview](http://127.0.0.1:15007/). Inspect startup with `docker logs aether-v54-preview`.
The preview overrides the image's production default so it can run locally without Cloudflare. Keep it bound to loopback. The example assumes the container name and port are available. Identify an existing preview before replacing it, and preserve its data volume.

The production image starts in `NODE_ENV=production` and refuses to start without distinct HTTPS app and proxy origins plus Cloudflare Access audiences for both. Configure the existing Aether hostname and the isolated proxy hostname before deploying. Follow [security and origin setup](docs/SECURITY-AND-ORIGINS.md); do not expose a development-mode container to the Internet.

## What is included
- Eight distinct page designs: editorial Home and Games, a creator/music Apps shelf, Focus observatory, Party rendezvous, Browser gateway, Profile passport, and Settings with a live appearance preview.
- Self-hosted brand artwork and typography, responsive layouts, and motion preferences without additional runtime packages.
- 228 catalog entries: 23 original local games and 205 remote entries, including two portals and two join-code companions.
- 41 helpful apps, including browser based code, diagram, and image tools.
- Original games with keyboard/touch controls, personal bests, pause, restart, and optional sound. Driftline adds three ordered laps, tire slip, handbrake drifts and banked combos; Pulse Arena adds three weapons, five waves, Blink and a shrinking arena. Breachline and Overdrive remain available. All Original renderer families load only when selected.
- Search, categories, favorites, recent history, incremental library loading, and a keyboard command palette.
- In-page game/browser launches by default; optional separate tabs still open through the Aether shell. Remote launches also offer an explicit Original site link for editors or multiplayer games that need their own top-level page.
- Manual route selection between Direct site, Ultraviolet, either Scramjet transport, and Rammerhead. Loading help separates page receipt from working gameplay; only your explicit confirmation remembers a route on this browser for the exact catalog entry and URL. Aether never switches routes automatically.
- Ultraviolet, Scramjet with selectable Libcurl or Epoxy 3/Wisp, and Rammerhead. Production isolates their viewer, service workers, HTTP transports, and WebSocket routes from the shell and profile API.
- Focus timer, notes, tasks, motion preferences, and profile backup/restore.
- Public temporary party rooms with chat and shared game/score cards. Sharing a game does not add multiplayer to a single-player title.

Remote sites can change or block embedding/proxying. Source reachability checks are not proof that every remote game works. Realtime WebGL shooters now prefer direct launch because browser-native WebRTC peer traffic is not carried by Aether's HTTP proxy transport; a working HTML response still does not prove a match started. Only Aether Originals implement Aether's profile save bridge. Third-party storage remains on the isolated proxy origin or the game's own origin, not in the Aether profile. Direct external games use credentialless frames where supported, so their storage is temporary and they do not receive your browser cookies.

## Environment
| Variable | Default | Meaning |
|---|---|---|
| PORT | 3000 | HTTP/WebSocket port |
| USERS_DIR | ./userdata | Profile JSON files and persistent Rammerhead sessions |
| RAMMERHEAD_SESSIONS_DIR | USERS_DIR/rammerhead-sessions | Optional separate session directory |
| AETHER_APP_ORIGIN | none in local development | Exact HTTPS shell/profile origin; required in production |
| AETHER_PROXY_ORIGIN | none in local development | Distinct HTTPS proxy viewer/engine origin; required in production |
| AETHER_ACCESS_TEAM_DOMAIN | none in local development | Cloudflare Access team hostname, without scheme; required in production |
| AETHER_APP_ACCESS_AUDIENCE | none in local development | Audience tag from the app Access application |
| AETHER_PROXY_ACCESS_AUDIENCE | none in local development | Audience tag from the proxy Access application |

Existing v4 profiles are read in place; encoded favorites and repaired catalog URLs are normalized by the v5 client. Back up userdata before an upgrade. Old Rammerhead sessions formerly stored inside node_modules are not automatically moved.

## Export
```powershell
New-Item -ItemType Directory -Force -Path outputs\v5.4.0
docker save --output outputs\v5.4.0\aether-image-linux-amd64.tar aether:5.4.0
python tools/archive-image.py outputs/v5.4.0/aether-image-linux-amd64.tar --tag aether:5.4.0
```
This exports a real image, not a build context. See [build/deployment](BUILD-AND-DEPLOY.md) for transfer and rollback steps.

## Source map
- `server.js`: static assets, profile API, catalog/artwork cache, proxy routes, party WebSockets.
- `public/index.html`, `public/styles.css`, `public/app.js`: integrated shell, baseline visual system, controller.
- `public/experience.css`, `public/experience.js`: shared shell and optional motion layer.
- `public/discovery.css`, `public/spaces.css`, `public/utility.css`: page-specific compositions.
- `public/arcade/`: 23 local games, shared runtime, lazy family loader, and original SVG cover art.
- `public/launch-health.js`, `public/proxy-viewer.js`: remembered route rules and launch diagnostics for the shell and isolated viewer.
- `public/uv/`: Ultraviolet worker configuration; Scramjet worker and package assets are served by `server.js`.
- `data/games.json`: combined game and app catalog.
- `userdata/`: runtime data, excluded from Docker builds.
- `design/`: generated source brand artwork; production copies live in public/assets.
- `security/cloudflare-access.js`: production Cloudflare Access JWT validation.
- `.Codex/audit-tmp/`: local audit evidence, excluded from images.

## Documentation
[v5.4 build notes](docs/RELEASE-5.4.0.md) · [Previous v5.3 build notes](docs/RELEASE-5.3.0.md) · [Security and origins](docs/SECURITY-AND-ORIGINS.md) · [Game sources](docs/GAME-SOURCES.md) · [Arcade](docs/ARCADE.md) · [Performance](docs/PERFORMANCE.md) · [Brand](docs/BRAND.md) · [Restart updates](docs/AUTO-UPDATES.md)

## Local checks
```powershell
node --check server.js
node --check public/app.js
node --test public/arcade/tests/*.test.mjs public/tests/*.test.mjs
python tools/test-updater.py
node tools/measure-transfer.mjs http://127.0.0.1:15000
```
The v5.4 local run passed 59 JavaScript checks and 30 updater checks. JavaScript checks include Original rules and renderer fixtures, launcher/profile races, route persistence, and viewer message/timer behavior. Representative browser launches and phone layouts were also checked; full game wins, all remote games, and production Cloudflare Access remain separate checks. See [v5.4 build notes](docs/RELEASE-5.4.0.md) for exact evidence and limits. Historical v5.1 deployment evidence remains in [deployment validation](docs/DEPLOYMENT.md); it does not establish a v5.4 NAS deployment.

## Restart updates
A separate host supervisor checks stable GitHub releases at container startup and NAS boot. It verifies the Linux AMD64 image and backs up userdata before replacement, with health checks and rollback. See [automatic updates](docs/AUTO-UPDATES.md). The Focus timer is device state; notes, tasks, favorites and settings belong to your profile.

[Previous v5.0 audit](docs/audit/AUDIT.md) · [v5.2 implementation and follow-up plan](docs/PLAN-5.2.0.md) · [Visionary ideas](idea-log.md) · [Next audit brief](docs/NEXT-AUDIT-BRIEF.md)
