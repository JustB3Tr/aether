# Current deployment: Aether 5.5.2

Verified 2026-10-12: the local AMD64 image was published as [v5.5.2](https://github.com/JustB3Tr/aether/releases/tag/v5.5.2) and installed through the existing restart updater at 18:49:35 UTC. Docker reports `aether:5.5.2 healthy`; fresh public health reports 5.5.2. The public HTML has the restored Settings about:blank button, and the deployed app, blank launcher and proxy viewer files match the hotfix source exactly. All five profile files and the signing secret match the stopped-write backup; three managed rollback sets remain. Browser automation was unavailable, so no new rendered-popup or full Poki gameplay verification is claimed. [Release evidence](RELEASE-5.5.2.md).

## Previous deployment: Aether 5.5.1

Verified 2026-10-11: the motion release is installed through the existing restart updater, and Docker reports `aether:5.5.1 healthy`. Public Home displays V5.5.1 with active motion; deployed motion scripts/styles match source. All four profiles survived the update and three rollback sets remain. [v5.5.1 release evidence](RELEASE-5.5.1.md) records checks, archive identity and installation times.

## Previous deployment: Aether 5.5.0

Verified 2026-10-11: the existing standalone NAS container is `aether:5.5.0`, running and healthy. Its restart watcher downloaded and installed the public stable release, preserving `aether-data` and four existing profiles. Three successful rollback sets remain. Public HTTPS startup and a local tool's Enter calculation/profile save were exercised.

See [v5.5.0 release evidence](RELEASE-5.5.0.md) for the image identity, archive checksum, manual browser checks and limitations. The image archive is 85,605,640 bytes. This is a Docker deployment; it does not appear as an Apps-managed entry in TrueNAS. The existing PC Cloudflare tunnel must remain online for public access.

The following v5.1.0 evidence is historical.

# Aether 5.1.0 deployment validation

Completed 2026-10-10 UTC, 2026-10-09 Pacific. Built locally on Windows, published as a stable public release, and installed on TrueNAS by the existing restart updater. The NAS was not rebooted.

## Release identity

| Field | Verified value |
| --- | --- |
| Source commit / release target | `1c10141a8e98969b569d9f4842fc9ae990617718` |
| Version / tag / platform | `5.1.0` / `aether:5.1.0` / `linux/amd64` |
| Image config ID, matching NAS | `sha256:0c43c4947cd803d4a65940c40236fa836caf6b4d3633055729e47b880bd04ab1` |
| Expanded image size | 338,016,313 bytes |
| Gzip archive | 81,704,057 bytes, 81.70 MB / 77.92 MiB |
| Docker save tar | 82,011,136 bytes |
| Archive SHA-256 | `9e1020e5178588503916e6965938e0dd79773a9c383a2d99503bc7a780a77e47` |

The archive is a genuine `docker save` image with compressed layers. Archive inspection verified tag, platform, version label and config hash. The NAS downloaded and loaded it through the actual updater. Docker Desktop's content-store index ID differs from the image config ID; the manifest and TrueNAS use the config ID above.

[Stable release](https://github.com/JustB3Tr/aether/releases/tag/v5.1.0). GitHub readback confirms the exact source target and three assets. Archive asset `626697180` has the matching provider digest; the NAS's independent downloaded-file SHA and byte count also match.

[Google Drive image](https://drive.google.com/file/d/1-sI4K2y61SoD_Hgd4pqJiyMAojT6-9yk/view) was replaced in place, retaining its folder and file ID. Completed upload plus separate metadata readback confirm gzip type and 81,704,057 bytes. This is upload/metadata evidence, not an independent Drive-download hash.

## Current release checks

- Local Linux AMD64 build completed. Docker preview and final NAS container became healthy with health version `5.1.0`.
- All **117 shipped source files** agree byte for byte with the local container.
- Ten local HTTP readbacks returned 200 with expected types: health, catalog, HTML, four page style layers, motion script, observatory image and Original entry route.
- Eight desktop and eight 390px phone captures were inspected. Compact Focus keeps its primary timer controls above the dock on a 700px phone. Browser width was rechecked after a transient emulation capture: main 390px, hero 356px. No document horizontal overflow was reported in these views.
- A featured Neon Serpent launch in the Docker frontend opened its initialized Original inside Aether and returned to the shell. This does not establish complete game mechanics coverage.
- Deployed public HTTPS Home renders the new design. Enter on deployed Browser opened actual Ultraviolet destination content inside Aether, with the new engine label and no recorded console error.
- The catalog remains 202 game entries, including 16 Originals, plus 27 apps. This is not a count of played remote titles.

No new regression suite or massive auditor/visionary pass was run for this visual release. Scramjet/Rammerhead, every popup/backup/Party/settings journey and broader device/accessibility behavior await the fresh audit. [v5.0 validation](DEPLOYMENT-5.0.0.md) and its passing counts remain historical. [Next-turn brief](NEXT-AUDIT-BRIEF.md) defines the independent review.

## Actual restart upgrade and persistence

The NAS started healthy on `aether:5.0.0`. Restarting after v5.1 publication made the root watcher download at **01:42:17 UTC** and install at **01:42:27 UTC**. This exercised a real newer stable release, archive validation, isolated preflight, stopped-write backup and replacement.

Final inspection confirms `aether:5.1.0`, matching config ID/version label, running/healthy, default bridge, `unless-stopped`, `3000:3000` on host interfaces and the original **`aether-data:/app/userdata`** mount. Both existing profiles remain. All three persistent files match the stopped-write snapshot by path/content hash.

Retained rollback:

- Prior stopped container: `aether-backup-20261010T014224846043Z`.
- Data snapshot: `/mnt/tank/apps/aether-updater/state/backups/20261010T014224846043Z-userdata.tar.gz`.
- Private state: `/mnt/tank/apps/aether-updater/state/state.json`, installed version 5.1.0, no failed version.

The supervisor remains outside the app at `/mnt/tank/apps/aether-updater`, with existing TrueNAS Post Init task 1. No Docker socket or GitHub token is given to the web container. Other NAS apps were not restarted. Failure rollback and host reboot were not forced.

## Operation and next review

Open [Aether](https://aether.thetrademaster.trade/). Future newer stable releases use the existing restart mechanism:

```sh
sudo docker restart aether
sudo tail -n 40 /mnt/tank/apps/aether-updater/updater.log
curl -fsS http://127.0.0.1:3000/health
```

Keep the data volume and rollback files. See [AUTO-UPDATES.md](AUTO-UPDATES.md) and [BUILD-AND-DEPLOY.md](../BUILD-AND-DEPLOY.md) for publishing/manual transfer/recovery.

The visual release preserves known proxy/profile isolation, RH destination TLS, vulnerable dependency chains and iframe error-state findings. Build output still reports six high and two moderate dependency vulnerabilities. The next massive audit and visionary work is prepared, not executed or declared passing.

Private evidence remains in `outputs/v5.1.0/` and `.Codex/design-v51/screenshots/`, excluded from the public repository.
