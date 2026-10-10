# Aether 5.2.0

## A separate browser origin

- Production now requires distinct HTTPS origins for the Aether shell/profile API and the proxy viewer/engines.
- Cloudflare Access assertions are verified before normal HTTP requests, Bare/Rammerhead dispatch, and WebSocket upgrades. The app and proxy each use their own Access audience.
- The proxy hostname only serves the isolated viewer, engine assets, and transport routes. It does not serve the shell or profile APIs.
- Aether profile save messages are accepted only from Aether Originals on the shell origin. Third-party proxy pages no longer receive profile saves or initialization data.
- Docker defaults to production and fails closed without the required origins and Access settings. Local previews must explicitly run in development mode and stay loopback bound.

Cloudflare DNS, Tunnel routes, Access applications, and the NAS were not changed. Production deployment requires setting up both hostnames and Access policies first. See [security and origins](SECURITY-AND-ORIGINS.md).

## Engines and launch recovery

- The shell no longer treats the first iframe document load as proof that the game finished booting. It shows a non-blocking recovery panel if the game has not received input or reported progress after its startup window.
- Scramjet navigation no longer waits on a promise from `go()`, which returns before page readiness. Engine assets use the release version in their URLs to reduce stale worker and vendor-file mismatches.
- Rammerhead upgrades to Hammerhead 31.7.8 and applies a version-checked patch restoring destination TLS certificate verification.
- Veck.io, Shell Shockers, and Krunker now prefer direct browser launch. WebRTC peer traffic is not carried through Aether's HTTP/WebSocket proxy transport. A loaded page still does not prove a multiplayer game is ready.
- The catalog adds official Venge.io, Deadshot.io, Kour.io, Repuls.io, and War Brokers entries. The existing Poki Venge entry remains available. These are source links, not verified in-Aether gameplay.

## More to explore

- Aether Drift adds a local arena survival shooter.
- CodePen, Excalidraw, and Photopea join the Apps shelf.
- Party rooms disappear with their chat as soon as the last member leaves.
- Browser is now the consistent navigation/page title; Focus updates its accessible action label and pressed state.
- Phone navigation labels are larger, and the explicit Aether reduced-motion preference reaches Originals.
- The restart updater checks image/rollback free space before loading or replacing a release. Automatic backup pruning remains pending the owner's retention choice.

## Verification status

The new remote catalog entries were added from official sources. Veck.io and Venge.io reached their official game menus in the local Aether preview; matchmaking and account flows were not tested. Production Access requires live configuration on both hostnames. Local image build, startup, HTTP checks, engine sample pages, Original controls, and exporter verification are recorded in [deployment status](DEPLOYMENT-5.2.0.md). The archive was uploaded to the requested Drive folder. No NAS or Cloudflare change was made.
