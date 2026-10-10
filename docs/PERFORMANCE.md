# Aether v5 backend performance and reliability

Reviewed and checked on 2026-10-08. This document covers `server.js`, its profile JSON files, HTTP delivery, proxy integration, and Party transport. The UI, game implementations, catalog verification, Docker build, and final application audit are separate checks.

## Run and storage

Use Node.js 22 or the supplied Linux Docker image. Install the locked dependencies with `npm ci --omit=dev`, then run `npm start`. The server binds to `0.0.0.0` inside its host/container. Restrict the Docker published port to `127.0.0.1` for a local preview.

| Setting | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP, proxy, and WebSocket listener |
| `USERS_DIR` | `userdata` beside `server.js` | UUID profile JSON files and default proxy session directory |
| `RAMMERHEAD_SESSIONS_DIR` | `USERS_DIR/rammerhead-sessions` | Override persistent Rammerhead session files |
| `RAMMERHEAD_LOG_LEVEL` | `warn` | Rammerhead log level |

In Docker, mount a writable persistent volume at `/app/userdata`. The existing `<uuid>.json` profile format is retained. New Rammerhead sessions now live beneath the same volume:

```text
userdata/
  <uuid>.json
  rammerhead-sessions/
    <session-id>.rhfsession
```

Previous images stored Rammerhead sessions inside the dependency directory. That old cache is not automatically migrated. The new directory was checked with a session that survived a full application process restart. Existing profile JSON files do not move.

## HTTP delivery

- The catalog is parsed once at startup, serialized once, and precompressed as gzip and Brotli. `/api/games` returns a stable content-derived weak ETag, `Vary: Accept-Encoding`, and `public, max-age=300, stale-while-revalidate=3600`. Matching conditional requests return 304. Catalog changes require an application restart.
- Static JavaScript, CSS, SVG, JSON, and WASM files between 512 bytes and 8 MiB are compressed asynchronously when requested. Concurrent requests for the same file/encoding share one compression operation. Subsequent requests reuse a compressed buffer until the file size or modification time changes.
- The static compression cache holds at most 96 entries and 16 MiB of compressed content. It never buffers dynamic proxy traffic. Range requests use ordinary static delivery. HEAD and conditional requests are supported.
- HTML and service worker scripts revalidate with `no-cache`. Static requests with `?v=<current package version>` can use a one-year immutable cache. Other local assets use a one-hour cache. The UI must change its version query when shipped asset contents change.
- `/uv/sw.js` and `/scramjet-sw.js` retain the `/` service worker scope. The shell and its assets retain isolation headers needed by the proxy transports. API JSON and health responses omit document isolation headers. No global restrictive CSP is added to proxy content.
- Static assets, the catalog, room list, and health response no longer create an otherwise unused profile cookie. Profile APIs remain `no-store`. JSON request parsing is confined to `/api` and rejects bodies larger than 4 MiB.
- API and Party WebSocket requests carrying an `Origin` header must match the current request origin. An absent Origin remains supported for native clients. The origin uses the request Host and the first validated `x-forwarded-proto` value, so a trusted HTTPS reverse proxy can preserve its public origin.
- Keep-alive is 65 seconds, with a 70-second header timeout. No special short response timeout is imposed on large proxy transfers.

Do not let untrusted callers choose a reverse proxy's forwarded headers. HTTPS and access control remain the operator's reverse proxy responsibilities.

## Catalog artwork and isolated documents

External images frequently omit headers needed by an isolated shell. Remote game and app logos can use the same-origin endpoint `GET /api/artwork?url=<encoded catalog logo URL>`; local artwork paths remain ordinary static files. This endpoint is not an arbitrary URL fetcher. Its allowlist consists only of canonical remote `logo` URLs found in the startup games/apps catalog.

Each upstream request validates the URL's protocol, standard HTTP(S) port, and absence of credentials. DNS answers must all be public addresses, and the connection lookup is pinned to those checked addresses. Every redirect repeats these checks, with at most three redirects and no HTTPS downgrade. Private, loopback, link-local, multicast, reserved, documentation, and IPv6 transition address ranges are rejected. The conservative address rules were checked against the current [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry) and [IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry).

Artwork fetches use explicit TLS certificate verification, a 15-second deadline including queue time, eight concurrent fetches, and a 64-request shared queue. Identical concurrent URLs share one fetch. The body, including decompressed content, cannot exceed 5 MiB. Supported image MIME types must agree with their PNG/JPEG/GIF/WebP/AVIF/ICO/SVG signatures. SVG documents containing entity or doctype declarations are rejected; artwork responses carry a sandbox CSP, `nosniff`, and same-origin CORP so an opened SVG cannot run scripts with the Aether origin.

