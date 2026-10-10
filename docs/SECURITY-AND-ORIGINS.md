# Public Aether origins and access

The production image fails closed unless Aether has two distinct HTTPS origins and Cloudflare Access protects both. The main app and profile API belong on the app origin. Ultraviolet, Scramjet, Rammerhead, their service workers, and their WebSocket transports belong on the proxy origin. A proxied page can reach its own proxy origin, but that origin does not serve Aether's shell or profile API.

This source change does not alter Cloudflare DNS, Tunnel routes, Access applications, or the NAS. The deployed v5.1 image remains separate from this source until a new image is deliberately installed.

## Suggested hostnames

| Purpose | Origin |
| --- | --- |
| Aether app and profile | `https://aether.thetrademaster.trade` |
| Isolated proxy viewer and engines | `https://proxy.aether.thetrademaster.trade` |

The proxy hostname must resolve through Cloudflare and route through the existing Tunnel to the same Aether container port. It must have its own Access application and policy. Protect the app hostname separately with its own Access application. Match the intended users in both policies. The Cloudflare Access team domain can be found in the Zero Trust dashboard; each application provides its own audience tag.

## Container environment

Set these values on the production container:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `AETHER_APP_ORIGIN` | `https://aether.thetrademaster.trade` |
| `AETHER_PROXY_ORIGIN` | `https://proxy.aether.thetrademaster.trade` |
| `AETHER_ACCESS_TEAM_DOMAIN` | Cloudflare Access team hostname, without `https://` |
| `AETHER_APP_ACCESS_AUDIENCE` | Audience tag from the Aether Access application |
| `AETHER_PROXY_ACCESS_AUDIENCE` | Audience tag from the proxy Access application |

The server verifies each `Cf-Access-Jwt-Assertion` signature against Cloudflare's published keys, then checks the issuer, audience, expiry, and not-before claim. It validates regular HTTP requests and WebSocket upgrades before proxy transports run. The assertion keys are cached for ten minutes and refreshed on key rotation. A missing, invalid, or expired assertion is rejected. The container's loopback `/health` check remains available to Docker without an Access token.

The two origin settings are also injected into the shell and isolated viewer. Production requests for engine resources on the app origin return 404. Requests for the shell, profile, or party APIs on the proxy origin return 404. Original games continue to load on the app origin and remain the only games allowed to use Aether's profile save bridge. Third-party sites keep their own browser storage on the isolated proxy origin.

## Restart updater

The restart updater validates the container environment against its private config before replacing an image. After configuring the production container, update that private updater config's `env` list with the exact six values above. Keep the audience strings and hostname values out of public release files. Review the updater's config validation before enabling automatic replacement; an environment mismatch intentionally stops the update for review.

## Local development

Local source and Docker previews can run with `NODE_ENV=development` and no origin or Access settings. The engines use the same local origin in that mode. Do not expose this development configuration to the Internet. The production boundary is only active when the production environment is configured and the matching Cloudflare Access applications are actually in place.
