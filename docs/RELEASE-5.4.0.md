# Aether 5.4.0

Built locally on Windows using Docker Desktop's Linux AMD64 builder on 2026-10-10. This release adds two Originals and improves loading, launch diagnostics and navigation state. The catalog contains **228 games, including 23 local Originals and 205 remote entries, plus 41 apps**.

## New Originals

**Driftline** is a dockside circuit racer with three ordered clockwise laps, 90 seconds, lateral tire slip, a handbrake, banked drift combos, barrier penalties, five hull, cruise assist, a racing line and touch controls. Its checkpoint checks reject shortcuts. It caches the circuit drawing and bounds its trail and smoke collections.

**Pulse Arena** is a 90-second score attack with five waves, a shrinking ring, visible floor hazard warnings, Pulse/Scatter/Lance weapons, shield cells, a chain multiplier and Blink. Assisted aim and auto-fire start enabled. It has keyboard, mouse and touch controls, bounded entity/particle collections and an optional final core.

Both games use the existing local save bridge, pause/restart/sound controls, original SVG covers, reduced-motion preferences, a canvas DPR cap of two and 10 Hz DOM HUD updates. Both load only when selected.

## Loading and launch controls

- All Original renderer families now import lazily through `game-loader.js`; searchable metadata does not download every renderer.
- The initial arcade JavaScript bootstrap measured **8,421 gzip bytes**, down from 30,829 in the retained 5.3 container: **72.7% less**. This excludes the selected renderer, styles/fonts and remote resources, and does not establish a whole-page speed or frame-rate improvement.
- The catalog paints independently of the profile fetch. Favorites/history wait for hydration; local game preparation and profile controls wait for existing data before changing it.
- **Launch options and loading help** offers Direct site, Ultraviolet, Scramjet with Libcurl, Scramjet with Epoxy/Wisp, or Rammerhead. Route changes and new tabs require a user action. A separate Aether tab preserves the chosen engine and transport.
- Progress separates engine setup, navigation, receipt of a document and user-confirmed functionality. An iframe load is not reported as a working game or match.
- **This works · remember route** stores an exact catalog ID/URL route preference on the current browser/device. Preferences are bounded to 200 entries and are not profile-synced. Changed catalog URLs invalidate old preferences. An explicit route choice overrides the remembered default.
- Asset/worker/transport/Access errors and slow-page help offer retry, route selection, an original-site link or continued waiting. Script and engine timeouts clean up failed nodes; the navigation timeout starts after engine initialization.
- Per-launch correlation tokens reject stale viewer and local save/result packets. Tokens work on ordinary LAN HTTP and are not authentication credentials. Pending route selection, panel focus, Escape behavior and late iframe load notifications retain the correct state.

## Verification

| Check | Result and limit |
| --- | --- |
| JavaScript rules, rendering, catalog and launcher lifecycle | **59 passing tests**, no failures |
| Host updater tests | **30 passing tests**, no failures; mocked host/Docker operations |
| Source syntax and whitespace | App, viewer, arcade and new renderer syntax checked; `git diff --check` passed |
| Linux AMD64 image | Built with local Docker, started healthy, exported with `docker save`, gzip compressed and successfully reloaded with `docker load` |
| Runtime HTTP | Health and catalog HTTP 200, reported version 5.4.0; new modules/covers HTTP 200 with gzip |
| Proxy browser journeys | Actual Example Domain loaded through UV, Scramjet Epoxy, Scramjet Libcurl and Rammerhead, both same-origin and separate app/viewer local previews |
| Enter and new tabs | Enter launched inline; explicit new-tab control opened another Aether shell with Direct site preserved; temporary test tabs closed |
| Route preference/help | Explicit confirmation, forget control, reload/relaunch, panel focus restoration and narrow layout checked; nondefault route persistence also covered in rules tests |
| BeepBox | Real editor rendered and Play/Pause worked; third-party project export/storage not tested |
| Driftline | Browser acceleration, steering/handbrake input, hull damage, pause/restart and phone start layout checked; guided physics simulation completed three legal laps in 25.4 s with no barrier hits |
| Pulse Arena | Browser Scatter selection, movement, Blink cooldown, 600-point score and pause checked; subsequent Lance round reached a real loss, saved 1,300 points, exposed Play again and retained its best after reloading the player |
| Narrow layout | Both new game start panels/touch controls and route help fit a narrow viewport without horizontal overflow; weapon/start controls at least 44 px high |

Run the local suites:

```powershell
node --test public/arcade/tests/*.test.mjs public/tests/*.test.mjs
python tools/test-updater.py
git diff --check
```

Browser evidence is saved under `.Codex/launch-5.4/screenshots/` and runtime transfer measurements under `.Codex/launch-5.4/runtime.json`, both outside the Docker image. Browser results are smoke checks on this PC. Full browser winning runs, Driftline combo banking, broad device coverage, every remote game, real multiplayer sessions and production Cloudflare Access remain unverified. In particular, this release does not claim that Veck.io matchmaking is fixed.

The dependency install reports **five existing advisories: two moderate and three high**. This release does not upgrade those dependencies or claim the advisories are resolved.

## Image artifact

| Field | Value |
| --- | --- |
| Local tag | `aether:5.4.0` |
| Platform | `linux/amd64` |
| Image configuration digest | `sha256:0fa0d3935edc39f3e9b4e3ca959ac2a2501fc3e9610c2c2ffedd03aa9929369a` |
| Platform manifest digest | `sha256:3614301e18206e88e09a563006fe6bff2284712f87ad44eb5d450b57ceac9aca` |
| OCI index digest reported by Docker Desktop | `sha256:ef37146609965f2da44c9de614f54618e84cfcce9b1f89ddac62e38ed86f2daa` |
| Image size reported by Docker | 349,384,318 bytes |
| Saved tar size | 85,892,608 bytes |
| Compressed archive | `outputs/v5.4.0/aether-image-linux-amd64.tar.gz` |
| Compressed bytes | **85,579,081 bytes**, 85.58 MB / 81.61 MiB |
| Archive SHA-256 | `e557b14892c9653fce3ddda39638cfb5b18878ded8fb06c38423f8ff7b97fd7d` |

The adjacent `IMAGE-MANIFEST.json` and `.tar.gz.sha256` record the archive identity. Docker Desktop's OCI index ID differs from the image configuration digest in a saved archive; the updater's existing identity tests account for this.

## Preview and deployment status

The finished preview is **http://127.0.0.1:15007/**. A second local preview at port 15008 uses app origin `http://127.0.0.1:15008` and proxy origin `http://localhost:15008` for isolation checks. Both run development mode bound to loopback with separate named userdata volumes.

**This turn did not deploy to the NAS or publish/upload to GitHub, Google Drive or Cloudflare.** The production image requires distinct HTTPS app/proxy origins and configured Cloudflare Access applications/audiences. Local development-origin checks do not establish production Access cookies or JWT behavior. Follow [security and origins](SECURITY-AND-ORIGINS.md) before a public deployment, and [build/deployment](../BUILD-AND-DEPLOY.md) for load and rollback steps.

The updater remains a separate host supervisor with the previously selected latest-three rollback policy. It is not installed by loading this web image. Existing profile data and prior preview volumes were preserved.