Successful artwork is cached in memory for 24 hours with limits of 256 items and 32 MiB. Failures are remembered for one minute in a separately bounded cache. Browser responses use a content-derived ETag, public one-hour caching, and 304 revalidation. The endpoint creates no profile cookie. Only requested artwork is fetched; the server does not eagerly download the entire catalog. Full source images are not resized, so large upstream art can still cost more bytes than a dedicated thumbnail. The browser should use lazy image loading and an intentional fallback when an upstream source is unavailable.

## Profiles and saves

The profile model remains a UUID capability model: knowing a UUID grants access to its profile. `gp_uid` remains a JavaScript-readable, SameSite=Lax cookie. HTTPS requests set the Secure cookie flag. UUID import and the existing UID overrides remain compatible; these are not login or ownership checks.

Profile file reads and writes are asynchronous. Read results are cached for 30 seconds, capped at 128 profiles and 16 MiB of serialized profile data. Concurrent reads share the same disk operation. Updates are serialized per UUID, preserving independently submitted saves instead of overwriting each other's changes.

Writes serialize the complete next profile to a uniquely named temporary file in the same directory, then atomically rename it over the profile. A write failure returns 503 rather than reporting success. Corrupt or invalid existing profile files also return 503 and are left in place, so a later save cannot silently replace damaged data with an empty profile. Atomic replacement prevents a reader from seeing a half-written JSON document; it is not a guarantee against power loss without filesystem durability controls.

Validation limits:

| Item | Limit |
| --- | --- |
| JSON request body | 4 MiB |
| One save key | 1 to 256 characters; no control characters or reserved prototype keys |
| One save value | 2 MiB serialized JSON |
| Total profile | 8 MiB serialized JSON |
| Save keys in profile or batch | 2,000 |

Keys such as `aether.arcade.<id>`, namespaced remote keys, and `__meta__...` metadata remain supported. Batch bodies must be objects. Profile responses add `saveCount` and `metadataCount`; the visible game count excludes `__meta__` entries. Deleting the `_other` group now deletes uncategorized saves while preserving metadata. These limits reject oversized requests; they do not truncate data silently.

Health checks reuse an asynchronous directory count for 30 seconds instead of blocking the event loop with a synchronous directory scan on every check. A profile directory read failure makes `/health` return 503. A healthy response confirms directory access, not the integrity of every individual saved profile.

## Actual save bridge

The previous `buildSDK()` and `injectSDK()` functions were never mounted on any route. They therefore did not inject a cloud-save SDK into arbitrary proxied games. Their unused response interception was removed rather than attaching it to streaming proxy responses.

The operative bridge is the browser's `gp-init`, `gp-save`, `gp-save-batch`, and `gp-delete` message flow. The v5 frontend must verify the message source is the active game frame, validate messages, check API response status, and send `gp-save-result` or `gp-delete-result` with `requestId`, `ok`, and an error when needed. Original local games can wait for this acknowledgement. A game's optimistic local write is not proof that its server save succeeded.

External games that do not cooperate with the bridge do not automatically gain server saves. Source validation also does not create an isolation boundary for untrusted content running with the same origin as the shell. The final browser audit must confirm the local games' acknowledgement flow and honest success/failure status.

## Proxy integration

Bare HTTP/upgrade routes, Wisp upgrades, and most Rammerhead HTTP/upgrade routes are dispatched before Express. They bypass catalog, JSON parsing, and static compression. The narrowly adapted `/rammerhead.js` client route is served through Express as described below. The Rammerhead origin override preserves the actual request port and public HTTPS scheme instead of depending on an untrusted browser origin cookie.

Rammerhead's default script rewrite cache permitted a 5 GiB disk cache and performed synchronous file reads and writes. v5 uses a correct in-process LRU cache with a 32 MiB content budget and a 2,000-entry limit. Session persistence is separate. The dependency's supplied memory cache has a missing return in its `get()` method, so it was not used.

### Rammerhead client storage compatibility

The installed MIT dependency `@rubynetwork/rh@1.2.76` contains a startup bug in `src/client/rammerhead.js`. Its `main()` runs `fixCrossWindowLocalStorage()` before setting up storage synchronization. The new storage Proxy passes through only `internal`, `clear`, `key`, `getItem`, `setItem`, `removeItem`, and `length`. A later call to `proxiedLocalStorage.addChangeEventListener()` therefore receives an undefined storage value instead of Hammerhead's method and throws a TypeError. The matching Hammerhead implementation does contain the method. This is a dependency wrapper mismatch, independent of the site's target URL or Aether's parent frame.

