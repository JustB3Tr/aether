# Aether 5.2.0 local image verification

**Date:** 2026-10-09 Pacific. This records local Windows Docker Desktop and browser checks. It is not a NAS deployment record.

## Image artifact

| Item | Result |
| --- | --- |
| Docker tag | `aether:5.2.0` |
| Platform | `linux/amd64` |
| Saved archive config ID | `sha256:c3e29a4e6a1de554eae40ef38038746388534688fd6e813c2a9777907e046617` |
| Docker image size | 336,319,297 bytes (320.6 MiB) |
| Compressed `docker save` archive | 81,710,298 bytes (77.9 MiB) |
| Archive SHA-256 | `a3943fa3830d832fa480aa5ce93df771370a9fba1af87310cd811da2ab9c10e6` |
| Output | `outputs/v5.2.0/aether-image-linux-amd64.tar.gz` |
| Drive upload | Existing same-named archive updated in the requested folder; the returned Drive metadata matched the new byte count. |

The exporter read the saved Docker manifest and verified the tag, platform, image version label, image ID, compressed size, and digest. The image was built locally with Docker Desktop's Linux AMD64 builder. The Rammerhead TLS install hook ran successfully against the pinned Hammerhead 31.7.8 dependency.

## Local runtime checks

- The separate `aether-v52-review` container is healthy on `127.0.0.1:15003`, with a new disposable named volume. The pre-existing v5.0 and v5.1 preview containers were left alone.
- `/health` returned `ok: true`, version `5.2.0`; `/` and `/proxy-viewer` returned HTTP 200; `/api/games` returned 208 game entries and 30 apps; the app configuration and versioned client JavaScript returned HTTP 200.
- The Games and Apps shelves rendered in the browser. The CodePen, Excalidraw, Photopea, official Venge.io, and additional FPS entries appeared in their expected lists.
- Aether Drift launched and its Begin Run and Pause controls responded.
- Veck.io loaded its official game menu inside Aether in direct mode. Venge.io loaded its official game menu and canvas. Neither check joined matchmaking or verified an account flow.
- Ultraviolet, Scramjet, and Rammerhead each opened the IANA Example Domain through their respective local routes when launched with Enter. This confirms a representative document flow, not compatibility with every site.
- With placeholder production origins and audiences, a request without an Access assertion received HTTP 401. The app origin returned 404 for an engine asset, and the proxy origin returned 404 for the shell route. A real Cloudflare Access login and token were not configured or tested.
- The Aether Originals rule suite passed 9 of 9 checks. The updater's mocked Docker regression suite passed 20 of 20 checks after correcting `Updater` state initialization and its disposable archive fixture.
- JavaScript syntax checks, updater/exporter Python compilation, catalog JSON parsing, and `git diff --check` passed. `npm audit` reports five remaining production advisories: high severity in `@rubynetwork/rh`, `ip`, and `sticky-session-custom`, and moderate severity in `@rubynetwork/rammerhead` and `uuid`. Review them before enabling public production use.

## Not verified

Remote multiplayer matchmaking, third-party accounts, mobile touch layout, all Original games, Party flows, profile persistence, real Cloudflare Access SSO in an embedded viewer, and performance under concurrent users were not verified here. Direct launch avoids Aether's HTTP proxy for WebRTC-heavy games, but it cannot change or optimize code served by the game publisher.

## Production and NAS status

No NAS, Cloudflare DNS, Tunnel, or Access configuration was changed. Production startup requires distinct HTTPS app and proxy origins plus two Cloudflare Access application audiences. Complete and validate that configuration before deploying this image. See [security and origins](SECURITY-AND-ORIGINS.md) and [build and deploy](../BUILD-AND-DEPLOY.md).
