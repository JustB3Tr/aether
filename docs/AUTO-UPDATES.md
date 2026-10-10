# Restart updates

Aether checks the latest stable release at [JustB3Tr/aether](https://github.com/JustB3Tr/aether) when its container starts and when the NAS starts. It updates only when that version is greater than the installed version. Restarting on 5.0.0 with a 5.0.0 release keeps the existing container.

The supervisor runs on the NAS host as root. The Aether web container has no Docker socket, host credential, GitHub token, or updater API. Public release downloads need no token. Root access stays in a private host directory; anyone able to publish a release to this repository can publish code the NAS will run, so protect the GitHub account and review releases.

## Release contract

Every stable `vX.Y.Z` release must contain:

- `aether-image-linux-amd64.tar.gz`, a genuine single-image `docker save` archive.
- `IMAGE-MANIFEST.json`, including version, tag `aether:X.Y.Z`, image ID, archive basename, bytes, SHA-256, and platform `linux/amd64`.
- `aether-image-linux-amd64.tar.gz.sha256` for manual verification.

The image's `org.opencontainers.image.version` label, package version and `/health.version` must agree. Drafts, prereleases, downgrades, mismatched archives, hashes, image IDs and platforms are rejected. Downloads use HTTPS and permit only GitHub's release download hosts. Metadata and archive sizes are bounded.

The release manifest's `imageId` is the SHA-256 digest of the saved Docker config. Classic Docker reports this as its image ID. Newer Docker with the containerd image store can report an OCI index or platform-manifest digest instead. The updater accepts that alternative only after a bounded walk of the already verified archive hashes each referenced metadata blob and links the expected tagged root and Linux AMD64 manifest to the same verified config. Loaded platform and version checks still apply; an unrelated descriptor ID is rejected before preflight or downtime.

## Replacement and rollback

The image first starts in an isolated preflight container with disposable userdata. If its health and version checks pass, Aether stops briefly, the current userdata is backed up, and the new container takes the same name, port, named volume and configured environment. If the new container fails health checks, its container is removed and the old image and data are restored. A failed release version is skipped on later restarts until an administrator reviews `state/state.json` and removes its `failedVersion` field.

After a replacement passes its health and version checks, the updater records one complete successful rollback set: the stopped prior container, its container-inspect JSON, and the matching userdata archive. It retains the latest three complete successful sets by default. The private updater config may set `rollbackRetention` to an integer from 1 to 10; leaving it unset uses 3. The current active container is never part of the pruned set.

Pruning is limited to exact set records in `state/state.json`. Before removal the updater checks that the backup container has the recorded ID and image, has the expected Aether backup name, is stopped, and uses the configured userdata volume. It also checks that the matching metadata and archive are regular files under the resolved `state/backups` directory. It removes the inspected container by ID without `--force` or `--volumes`, then removes only that set's two exact files. It never scans Docker for names to delete and never performs a broad backup-directory cleanup.

The first update after installing this policy can import the previous updater's latest successful set only when its state entry, stopped container, metadata, and userdata archive all validate. Other older or untracked backups are left alone because their status cannot be proven. Incomplete sets, failed userdata, interrupted transactions, and any set associated with `rollbackRequired` are preserved. Pruning runs only after a replacement is proven healthy, never during preflight, a failed update, or manual recovery.

Production Aether 5.2.0 and later require `NODE_ENV=production`, both origin values, the Access team domain, and separate app/proxy audience values. Mirror these six exact values in the private updater `env` list before allowing an update. Container validation deliberately blocks replacement if the running environment is not represented by the updater configuration.

Offline GitHub, rate limits and download errors keep the working application and retry on a later restart. They do not permanently block a release. A 30 second cooldown coalesces repeated start events. The supervisor reconnects after Docker restarts and a kernel lock prevents duplicate watchers. A manually stopped app is left stopped. Unexpected changes to managed configuration stop automatic replacement for review. Party rooms are temporary and reset on replacement. Do not change deployment configuration without updating and reviewing the supervisor config.

Automatic updates include a short outage. A persisted transaction or `rollbackRequired` state blocks more replacements until an administrator reviews recovery. A power loss during replacement can require manual recovery using the retained container and backup. Backup extraction finishes before live data is touched, and the unsuccessful image's userdata is retained too. Recovery failures are logged `CRITICAL`. The updater estimates image layer and rollback-copy space before loading and rechecks backup space before stopping Aether; insufficient space fails before downtime. Changing this source policy does not change the installed NAS updater or remove any existing containers or backups until a reviewed updater release is installed.

## Publish from Windows

Builds remain local. GitHub Actions has only an optional manual workflow and never runs on a source push.

1. Change the package version and the frontend version/cache values; update the lockfile and release notes.
2. Run the application and its checks. Commit and push the source to `main`.
3. In PowerShell, run `./tools/release.ps1 -NotesFile docs/RELEASE-X.Y.Z.md`. This builds Linux AMD64 locally, verifies the image, exports it, and publishes the three release assets.
4. Restart Aether on the NAS when ready. Inspect the updater log and `/health` afterwards.

The release API, container start events and boot task use the official [GitHub releases API](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28), [Docker events](https://docs.docker.com/reference/cli/docker/system/events/) and [TrueNAS init/shutdown task](https://api.truenas.com/v26.0/api_methods_initshutdownscript.create.html).

NAS-specific installed paths, boot task ID, release hash and deployment validation are recorded in `DEPLOYMENT.md` after installation.