At startup, Aether reads the dependency's supplied minified client once and replaces exactly one known reserved-method list with the same list plus `addChangeEventListener` and `removeChangeEventListener`. An absent or ambiguous marker stops startup with a clear compatibility-review error. No files in `node_modules` are edited, and the installed dependency, package metadata, and license remain intact. Review this adapter when upgrading Rammerhead; do not silently broaden its replacement pattern.

`GET` and `HEAD /rammerhead.js` use this in-memory client before the generic Rammerhead dispatcher. The response has JavaScript MIME, same-origin CORP, `no-cache`, `Vary: Accept-Encoding`, and an encoding-specific content ETag. Gzip and Brotli buffers are computed once. Conditional requests return 304. The adapter changes only those two method names; it does not disable storage synchronization or change proxy destination handling.

An isolated test of the exact Express route verified identity, gzip, Brotli, HEAD, conditional 304, and equality to the original client with only the expected replacement. A focused storage Proxy test confirmed both listener methods remain callable. The complete embedded browser flow is checked separately by the application audit.

Rammerhead session I/O is still implemented synchronously by the installed dependency. Its cleanup, retention rules, certificate handling, and compatibility need separate review before changing the proxy library. The currently installed Hammerhead dependency sets `rejectUnauthorized: false` for destination requests. During the local Node checks, the PC also inherited `NODE_TLS_REJECT_UNAUTHORIZED=0`; this environment value was not introduced by the v5 work. Do not describe these checks as verification of destination TLS certificate trust. Check the final Docker environment separately.

## Party transport

Party rooms remain process-local. Restarting the server clears room state and chat history. This transport shares submitted state; it does not turn unrelated third-party games into multiplayer games.

- The WebSocket route is exactly `/ws`; unrelated `/ws...` paths are rejected.
- Maximum WebSocket message size is 256 KiB; shared state must be an object smaller than 128 KiB.
- Capacity is 500 connected Party clients, 250 rooms, and 32 members per room.
- A client can send at most 80 messages in a 10-second window. Chat text is capped at 500 characters, names at 24, and room names at 40.
- Chat retains 100 entries per room. Empty rooms expire after ten minutes. Rejoining cancels the prior cleanup timer, so an old timer cannot delete an active reused room.
- Slow connections with more than 512 KiB queued for delivery are closed rather than accumulating an unbounded send backlog. Send errors and dead connections are handled; heartbeat checks run every 30 seconds.
- State publishers receive `state-published` only after the server accepts the state. Invalid requests receive a structured `error` with `code` and `message`. The browser should show these outcomes rather than announcing an unchecked publish.

## Backend route trace for the final audit

| Route | Flow and persistence |
| --- | --- |
| `GET /api/games` | Startup catalog buffer, encoded cache, public HTTP cache; no profile cookie |
| `GET /api/artwork?url=...` | Exact catalog logo allowlist, DNS-pinned public upstream, bounded validated image/cache; no profile cookie |
| `GET /api/user` | Cookie or explicit UUID, async profile read; adds visible/metadata counts |
| `POST /api/save` | Validated key/value, per-UUID queue, atomic profile replacement |
| `POST /api/save-batch` | Validated object/bounded values, one atomic update |
| `GET /api/load/:key` | Validated key and profile, own saved value or null |
| `DELETE /api/save/:key` | Active profile, validated key, atomic update |
| `GET /api/saves-by-game` | Active profile grouped by namespace; metadata excluded |
| `DELETE /api/saves-by-game/:host` | Active profile group removal, including `_other`; metadata preserved |
| `DELETE /api/user` | Atomically clears active profile saves; UUID retained |
| `POST /api/import` | Valid UUID capability switches cookie; creates missing profile |
| `GET /api/rooms` | Current in-memory room metadata, latest 50 |
| `GET /health` | Cached async profile-file count and current room count; unavailable storage is 503 |
| `GET /`, local static files | Shell, game files, styles/scripts/art; static cache/compression and isolation |
| `/uv/`, `/baremux/`, `/epoxy/` | Local UV config/worker and installed engine assets |
| `/scramjet/`, `/controller/`, `/utils/`, `/libcurl/` | Installed second engine and transport assets |
| `GET /scramjet-sw.js` | Revalidated controller service worker, root scope |
| `/bare/`, `/wisp/` upgrades | Proxy network transports before Express |
| Rammerhead management/session routes | Dependency router before Express; session files in persistent userdata |
| `/ws` upgrade | Origin-checked Party transport, bounded in-memory rooms/state/chat |
| Unknown `/api` route, parse/storage errors | JSON error status; no false `{ok:true}` response |

