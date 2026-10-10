# Aether 5.4.2

Includes the public mode, origin isolation, destination guards, signed profiles and Veck Rammerhead preference from [5.4.1](RELEASE-5.4.1.md).

Fixes Wisp 0.5.0's per-host limiter iterating a stream object as an array. With that limit enabled, permitted public TCP streams failed to initialize, stalling Ultraviolet and Scramjet. The version-checked install patch keeps the limits enabled and iterates Object.values instead. A regression check exercises both a permitted stream and an excess stream.

68 JavaScript checks and 30 host updater checks pass. Live Linux image checks cover health, signed profile cookies, saves/recovery, cross-profile and cross-site rejection, origin separation, Rammerhead public destinations and private/port/chaining rejection, and Wisp private stream rejection. Local and public HTTPS browser checks rendered public destinations through Ultraviolet and both Scramjet transports. Public HTTPS checks also verified secure signed profiles, Rammerhead public pages, private/port rejection and app/proxy isolation without an Access login. Driftline launched on the public app and its running speed/timer changed after Start engine; a complete race was not tested.

The Docker save archive was compressed and loaded back successfully: 85,587,196 bytes, SHA-256 `01555ef55fb504660e4a3a608a91f8a9a62200c94f5af09558f34bd3f71a2608`, Linux AMD64 image config `sha256:6bfddc7d70de5236eaed7f07beee6375c3c3a77018885670d2b02595a592d825`.

Veck remains a remote compatibility limitation, not a guaranteed working game.

## Release and NAS deployment

- Stable public release: https://github.com/JustB3Tr/aether/releases/tag/v5.4.2. GitHub reports the archive uploaded with the exact digest and size above.
- On 2026-10-10 at 23:20:16 UTC, restarting the existing NAS container triggered the host updater to download 5.4.2 from GitHub. At 23:20:26 UTC it installed the verified image and retained `aether-backup-20261010T232023812088Z` plus a consistent userdata archive.
- A second restart at 23:21:29 UTC reported installed 5.4.2, latest 5.4.2, already current. Docker health is healthy and image config matches the release manifest. The existing named `aether-data` volume remains mounted.
- The updater config retains three successful managed rollback sets. Older untracked backups were preserved. The supervisor and config were backed up before upgrading from 5.1.0.
- Live app: https://aether.thetrademaster.trade. Isolated engine host: https://aether-proxy.thetrademaster.trade. Both use the existing PC-hosted `ollama-home` tunnel, whose prior routes were preserved. The PC still needs to remain online for public access.
- This remains a standalone NAS Docker container, not a TrueNAS Apps-managed application. No Zero Trust plan, card authorization or Access login was activated.
- Screenshot: local `outputs/v5.4.2/nas-public-aether.png`. Runtime source hashes were compared against the built Linux image before release.
