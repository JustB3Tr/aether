# Aether: next full audit and visionary brief

## Current handoff, 2026-10-10

The local source/image is now **5.4.0**. Read [5.4 release notes](RELEASE-5.4.0.md) and the current [README](../README.md) before using the historical brief below. Local Docker previews are at ports 15007 and 15008, with 228 games, 23 Originals and 41 apps. The completed checks are 59 JavaScript tests, 30 mocked updater tests, real local proxy journeys for all engines/both Scramjet transports, and the new game smoke checks documented in the release notes. The local image archive is ready, but 5.4 has not been published or deployed; production Cloudflare Access configuration remains required. Refresh actual NAS/provider state rather than treating the old 5.1 deployment snapshot below as current. This notice does not constitute a fresh independent audit or visionary session.

Prepared on 2026-10-09 for the **next turn**. This is a handoff, not an audit, a new visionary session, or an implementation plan approved for execution. No application changes, browser checks, tests, NAS actions, or skill exercise were performed while preparing this document.

## 1. Release status and evidence gate

The current release is **Aether 5.1.0**, a visual overhaul of all eight main pages. The release owner completed the local image build, publication, and real restart-triggered NAS upgrade on 2026-10-10 UTC / 2026-10-09 Pacific. The table below records deployment-owner evidence, not an independent clean-room audit verdict. Refresh live state when the next pass starts.

| Final v5.1 field | Release-owner evidence |
| --- | --- |
| Source commit / release tag target | `1c10141a8e98969b569d9f4842fc9ae990617718` / `v5.1.0` |
| Docker tag / platform | `aether:5.1.0` / `linux/amd64` |
| Image config ID / version label | `sha256:0c43c4947cd803d4a65940c40236fa836caf6b4d3633055729e47b880bd04ab1` / `5.1.0`, matching NAS |
| Saved gzip bytes / SHA-256 | 81,704,057 / `9e1020e5178588503916e6965938e0dd79773a9c383a2d99503bc7a780a77e47` |
| Local image startup / source-to-image agreement | Healthy; 117 shipped files match current workspace; ten HTTP readbacks and initialized Original launch |
| Public GitHub release asset identities | Stable release archive asset `626697180`, manifest `626697179`, SHA file `626697177`; provider archive digest matches |
| NAS installed image / `/health.version` | Matching config ID, `aether:5.1.0`, running/healthy, health `5.1.0` |
| Preserved `aether-data` / rollback snapshot | Existing volume; all three persistent files match stopped-write snapshot; backup container `aether-backup-20261010T014224846043Z` retained |
| HTTPS frontend and actual proxy content | New Home; deployed Enter launches actual UV destination inside shell, no recorded console error; other full proxy journeys pending fresh audit |
| Restart watcher log / replacement outcome | Download 01:42:17, install 01:42:27 UTC; actual 5.0.0 to 5.1.0 replacement, no failed version |
| v5.1 UI journeys independently exercised | Not established by this brief |

The current release is documented in [DEPLOYMENT.md](DEPLOYMENT.md) and `outputs/v5.1.0/`. Historical [v5.0 deployment](DEPLOYMENT-5.0.0.md) and `outputs/v5.0.0/` do not establish fresh v5.1 results. The prior audit is [audit/AUDIT.md](audit/AUDIT.md); its report cutoff and owner-attributed results are explicit. Do not copy its passing counts into a fresh audit as new work.

## 2. Verified source and run context

