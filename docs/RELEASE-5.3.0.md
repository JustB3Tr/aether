# Aether 5.3.0

## Added

- **Breachline:** an original cover shooter with six drone sectors, dash movement, optional manual aim, permanent upgrades between rounds, and a final Warden encounter.
- **Overdrive:** an original 4.4 km highway sprint with curves, traffic, close passes, nitro batteries, three checkpoints, keyboard and touch controls, and optional cruise assist.
- **14 remote games:** Kirka.io, Lurkers.io, Wings.io, Starblast.io, Kart Bros, HaxBall, TagPro, TETR.IO, Soccer Bros, Baseball Bros, Slow Roads, Basket Bros, Hockey Bros and Wrestle Bros.
- **11 apps:** BeepBox, Song Maker, Piskel, Kleki, Blockbench, Squoosh, Twine, TurboWarp, MakeCode Arcade, GeoGebra Calculator Suite and wide.video.
- Original Aether directory artwork for all 25 external additions, plus separate covers for the two new Originals. Directory artwork does not claim to be an official provider logo.

The catalog now contains **226 games**, including **21 local Originals** and **205 remote entries**, plus **41 apps**. The discovery reports link the official sources and distinguish reachability from actual gameplay. Entries that block direct framing use a proxy or their explicit Original site link.

## Launching and efficiency

- Scramjet offers Libcurl or a separately pinned Epoxy 3 transport. Ultraviolet retains its own Epoxy 2 package. Switching transports reuses one Scramjet controller and frame.
- The action renderer is imported only when Breachline or Overdrive is selected. Lightweight definitions keep their titles searchable without downloading their renderer.
- Action games cap frame steps, particle/projectile counts and canvas pixel density. HUD text updates are throttled instead of rewriting DOM every frame.
- Engine `.mjs` assets now use the existing HTTP compression cache. The Epoxy 3 module is 1,745,144 bytes before compression and 754,493 bytes with gzip in the local source check.
- Remote launches have an Original site link and an explicit alternate engine control. A loaded page is no longer labelled as a failure merely because 35 seconds elapsed without a detectable cross-origin input event.
- Enter submits browser destinations. In-page launching remains the default; the checkbox opens a separate Aether shell tab.

## Isolation and recovery

The proxy viewer explicitly sends compatible COEP/COOP headers, permits embedding at the CORP layer, and restricts its actual parent with `frame-ancestors` to the configured app origin. The app delegates `cross-origin-isolated` only to itself and the configured proxy origin, and the outer iframe permits that feature for its source. Rammerhead also returns compatible COEP from its separate destination-header hook and dispatch fallback. This keeps the app/profile origin separated from rewritten websites and preserves Access cookie handling.

The restart updater source keeps the latest **three complete successful rollback sets** by default. It prunes only exact, state-tracked, stopped containers and their matching metadata/userdata files after a healthy replacement. It preserves failed, incomplete, interrupted and untracked recovery materials. Its image identity check also supports newer Docker's OCI descriptor IDs by hashing archive metadata and linking them to the same verified image config. This is a host-side supervisor change; the web image never receives the Docker socket. Installing only the new web image does not install this updater policy. The public supervisor source and boot wrapper are packaged separately in `outputs/v5.3.0/aether-updater-source.zip`; no private host configuration is included.

## Checks and limits

- Combined Original rule/catalog tests: **21 passed**.
- Updater tests with mocked Docker and temporary files: **30 passed**, including classic/config and containerd/index identity checks.
- JavaScript syntax checks passed for the server, shell, viewer and new game modules.
- Browser checks exercised Breachline sector clearance, an upgrade, dash and pause; Overdrive acceleration, boost, pause, timer expiry, Play again availability and retained personal best; and BeepBox's embedded Play/Pause control.
- Scramjet/Epoxy loaded a representative HTTPS page, switching back to Libcurl loaded it again, and the corrected two-origin loopback viewer also rendered the page. These checks do not prove a multiplayer game connects.
- Overdrive's start screen fit a 390-pixel viewport without horizontal overflow. Full campaign/race wins, every remote game, all editor exports and broad device coverage remain unverified.

The production Cloudflare Access applications, HTTP/WebSocket authorization and NAS rollout still need their own deployment validation. No NAS, Cloudflare, GitHub release or Google Drive upload was performed for this release's source work. Five dependency advisories remain from the pinned dependency tree; this feature release does not claim to resolve them.

## Local build and handoff

Use [BUILD-AND-DEPLOY.md](../BUILD-AND-DEPLOY.md) for the Linux AMD64 build, loopback preview, real `docker save` archive and rollback commands. The final image was built locally, exported with `docker save`, compressed, verified and successfully loaded back into Docker.

| Artifact | Verified value |
| --- | --- |
| Tag and platform | `aether:5.3.0`, `linux/amd64` |
| Compressed archive | `outputs/v5.3.0/aether-image-linux-amd64.tar.gz` |
| Archive bytes | 85,540,469 (85.54 MB, 81.58 MiB) |
| Docker image size | 349,192,277 bytes |
| Config digest | `sha256:a3b0ff2a98a762e7e91f314cf834acb6d4224af967d2b7e7eec829cb1019788f` |
| Archive SHA-256 | `5639b1e1cf4c24826bca443b94c5874835ad0991a4ea9b210587d7f937c4871f` |
| Local preview | `http://127.0.0.1:15005/#games` |

Docker's newer containerd image store reports an OCI index digest in image inspect; the release manifest's imageId records the hash of the saved image config for compatibility with classic Docker. See the updater's archive identity validation rather than equating those two values.

`outputs/v5.3.0/IMAGE-MANIFEST.json` records the exact archive metadata. Final HTTP checks returned health version 5.3.0, all 226 games and 41 apps, compressed action/transport assets, and all 25 new directory covers. The final phone toolbar and remaining live engine checks could not finish after the browser connection disappeared. Use [AUTO-UPDATES.md](AUTO-UPDATES.md) for the separate host supervisor policy.

Production requires both distinct HTTPS origins and both Cloudflare Access audiences. Do not expose the development preview publicly. A compatible image alone does not complete this account configuration.
