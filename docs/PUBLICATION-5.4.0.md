# Aether 5.4.0 publication and restart attempt

Observed on 2026-10-10. [Aether 5.4.0](https://github.com/JustB3Tr/aether/releases/tag/v5.4.0) is a public stable release, not a draft, and GitHub reports it as latest. The source target is `d685f396c59a3a559277c49861819c4ae4ee574e`.

The image, manifest and SHA file are uploaded. GitHub reports 85,579,081 archive bytes and digest `sha256:e557b14892c9653fce3ddda39638cfb5b18878ded8fb06c38423f8ff7b97fd7d`, matching the verified local archive. All 174 shipped application/source files matched the tested local container before publication.

## Actual NAS restart result

The existing standalone Docker container `aether` was restarted by SSH at the user's request. The running container is still `aether:5.1.0`, ID `5119f20dceaccc4a227dbf6f97ed5b420006c163711cf22bc3f6b0a5f2a2c46e`, with the existing `aether-data` mount. HTTP health returned version 5.1.0 and two profiles after restart.

The installed watcher logged:

```text
2026-10-10T20:28:11+00:00 Downloading release 5.4.0
2026-10-10T20:28:19+00:00 Restart update check failed; current app retained: New container exited:
```

This was a failed preflight, not a completed 5.4 deployment. The host updater has an empty production environment list and the new image defaults to production, which requires separate HTTPS origins and Cloudflare Access team/audience settings. Its private state now records `installedVersion: 5.1.0`, `failedVersion: 5.4.0`, with no `rollbackRequired` value. No production configuration was bypassed. A failed version is skipped on later restarts until an administrator reviews and clears that marker after fixing the cause.

## TrueNAS Apps visibility

The actual TrueNAS `app.query` result did not contain Aether. It is a standalone Docker container rather than a TrueNAS-managed App, so it does not appear in the Apps list. It can be migrated to a managed Custom App separately, preserving the real userdata volume and reviewing the external updater ownership contract first. This publication did not perform that migration or change unrelated apps.

## Required continuation

Cloudflare Zero Trust Free activation is awaiting user review because its checkout requires terms acceptance and authorization of the saved card for usage above free limits. After activation, configure the two HTTPS routes and Access applications, preserve the tunnel's actual upstream, obtain both audience tags privately, configure identical container/updater environment, and preflight successfully. Update the host supervisor with backup and retain the selected latest-three rollback policy. Only after successful preflight should the failed-version marker be cleared and the production replacement retried. Verify actual 5.4 health, protected HTTPS browser journeys and retained profile files before reporting deployment success.

See [5.4 local build results](RELEASE-5.4.0.md), [production requirements](SECURITY-AND-ORIGINS.md), and [updater behavior](AUTO-UPDATES.md).