- Working source: **`C:\projects\proxy\aether-build`**. Do not modify the older sibling checkout.
- Repository: [JustB3Tr/aether](https://github.com/JustB3Tr/aether), branch `main`. Record the actual current HEAD and dirty status when the next pass begins.
- Public app: [aether.thetrademaster.trade](https://aether.thetrademaster.trade/). Public HTTPS and a local source preview are different targets; record which one each observation uses.
- Native application: Node.js ES modules, Express, `ws`, HTML/CSS/JavaScript. `package.json` starts `node server.js`; the Docker base is Node 22 Alpine.
- No account/API-key setup is required for a source preview. There is **no built-in account authentication**. Profile UUIDs are bearer capabilities.

### Start from the current README

The auditor must read the final [README](../README.md) first and use its documented command, environment, and port exactly. At preparation, its run block is:

```powershell
Set-Location -LiteralPath 'C:\projects\proxy\aether-build'
npm ci
$env:PORT = '15000'
$env:USERS_DIR = Join-Path (Get-Location) '.Codex\audit-v5-userdata'
npm start
```

Open `http://127.0.0.1:15000/` and `/health`. The README path is disposable preview data, not the NAS volume. Do not point a test process at production userdata. If the documented port is already owned by a preview, identify its process, version, and directory before deciding whether to reuse it; do not kill every Node process or silently invent startup flags. If the README is missing/ambiguous or the documented startup fails, the auditor skill requires a clear user request for the missing information.

At this turn's handoff, the documented source preview remains on port 15000 with v5.1.0 and disposable data. An additional actual-image preview is `aether-v51-preview`, `http://127.0.0.1:15002/`, volume `aether-v51-preview-data`; it is healthy. These are live-state hints to verify again. The README's generic Docker example uses port 15001 and may encounter an older preview, so do not infer its version from its name. Private current captures are `.Codex/design-v51/screenshots/`; release-owner readbacks are `outputs/v5.1.0/`.

Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`. The existing local preview bootstrap explicitly removes that inherited variable before starting its child. This does not resolve RH's separate internal certificate-validation finding.

### Docker and host contract

Prospective v5.1 commands, to be checked against the final README and release notes:

```powershell
docker build --platform linux/amd64 --build-arg AETHER_VERSION=5.1.0 -t aether:5.1.0 .
docker save --output outputs\v5.1.0\aether-image-linux-amd64.tar aether:5.1.0
python tools/archive-image.py outputs/v5.1.0/aether-image-linux-amd64.tar --tag aether:5.1.0
```

Builds are local. `tools/release.ps1` creates a public release and uploads a genuine `docker save` archive plus `IMAGE-MANIFEST.json` and a SHA-256 file. The optional GitHub Actions workflow is manual, not a push-triggered build. A source checkout or build-context ZIP is not a Docker image.

The installed NAS contract before the v5.1 replacement is container `aether`, port `3000:3000` on host interfaces, default Docker bridge, `unless-stopped`, and **`aether-data:/app/userdata`**. Durable profile files and RH sessions share that mount. Party rooms are temporary memory state and reset on replacement. Verify the actual contract after deployment; do not remove, overwrite, or prune the data volume or retained rollback material to make an audit easier.

The root host supervisor lives at `/mnt/tank/apps/aether-updater`, outside the web container, with private configuration/state and a TrueNAS Post Init bootstrap. It observes application start events, checks newer stable GitHub releases, validates size/SHA/platform/config ID/version, preflights with disposable data, snapshots while stopped, preserves the managed configuration, and retains the old container for health rollback. The web container receives no Docker socket or GitHub credential. See [AUTO-UPDATES.md](AUTO-UPDATES.md) for exact limits and recovery rules.

Read-only operational checks, when host access is explicitly available in that turn:

```sh
sudo docker inspect aether
curl -fsS http://127.0.0.1:3000/health
sudo tail -n 40 /mnt/tank/apps/aether-updater/updater.log
```

A real restart/replacement is consequential. Do not force a fake newer public release, production rollback, NAS reboot, TLS failure, or destructive profile test merely to close an audit checkbox. Any future host experiment needs a disposable deployment or the user's concrete authorization and recovery plan. Hash agreement authenticates agreement with the publisher, not safety against a compromised release publisher.

## 3. Current implementation map

| Source | Responsibility |
| --- | --- |
| `public/index.html` | Integrated eight-page shell, SVG symbols, shared viewer, command palette, file input |
| `public/styles.css` | Original shared baseline and controller-rendered elements |
| `public/experience.css`, `public/experience.js` | New shell/motion layer, route/settings events, fine-pointer depth and section reveals |
| `public/discovery.css` | Home, Games, Apps editorial surfaces |
| `public/spaces.css` | Focus observatory, Party rendezvous and room surfaces |
| `public/utility.css` | Browser gateway, Profile passport/vault, Settings and appearance preview |
| `public/app.js` | Routes, filters/cards, metadata queue, profile CRUD, viewer/proxy launch, timer, Party protocol |
| `public/arcade/` | Sixteen Originals, shared runtime/rules/controls, covers and checked save bridge |
| `server.js` | Static compression/cache handling, catalog/artwork, atomic profile files, HTTP/proxy/WS dispatch, rooms |
| `data/games.json` | Combined game and app catalog; no separate `data/apps.json` |
| `public/uv/` and served package assets | Worker configuration and lazy engine runtime; Scramjet worker is generated by the server |
| `tools/aether-updater.py`, bootstrap, release/archive helpers | Private host supervision and local release tooling |

The staged `.Codex/design-v51/*.html` fragments explain design ownership, but **the integrated `public/index.html` and final shipped files are the runtime truth**. Read them both where needed; do not audit a fragment that the running app never received.

### Eight pages and their actual entry points

| Route | v5.1 identity | Flows to exercise |
| --- | --- | --- |
| `/#home` | Editorial portal, original-feature deck, crossroads, personal rails | Explore; Surprise; featured launches; Originals shortcut; recents/favorites; return from viewer |
| `/#games` | Feature stage plus full collection | Search; category; local filter; favorites; sort; empty/reset; incremental 48-card loading; cover/title launches |
| `/#apps` | Creator/music spotlights and useful-tool shelf | Featured app IDs; quick tools; search/categories/favorites; remote access/account notes; viewer return |
| `/#focus` | Observatory timer, field notes, next steps, rewards | Start/pause/reset; focus/break; session length; task Enter/check/delete; notes; reward launches; timer navigation |
| `/#multiplayer` | Rendezvous, real room entry/directory, shared chat panel | Two-browser create/join; member changes; chat Enter; copy; game/score sharing; leave confirmation; disconnect/error/empty states |
| `/#proxies` | Globe gateway and three route cards | URL/search Enter in UV/Scramjet/RH; default same-page viewer; new-tab checkbox; engine identity; recovery and toolbar |
| `/#profile` | Personal passport, backups, profile import and save vault | Mask/show/hide/copy; download/restore file; key import; saved groups/delete; privacy and unsupported remote-save copy |
| `/#settings` | Three preference groups, live CSS preview, shortcuts/data controls | Motion/density; separate tabs; initial Focus; leave confirmation; session length; preview response; backup/history; separate deletion action |

Additional distinct surfaces: shared viewer and loading/recovery state; command palette; native popup/download/upload/confirmation paths; standalone and embedded Originals; game-specific controls/results; connection/error notices; public Party directory versus joined room; launch links that request an entry on a fresh shell load.

Launch-link contracts currently use `aether_game=<catalog-id>` and optional `aether_proxy=uv|scramjet|rammer`, or `aether_proxy=<engine>&aether_url=<URL>`. They launch inside the new Aether shell and then remove consumed parameters. These need actual new-tab evidence, not merely inspection of URL generation.

Original route IDs: `snake`, `merge`, `breakout`, `mines`, `memory`, `tictactoe`, `connect4`, `slide`, `simon`, `reaction`, `color`, `scramble`, `lights`, `dodge`, `orbit`, `sudoku`. Standalone entry: `/arcade/index.html?game=<id>`; catalog launches use `aether-<id>` through the main viewer. See [ARCADE.md](ARCADE.md) for each control/rule contract.

### Durable and temporary state

- Profile: supported Original stats, favorites, recents, notes, tasks and settings in atomic server JSON plus profile-scoped device cache/retry journals.
- Original bridge: checked frame source/origin, key ownership, `gp-ready`/`gp-init`/`gp-save` and server acknowledgement. Stats are client convenience records, not verified competitive results or resumable board state.
- Focus timer: device state. Do not claim it synchronizes between browsers like profile notes.
- Third-party games/apps: their own storage and compatibility; only Originals implement Aether's save bridge. Credentialless direct frames have temporary third-party storage where supported.
- RH: fresh session per launch, persistent server-side session files. Other proxy workers/transports have their own scope and loading lifecycle.
- Party: bounded, public, temporary room/chat state over `/ws`; sharing a single-player game does not create multiplayer.

API inventory to trace: `/health`, `GET /api/games`, `GET /api/artwork`, `GET /api/user`, `POST /api/save`, `POST /api/save-batch`, `GET /api/load/:key`, `DELETE /api/save/:key`, `GET /api/saves-by-game`, `DELETE /api/saves-by-game/:host`, `DELETE /api/user`, `POST /api/import`, `GET /api/rooms`, Party `/ws`, and the separate Bare/Wisp/RH HTTP/upgrade routes. Include generated workers, runtime RH adapter, static HEAD/ETag/compression and error middleware.

## 4. Prior unresolved findings to revalidate

These are prior findings, **not a fresh vulnerability report**. Make first-pass current observations before using the old audit as a comparison. The visual overhaul does not constitute a security fix.

| Prior finding | What the next pass must establish |
| --- | --- |
| **H1: public proxy/profile trust boundary** | Actual deployed access gate, origin separation, bearer-key exposure, general HTTP/WS egress and resource policy. Same-origin proxied content plus script/same-origin iframe permissions are not an independent boundary. API Origin checks do not gate all transports. Prior audit inferred architecture risk, not a demonstrated theft exploit. |
| **H2: RH destination TLS validation disabled** | Installed Hammerhead request options/agent still set `rejectUnauthorized: false`, or a maintained correction has landed. Shell TLS environment cleanup alone does not fix it. Valid/invalid certificate behavior requires a controlled test target. |
| **H3: vulnerable dependency graph** | Reinstall from current lockfile and map advisories to reachable paths. Prior report: eight vulnerable nodes, six high/two moderate, largely RH chains; no claim of eight distinct proven exploits. Do not blindly force upgrades. |
| **M1: iframe load mistaken for successful destination** | Reproduce or precisely label inference: loaded engine error HTML can hide timeout recovery. Verify retry/alternate-engine/return availability after document load; cross-origin DOM inspection has limits. |
| **L1: Focus toggle accessible state** | Recheck its name/pressed state across all routes and actual next action. |
| **L2: explicit reduced motion ends at shell** | Recheck whether the selected app preference reaches Original decorative UI. Meaningful game motion remains part of rules; canvas descriptions are not equivalent screen-reader gameplay. |
| **L3: updater retention grows without bounds** | Current backup/container/image/log retention and preflight free-space policy. Preserve a working rollback; no unsolicited pruning. |
| **L4: stale source-map paths** | Previously corrected README paths must remain accurate after adding the four CSS layers and motion JS. |

Prior corrected areas still deserve regression checks: atomic concurrent saves, scoped offline journal adoption/replay, stale acknowledgements, large backup caps, unsupported save notices, exact frame message validation, route scroll reset, accessible tablet controls, RH callable storage listeners and compressed/HEAD/304 adapter responses.

## 5. Clean-room app-auditor process for the next turn

1. Invoke the named **app-auditor** skill explicitly and read its complete file. Give the reviewer fresh current-source context, not the implementation team's praise or passing claims. A clean-room subagent can start without inherited history. This handoff is navigation, not a desired verdict.
2. Read the final README and start exactly as documented. Identify current commit, served version, asset cache keys, data directory and target URL. Preserve old evidence before making a new audit evidence directory; never represent old screenshots as new.
3. Trace every first-party file/config/route/util, skipping generated/vendor/lockfile bulk as directed by the skill. Follow controller listeners through API/state persistence and WS/proxy dispatch. Trace new motion/style interactions, not only attractive hero markup.
4. Load every page through actual navigation and direct hash entry. Capture **and inspect** desktop, true 390px mobile and a tablet navigation breakpoint, including content below the fold. Record real viewport dimensions, zoom and browser. Check overflow, text contrast, focus visibility, targets, overlapping sticky controls, safe areas and readable labels. Restore all browser emulation when done.
5. Map shell/API/disk, device journal, iframe bridge, third-party proxies, Party state, and private host updater boundaries. Produce Mermaid and a rendered diagram in the local audit workspace.
6. Walk real journeys with mouse, keyboard and applicable touch. Confirm UI outcomes and meaningful content, not just an HTTP 200, an iframe `load`, a nonempty canvas or a screenshot of an unclicked form.
7. Rank issues by impact, then write `AUDIT.md` and `IMPROVEMENT_PLAN.md` under `.Codex/audit-tmp/`, with exact file/route references, observed/inferred status, evidence, limitations and concrete acceptance steps. Preserve private captures locally; sanitize any separately published copy.
8. The audit skill's reporting phase does not implement fixes. Present the plan for the user's decision. The visionary exercise also does not write application code. Do not turn either skill into an unreviewed production rewrite.

### Required real-user verification matrix

| Area | Required current evidence |
| --- | --- |
| Navigation | Every page, tablet/phone labels, browser back/forward, direct hash, viewer return, no retained scroll traps, palette and focus restoration |
| Motion | Full, explicit reduced, device-reduced, preference change during active animation, hidden tab/route; no content waiting invisibly for a reveal callback; report measured behavior rather than invented FPS |
| Library | Featured IDs exist; real launch from cover/title; search/chips/sort/local/favorite combinations; empty/reset; load more; recent/favorite reload and profile isolation |
| Browser | All three engines render real destination content over HTTPS/localhost; Enter search and URL; ordinary in-page launch; actual checked new-tab shell; browser-blocked popup; timeout/engine-error/frame-blocked state and return |
| Originals | Initialize all 16; representative actual keyboard/touch round, pause/restart/mute; completed win/loss and save acknowledgement; reload result; no stray handlers after relaunch; document unplayed mechanics |
| Focus | Real ticking start/pause/reset/mode/length, task Enter/check/delete and notes persistence, reload, delayed save failure/retry, change profile while a draft is pending |
| Party | Two real browser contexts create/join/chat/member updates/share/leave; key Enter paths; empty/invalid/full/disconnect behavior; public/temporary limitations; no claim that a shared single-player title became multiplayer |
| Profile | Actual masked/revealed/copy handling, backup download, native file chooser and restore, existing key import, unsupported save copy, group deletion on disposable data only; keep secrets out of screenshots/logs |
| Settings | Every select/toggle applies and survives reload; preview visibly changes spacing/motion; separate-tab and initial Focus behavior; history clearing; destructive action cancellation and isolated-data completion |
| API/files | Disposable profiles: concurrent/large/bounded payloads, invalid key/origin, failed write and corruption preservation; persistence readback, not merely successful response |
| Image/deployment | Final source/image identity, health/version, persistent volume contract, actual current NAS frontend, restart survival and observer log; separate local source, local Docker, LAN and public HTTPS findings |

Tests and native UI journeys are authorized by the next audit request when it begins. This brief does not run them. If a tool stalls or an upload/dialog/popup cannot be operated, state **unverified** and preserve the exact limitation; a VM controller test is useful but is not a substitute for a native browser journey. Avoid destructive checks against real user profiles or chat rooms.

### Evidence language

- **Observed now:** reviewer completed the exact operation on the identified current target and records its result.
- **Reproduced by a harness:** name the current-source/image test, assertions and isolation. Mocked Docker is not a production rollback.
- **Source-inferred:** explain the code path and consequence without claiming an exploit or user failure was reproduced.
- **Deployment-owner evidence:** attribute current image/host results when the reviewer did not independently repeat them.
- **Historical:** prior v5.0 result, screenshot or test, retained as baseline only.
- **Unverified:** unavailable interaction, unplayed remote title, unchecked device, future upgrade path or incomplete scenario.

A reported catalog size is not a count of completed game sessions. A loaded target is not proof of login, gameplay, durable third-party saves or universal compatibility. Archive SHA agreement, upload metadata, provider digest and a downloaded-file SHA are different evidence levels.

## 6. Ambitious app-visionary scope for the next turn

Read the complete **app-visionary** skill and **`idea-log.md` before dreaming**. The first session already explored and placed these nine branches: Orbit Runs, Constellation friend rooms, Remix Studio, mood journeys, Focus rituals, Travel Shelf/offline collection, device pairing/continuity, web workspaces, ghost replays/spectator nights. Do not rebrand them as new inventions or repeat the same top three. Revisit an old branch only with a clearly identified new user insight, tradeoff or product mechanism.

Also preserve the prior explicit rejections: forced productivity gates, an AI that plays for the person, a default public global feed, a universal score scale across unrelated remote games, and required animated 3D navigation. The v5.1 page art, editorial featured cards, passport, appearance preview and motion layer are already present. Proposing those again is not a new visionary outcome.

### Fresh investigation boundaries

- Begin with actual v5.1 first-time journeys at all eight pages, plus viewer and Originals. Write what the person can truly do today before expanding it two years forward.
- Explore product directions beyond “a larger link shelf” or “add more glow.” Ask which meaningful new capability makes the experience worth telling a friend about, and what personal value it adds without becoming a compulsory social network.
- Seek unexplored angles around access for different abilities/input styles, the pleasure of understanding a mechanic, creative expression beyond level editing, physical/shared-screen contexts, and deliberate collection stewardship. These are exploration prompts, not preselected features or a second idea session hidden in this handoff.
- Consider bold branches as well as buildable ones. Do not reduce the exercise to security fixes, CSS polish, dependency upgrades or generic recommendation sorting; those belong to the audit or already explored branches.
- For every candidate, place it in actual current screens/controllers/game contracts/API/storage boundaries, explain a concrete before/after for the user, what changes elsewhere, and what it unlocks next. Do not imply that third-party websites expose APIs, allow redistribution, accept shared cookies or support Aether-owned save state.
- Produce coherent product stories rather than a disconnected wish list. Pick three genuinely differentiated ideas only after exploration, with why they win and one-sentence build shape.
- Append the next session to `idea-log.md`, distinguishing new exploration, selected/rejected ideas and open threads. No app implementation during the skill exercise.

Keep the graphite, teal and violet identity and quick access to real controls as constraints. A spectacular page must remain usable with reduced motion, small screens, keyboard access and failed network calls. Treat “jaw dropping” as a design ambition, not evidence that every page or flow has been verified.

## 7. Handoff integrity

This document contains no passwords, tokens, private profile keys, SSH credentials or embedded private screenshots. Keep production credentials in the existing authorized host environment. Publish only sanitized reports after reviewing screenshots, logs, profile URLs and chat content for private data.

Before beginning the next turn, refresh section 1 from the release owner's final v5.1 evidence and re-read any README/run-guide edits made after this brief. Finish the current deployment first. Then perform the large, independent audit and visionary passes as the next requested work.
