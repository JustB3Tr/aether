# Aether 5.0.0 deployment validation

Validated on 2026-10-09. The Linux AMD64 image was built locally on Windows, exported using `docker save`, and deployed to the managed TrueNAS SCALE Docker host.

## Release identity

| Field | Value |
|---|---|
| Version / tag | `5.0.0` / `aether:5.0.0` |
| Platform | `linux/amd64` |
| Expanded image size reported by Docker | 337,624,377 bytes |
| Gzip image archive | 81,575,636 bytes, 81.58 MB / 77.80 MiB |
| Uncompressed Docker save archive | 81,881,088 bytes |
| Archive SHA-256 | `73dd468411b6fb5a3b026b7c2c05d85ba987cc49b725c74261995cf919e73b85` |
| Docker image config ID | `sha256:f4cd0d96d3009f59bad417cb50dafdebdaeb9b8b80cc09b7fd146f0309f20eb1` |

The archive stores compressed image layers, so the saved tar is smaller than Docker's expanded image-size figure. It is a genuine image archive. Its manifest, architecture, version label and config hash were validated. A local `docker load` round trip succeeded. The TrueNAS daemon reports the matching config ID after loading.

[Public release and image](https://github.com/JustB3Tr/aether/releases/tag/v5.0.0). GitHub's reported asset SHA-256 matches the local archive. The NAS independently downloaded the public release through the actual updater download/validation functions and verified its size, hash, tag and platform without a credential.

The same archive was uploaded to the user's existing Google Drive folder. Provider readback confirmed the file ID, folder, gzip type and 81,575,636 byte size. Independent local byte hashing of Drive's temporary download reference was unavailable (HTTP 403); Drive verification is upload completion and metadata readback, not a separate Drive-download SHA claim.

## Application and image checks

- All 111 shipped application files match the reviewed source byte for byte.
- Nine Original-game rule suites pass.
- 29 isolated client regressions pass for failed saves, stale acknowledgements, profile changes, offline drafts, bindings, proxy submission/tab options, access labels and backup bounds.
- 20 isolated updater regressions pass for transaction failure/recovery, configuration preservation, stopped apps, owned preflight cleanup, interrupted-state handling and transient downloads. These use mocked Docker plus real disposable files; a future automatic upgrade and production rollback have not been forced with a fake public release.
- Ten container checks pass: 5.0.0 health, 202/27 catalog, 24 concurrent saves, >4 MiB backup restore, 8 MiB profile rejection, invalid-key/origin rejection, compressed/304/HEAD responses, core assets, RH listener compatibility, and private artwork destination rejection.
- All 44 disposable local-container profile keys survived a Docker restart.
- NAS health, catalog, ten static endpoints, profile write/read and three test saves across restart pass. Temporary NAS profile data is removed after validation.
- The deployed HTTPS frontend renders the themed home. UV, Scramjet/Libcurl and RH each rendered actual Example Domain content in Aether's viewer with no recorded browser console error. A local Original initializes in the deployed viewer.
- Eight main desktop pages, eight actual 390px phone pages, and all 16 Original routes have inspected local captures.

Native browser input stalled during later testing. Previously completed interactive journeys and current controller/HTTP tests are documented separately in the [audit](audit/AUDIT.md); popup, backup-dialog and Party UI paths are not advertised as completely tested. Remote catalog reachability is not a gameplay guarantee.

## Installed host contract

The managed container is `aether`, publishing `3000:3000` on all host interfaces, using Docker's default bridge, `unless-stopped`, and the existing named `aether-data` volume at `/app/userdata`. The original 4.1.1 container and a stopped-write userdata snapshot are retained. Other NAS applications were not restarted.

The private supervisor directory is `/mnt/tank/apps/aether-updater`, owned by root with mode 700. Configuration/state files use private permissions. TrueNAS Post Init task **1** starts `start-aether-updater.sh`, which starts the root Python event watcher under a kernel lock. No Docker socket, host credential or GitHub token is given to the Aether web container.

Boot-hook registration and manual startup are verified. The NAS itself was not rebooted. Actual application restarts produced `Restart check: installed 5.0.0, latest 5.0.0. Already current.` at 20:53 and 20:54 UTC. The restarted app remained healthy, the saved data persisted, and the managed configuration passed validation afterwards.

## Operation

SSH into your NAS, then run:

```sh
sudo docker restart aether
sudo tail -n 40 /mnt/tank/apps/aether-updater/updater.log
curl -fsS http://127.0.0.1:3000/health
```

A newer stable release causes a brief replacement with verified image download, isolated preflight, consistent userdata backup, retained old container and health rollback. Network failures retain the working app. Interrupted replacement or failed recovery needs an administrator to inspect private `state/state.json` before another replacement. See [auto-update contract and publishing](AUTO-UPDATES.md).

For manual recovery, inspect `state/state.json` for the actual backup container/file, stop the failed replacement, restore userdata while stopped, rename the original back to `aether`, and start it. Do not delete or overwrite a volume before making and checking a copy.

## Remaining risks

The audit still records three high architectural/dependency concerns: proxy/profile origin isolation, RH destination certificate validation, and vulnerable dependency chains. A proxy error HTML document can also be treated as an iframe load success. Deployment success does not resolve those findings. Their concrete follow-up plan is [here](audit/IMPROVEMENT_PLAN.md).
