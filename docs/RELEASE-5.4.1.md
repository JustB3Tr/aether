# Aether 5.4.1

Superseded by [5.4.2](RELEASE-5.4.2.md), which fixes the Wisp stream limiter issue found during public deployment checks. The NAS is deployed on 5.4.2.

## Changes

- Public production mode without a Cloudflare Access login. Separate app and proxy HTTPS hosts remain mandatory.
- Public web destination guard across Bare, Wisp and Rammerhead, including DNS pinning, private/reserved address rejection and ports 80/443 only.
- Bounded request, profile/recovery, session, WebSocket and proxy bandwidth limits.
- Signed HttpOnly profile sessions, cross-profile API rejection, cross-site write protection and global profile storage quotas. Existing profiles migrate; private recovery keys remain bearer credentials.
- Veck.io defaults to Rammerhead based on the user's successful load. Other engine choices and explicit remembered routes remain available. Initial remote asset loads can still be slow; successful gameplay is not implied by a page response.
- Clearer public proxy connection errors and refreshed version/cache keys.
- Rammerhead accepts Hammerhead script, charset and iframe session descriptors and requests gzip, deflate or Brotli. Unsupported upstream Zstandard HTML previously produced Chrome content-decoding failures.

## Validation in progress

67 JavaScript checks and 30 host updater checks passed. Live Linux image HTTP checks passed for saves, recovery, cookie flags, cross-profile rejection, cross-site/header rejection, app/proxy separation, Rammerhead public page loading, private/port/chaining blocks, and Wisp private stream rejection. Production image checks confirmed public mode, Secure signed cookies and app/proxy API isolation.

Veck's official page reached its lobby. The user's existing Rammerhead route completed loading, but the isolated local preview still stalled at 51-53% with Unity initialization and missing Addressables errors. The preferred route is an improvement based on that report, not a guarantee of complete compatibility. No game-specific loading overlay bypass is included.

Image, public HTTPS, release and NAS evidence will be recorded after those steps complete. Do not treat these source results as a completed deployment.
