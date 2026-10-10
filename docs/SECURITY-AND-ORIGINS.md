# Public Aether origins and safeguards

v5.4.1 is public by default. Visitors need no Cloudflare Access account or login. Cloudflare Tunnel publishes the two HTTPS hostnames; Access is an optional private deployment mode.

## Production environment

| Variable | Public deployment |
| --- | --- |
| `NODE_ENV` | `production` |
| `AETHER_ACCESS_MODE` | `public` (default) |
| `AETHER_APP_ORIGIN` | `https://aether.thetrademaster.trade` |
| `AETHER_PROXY_ORIGIN` | `https://aether-proxy.thetrademaster.trade` |
| `AETHER_TRUSTED_PROXY_IPS` | Exact IP addresses of the tunnel connector as seen by the container, comma separated |

Both hostnames route to the same Aether port. The app host serves the shell, Originals, party and profile API. The proxy host serves the separate viewer, engines, service workers and transports. It cannot serve the shell or profile APIs. Engine paths return 404 on the app host. A first-level proxy subdomain works with the normal Cloudflare wildcard certificate. Production fails closed if HTTPS origin separation is missing.

Only exact trusted peers may supply `X-Forwarded-Proto` and `CF-Connecting-IP`; loopback peers are trusted by default. Do not trust entire LAN ranges. An incorrect connector IP fails origin validation rather than treating spoofed forwarding headers as authoritative.

## Destination and resource limits

All engines are limited to public HTTP/HTTPS/WebSocket destinations on ports 80 and 443. Loopback, LAN, link-local, cloud metadata, reserved, transition IPv6, and the configured Aether hosts are blocked. DNS answers are checked together; mixed public/private answers fail closed. Bare and Rammerhead connections use pinned validated DNS addresses. Rammerhead HTTP2 is disabled because that dependency's HTTP2 path bypasses the lookup hook. External proxy chaining is disabled. Wisp disallows literal IP destinations and UDP and resolves hostnames through the same guard.

- Per IP: HTTP burst 400, refill 20 requests/second; save writes burst 30, refill 1/second.
- Profile creation: burst 6, refill 10/minute; recovery attempts: burst 3, refill 5/minute.
- Rammerhead session creation: burst 6, refill 10/minute per IP; global burst 30, refill 100/minute.
- Global HTTP burst 2,000, refill 200/second. Rate tables hold at most 10,000 IPs and fail closed when full.
- WebSocket upgrade burst 10, refill 20/minute; maximum 16 connections/IP and 256 globally. Connections expire after one hour and idle sockets close after five minutes.
- Wisp: maximum 64 streams/connection and 16 streams/destination, 1 MiB WebSocket message limit.
- Proxy output: 32 MiB burst/IP, refill 10 MiB/second; global 128 MiB burst, refill 50 MiB/second. Upgraded socket input: 16 MiB burst/IP, refill 4 MiB/second. Limit breaches close the response/connection.
- Profiles: 8 MiB/profile, 2 MiB/save value, 2,000 keys; global 512 MiB and 10,000 profiles. Writes are serialized and atomic. Full storage rejects new writes while retaining existing saves.
- Rammerhead sessions: new creation stops at 5,000 files or 1 GiB observed storage; size is sampled once/minute. Existing sessions can grow between samples, so this is a creation safeguard, not a filesystem quota. Sessions idle for a day expire, with a seven-day maximum lifetime.

These controls reduce abuse. Public access can still be abused by many clients or distributed traffic; monitor resource use and retain the option to restrict access if needed. The public container receives no Docker socket or host update credentials.

## Profiles and recovery

Profiles remain anonymous. Signed, HttpOnly, SameSite=Strict cookies identify the current profile. HTTPS uses the host-only `__Host-aether_session` cookie. Existing `gp_uid` profiles migrate on first use; keep userdata, including `.session-secret`, across restarts and backups.

Save/read endpoints reject a different requested profile UUID. Mutations require same-origin requests and `X-Aether-Request: 1`; cross-site browser requests are blocked. Profile recovery only accepts an existing profile key and is rate limited. The displayed recovery UUID remains a private bearer key: anyone holding it can restore that profile. This is not password authentication. Do not share recovery keys or include them in screenshots.

## Optional Cloudflare Access

For a private deployment only, set `AETHER_ACCESS_MODE=access`, `AETHER_ACCESS_TEAM_DOMAIN`, `AETHER_APP_ACCESS_AUDIENCE` and `AETHER_PROXY_ACCESS_AUDIENCE`, and configure matching Access applications/policies for both hosts. Access mode refuses incomplete configuration and verifies signed assertions before HTTP or WebSocket routing. Public mode does not require or verify Access assertions.

## Updater and development

The host updater's private `env` list must exactly match the production values above. A mismatch stops replacement. Keep the latest three successful rollback sets. Local previews may use `NODE_ENV=development`, bound to loopback, without production origin settings. Do not publish a development preview.
