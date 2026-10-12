# Aether 5.5.2: blank launcher and Poki launch recovery

## Changes

- Restores an explicit **Settings -> Open Aether in about:blank** action. It
  opens the current Aether page in a blank-address wrapper, retains existing
  iframe permissions and sandbox restrictions, detaches the opener and reports
  blocked popups. This changes address-bar presentation, not network privacy.
- **Launch options and loading help -> Open standalone proxy viewer** is now
  available for public isolated proxy launches, including after a page has
  arrived. It opens the same engine and destination on the isolated proxy
  origin with one fewer outer iframe. On successful opening it releases the old
  embedded player, avoiding duplicate renderers/downloads. A blocked popup keeps
  the existing player available. It does not silently change engines.
- Poki Rammerhead reloads can reuse a tab-local session for up to one hour after
  checking that the server still holds it. This retains that session's cookies,
  avoids repeated session creation and reduces pressure on the session creation
  limit. Missing, expired, malformed or inaccessible caches fall back safely to
  a new session. Other providers retain their existing behavior.
- Poki recovery explains the distinction between the portal page and its
  separate game loader. No external load event is promoted to gameplay success.
- Corrects two inherited test assertions that still counted 23 Originals;
  shipped catalogs and game definitions already contain 26. Catalog/registry
  equality is now checked explicitly.

## Verification and limits

All 79 meaningful JavaScript rule, launcher, proxy and security checks pass.
The final local Docker container is healthy and reports v5.5.2. Live HTTP
checks verify profile save/readback, cross-site rejection, server session
validation, rewritten Poki HTML and a served blank-launch helper whose SHA-256
matches source. The first request immediately after preview replacement hit
startup; after inspection showed the same container healthy, its rerun passed.
Browser automation is unavailable, including attempted in-app tab creation, so
the popup and gameplay flows have unit coverage but no new rendered-browser
verification. The dependency installation reports five inherited issues, two
moderate and three high; this release keeps dependency versions unchanged.

Built locally for Linux AMD64, exported with `docker save`, compressed and
successfully loaded back with `docker load`:

- Archive: `aether-image-linux-amd64.tar.gz`, **85,607,211 bytes**.
- SHA-256: `d7681ed690b18c1da5bbfdefb5a3473ab2913c6310eda76cb76cff663476d80b`.
- Image config: `sha256:a3229686535b032a19ebf124fa9c957511147e1024a123d16a772a97abce48ba`.
- Package, version label and `/health.version`: `5.5.2`.

The reported all-Poki in-game stall has not been reproduced in a connected
browser. HTTP document checks found the direct Moto X3M portal and a production
Rammerhead document response healthy, with its proxy client injected. Those
checks do not prove game SDK, renderer, advertising or gameplay readiness.
This hotfix supplies recovery and session improvements, not a claim that all
93 Poki entries are verified playable.

The 14-phase connected arcade overhaul remains separate, unshipped work. This
hotfix is based on the published v5.5.1 source without the unfinished guest,
cartridge or seeded-round changes. Existing profile data, public access mode,
origin isolation, destination restrictions and rollback policy are preserved.

## Publication and NAS deployment

Published [v5.5.2](https://github.com/JustB3Tr/aether/releases/tag/v5.5.2) from
source commit `78f3623c78cf0496da8eb5a43de73a141c088015`. GitHub reports all three
assets uploaded, and the archive's digest/size match the local values above.

The existing NAS updater downloaded at 2026-10-12 18:49:23 UTC and installed at
18:49:35 UTC. Docker reports `aether:5.5.2 healthy`; public `/health` reports
version 5.5.2. Public HTML contains the Settings launcher. The deployed app,
blank launcher and proxy viewer match source text exactly. All five profile
files and `.session-secret` match the stopped-write backup byte for byte.
The original `aether-data` volume is retained, failedVersion is null, and three
successful managed rollback sets remain. The new rollback container is
`aether-backup-20261012T184932360012Z`.

The about:blank action is **Settings -> Open Aether in about:blank**. Poki's
standalone route is **Launch options and loading help -> Open standalone proxy
viewer**; manually choose Rammerhead in the same panel to use its tab-session
reuse. These additions have the evidence above, not an all-Poki gameplay pass.
