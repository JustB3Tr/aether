# Aether 5.0.0
A graphite, teal, and violet home for browser games, useful apps, three web proxy engines, and a quiet Focus workspace.

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
The preview uses disposable data under `.Codex/audit-v5-userdata`. Choose a persistent directory for real use. No API keys or account setup are needed.
Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` in the shell. Outbound certificate validation in the Rammerhead dependency has a separate documented limitation.

## Build and run Docker
```powershell
docker build --platform linux/amd64 -t aether:5.0.0 .
docker run -d --name aether-v5-preview --restart unless-stopped -p 127.0.0.1:15001:3000 -v aether-v5-preview-data:/app/userdata aether:5.0.0
```
Open [Docker preview](http://127.0.0.1:15001/). Inspect startup with `docker logs aether-v5-preview`.
For a LAN deployment, publish `3000:3000` and preserve your existing userdata mount when replacing the container.
The server listens on all container interfaces. There is no built-in login; profiles use private bearer keys. Put authenticated HTTPS access in front of an Internet deployment.

## What is included
- 202 catalog entries: 16 original local games and 186 remote entries, including two portals and two join-code companions.
- Original games with keyboard/touch controls, personal bests, pause, restart, and optional sound.
- Search, categories, favorites, recent history, incremental library loading, and a keyboard command palette.
- In-page game/browser launches by default; optional separate tabs still open through the Aether shell.
- Ultraviolet, Scramjet with Libcurl/Wisp, and Rammerhead.
- Focus timer, notes, tasks, motion preferences, and profile backup/restore.
- Public temporary party rooms with chat and shared game/score cards. Sharing a game does not add multiplayer to a single-player title.

Remote sites can change or block embedding/proxying. Source reachability checks are not proof that every remote game works. Only Aether Originals implement Aether's profile save bridge; ordinary third-party games keep their own storage. Direct external games use credentialless frames where supported, so their storage is temporary and they do not receive your browser cookies. Use a proxy fallback in browsers that cannot embed them this way.

## Environment
| Variable | Default | Meaning |
|---|---|---|
| PORT | 3000 | HTTP/WebSocket port |
| USERS_DIR | ./userdata | Profile JSON files and persistent Rammerhead sessions |
| RAMMERHEAD_SESSIONS_DIR | USERS_DIR/rammerhead-sessions | Optional separate session directory |

Existing v4 profiles are read in place; encoded favorites and repaired catalog URLs are normalized by the v5 client. Back up userdata before an upgrade. Old Rammerhead sessions formerly stored inside node_modules are not automatically moved.

## Export
```powershell
New-Item -ItemType Directory -Force -Path outputs\v5.0.0
docker save --output outputs\v5.0.0\aether-image-linux-amd64.tar aether:5.0.0
python tools/archive-image.py outputs/v5.0.0/aether-image-linux-amd64.tar --tag aether:5.0.0
```
This exports a real image, not a build context. See [build/deployment](BUILD-AND-DEPLOY.md) for transfer and rollback steps.

## Source map
- `server.js`: static assets, profile API, catalog/artwork cache, proxy routes, party WebSockets.
- `public/index.html`, `styles.css`, `app.js`: application shell, visual system, controller.
- `public/arcade/`: 16 local games, shared runtime, and original SVG cover art.
- `public/uv/`: Ultraviolet worker configuration; Scramjet worker and package assets are served by `server.js`.
- `data/games.json`: combined game and app catalog.
- `userdata/`: runtime data, excluded from Docker builds.
- `design/`: generated source brand artwork; production copies live in public/assets.
- `.Codex/audit-tmp/`: final audit evidence, excluded from images.

## Documentation
[Game sources](docs/GAME-SOURCES.md) · [Arcade](docs/ARCADE.md) · [Performance](docs/PERFORMANCE.md) · [Brand](docs/BRAND.md) · [Restart updates](docs/AUTO-UPDATES.md)

## Local checks
```powershell
node --check server.js
node --check public/app.js
node --test public/arcade/tests/core.test.mjs
node tools/measure-transfer.mjs http://127.0.0.1:15000
```
The rule checks cover nine suites; browser journeys, touch layout, profile persistence, and proxy compatibility need separate live checks. Final evidence is recorded in `.Codex/audit-tmp/` and the release validation document.

## Restart updates
A separate host supervisor checks stable GitHub releases at container startup and NAS boot. It verifies the Linux AMD64 image and backs up userdata before replacement, with health checks and rollback. See [automatic updates](docs/AUTO-UPDATES.md). The Focus timer is device state; notes, tasks, favorites and settings belong to your profile.

[Completed audit](docs/audit/AUDIT.md) · [Ranked follow-up plan](docs/audit/IMPROVEMENT_PLAN.md) · [Visionary ideas](idea-log.md)
