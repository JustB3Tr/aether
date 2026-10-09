# Restart updates

Aether checks the latest stable release at [JustB3Tr/aether](https://github.com/JustB3Tr/aether) when its container starts and when the NAS starts. It updates only when that version is greater than the installed version. Restarting on 5.0.0 with a 5.0.0 release keeps the existing container.

The supervisor runs on the NAS host as root. The Aether web container has no Docker socket, host credential, GitHub token, or updater API. Public release downloads need no token. Root access stays in a private host directory; anyone able to publish a release to this repository can publish code the NAS will run, so protect the GitHub account and review releases.

## Release contract

Every stable `vX.Y.Z` release must contain:

- `aether-image-linux-amd64.tar.gz`, a genuine single-image `docker save` archive.
- `IMAGE-MANIFEST.json`, including version, tag `aether:X.Y.Z`, image ID, archive basename, bytes, SHA-256, and platform `linux/amd64`.
- `aether-image-linux-amd64.tar.gz.sha256` for manual verification.

The image's `org.opencontainers.image.version` label, package version and `/health.version` must agree. Drafts, prereleases, downgrades, mismatched archives, hashes, image IDs and platforms are rejected. Downloads use HTTPS and permit only GitHub's release download hosts. Metadata and archive sizes are bounded.

## Replacement and rollback

The image first starts in an isolated preflight container with disposable userdata. If its health and version checks pass, Aether stops briefly, the current userdata is backed up, and the new container takes the same name, port, named volume and configured environment. The previous stopped container and data backup are retained. If the new container fails health checks, its container is removed and the old image and data are restored. A failed release version is skipped on later restarts until an administrator reviews `state/state.json` and removes its `failedVersion` field.

Offline GitHub, rate limits and download errors keep the working application and retry on a later restart. They do not permanently block a release. A 30 second cooldown coalesces repeated start events. The supervisor reconnects after Docker restarts and a kernel lock prevents duplicate watchers. A manually stopped app is left stopped. Unexpected changes to managed configuration stop automatic replacement for review. Party rooms are temporary and reset on replacement. Do not change deployment configuration without updating and reviewing the supervisor config.

Automatic updates include a short outage. A persisted transaction or `rollbackRequired` state blocks more replacements until an administrator reviews recovery. A power loss during replacement can require manual recovery using the retained container and backup. Backup extraction finishes before live data is touched, and the unsuccessful image's userdata is retained too. Recovery failures are logged `CRITICAL`. Backups and stopped rollback containers are retained rather than automatically pruned; review disk usage periodically.

## Publish from Windows

Builds remain local. GitHub Actions has only an optional manual workflow and never runs on a source push.

1. Change the package version and the frontend version/cache values; update the lockfile and release notes.
2. Run the application and its checks. Commit and push the source to `main`.
3. In PowerShell, run `./tools/release.ps1 -NotesFile docs/RELEASE-X.Y.Z.md`. This builds Linux AMD64 locally, verifies the image, exports it, and publishes the three release assets.
4. Restart Aether on the NAS when ready. Inspect the updater log and `/health` afterwards.

The release API, container start events and boot task use the official [GitHub releases API](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28), [Docker events](https://docs.docker.com/reference/cli/docker/system/events/) and [TrueNAS init/shutdown task](https://api.truenas.com/v26.0/api_methods_initshutdownscript.create.html).

NAS-specific installed paths, boot task ID, release hash and deployment validation are recorded in `DEPLOYMENT.md` after installation.