## Checks and measured transfer sizes

An isolated Node instance used port 13105 and a disposable `.Codex/audit-tmp/backend-v5-test-userdata` directory. No NAS, Drive, deployed profile, or production volume was used.

Passing checks:

- Syntax and startup, health, unknown API JSON errors, malformed input/UIDs, foreign-origin rejection, and trusted forwarded HTTPS origin acceptance.
- Catalog identity/gzip/Brotli payload equality, ETag 304, and no catalog cookie.
- Static MIME type, compressed payload integrity, HEAD/304, versioned immutable cache, service worker revalidation/scope, and installed UV/controller/Libcurl assets.
- Twenty-four simultaneous updates to one disposable profile retained all 24 keys. Save/batch/load/delete/import worked, metadata counts matched, and persisted JSON was valid.
- Oversized values and request bodies were rejected. A deliberately corrupt disposable profile returned 503 on both read and attempted save and remained byte-for-byte unchanged.
- Two Party clients joined the same room and checked membership, chat, state delivery, publisher acknowledgement, invalid-state error, and leave notification.
- Rammerhead returned rewritten Example Domain HTML with its browser bootstrap, preserved the local port, and rewrote a script resource on initial and repeated requests. A disposable session survived process restart and was removed afterwards.
- Final v5 artwork checks against the expanded catalog loaded an actual remote AVIF logo with 200 and same-origin CORP, then returned 304 for its matching ETag. Loopback, link-local metadata, arbitrary noncatalog URLs, file URLs, and nonstandard ports were rejected before fetching.
- Isolated upstream checks exercised private/reserved IPv4 and IPv6 addresses, mixed public/private DNS answers, a public URL redirecting to loopback, pinned lookup, explicit certificate verification, a fake PNG MIME response, an oversized declared body, a compressed body expanding past 5 MiB, an expired queued request, and SVG entity rejection. These checks confirmed no connection was made to a disallowed redirect address.

Early baseline measurements, before the final catalog and UI edits:

| Asset | Uncompressed bytes | Compressed bytes | Encoding |
| --- | ---: | ---: | --- |
| Existing catalog | 9,678 | 2,678 | gzip |
| Existing stylesheet | 53,842 | 11,579 | Brotli |
| Installed Scramjet WASM | 586,279 | 208,854 | gzip |

These are measured transfer byte counts, not a claim about whole-page rendering time or a guarantee of real-site proxy compatibility. Update final catalog/UI figures after the v5 build is complete.

At the first v5.0.0 preview restart, the catalog contained 202 games and 27 apps. The expanded catalog measured 147,502 bytes uncompressed and 21,633 bytes with gzip. The new stylesheet at that moment measured 33,418 bytes uncompressed and 8,412 bytes with Brotli. Later UI or catalog edits may change these figures; they are a recorded preview snapshot, not a frozen build artifact.

## Remaining audit risks

The UUID capability model, public proxy exposure, same-origin untrusted game content, dependency advisories, destination certificate validation, and process-local Party persistence remain material concerns. No dependency was upgraded automatically. Input bounds and origin checks improve robustness but are not authentication, authorization, a proxy destination allowlist, or deployment access control. Browser gameplay, touch/keyboard controls, bridge failure messages, real game compatibility, reduced-motion behavior, and final Docker/runtime checks belong in the completed app audit.

## 5.4 arcade loading measurement

On 2026-10-10, the local 5.4 Docker preview served the initial arcade JavaScript bootstrap in **8,421 gzip bytes**, compared with **30,829 bytes** in the retained 5.3 preview, a **72.7% reduction**. The measured files include the shared lifecycle, lazy loader and definition modules. Each renderer family and its rules module load when selected. This measures transfer before the selected renderer, not the full game, styles, fonts, whole-page speed, or remote game performance. Raw per-file measurements are in `.Codex/launch-5.4/runtime.json`.

The 5.4 catalog contains 228 games and 41 apps and transfers in 27,711 gzip bytes (175,338 uncompressed). Both new game modules and covers returned HTTP 200 with gzip from the built container. Driftline bounds its smoke/trail collections and caches the circuit drawing; Pulse Arena caps entities, shots, particles and hazards. Both cap canvas DPR at two and update DOM HUD values at 10 Hz. These implementation bounds are not a measured frame-rate guarantee on every device.

Production requirements have changed since the historical backend review above: the current image requires separate HTTPS app/proxy origins and Cloudflare Access audiences, and rejects destination certificate bypasses. Refer to [security and origins](SECURITY-AND-ORIGINS.md) and [5.4 release notes](RELEASE-5.4.0.md) for current requirements and the local versus production verification boundary.
