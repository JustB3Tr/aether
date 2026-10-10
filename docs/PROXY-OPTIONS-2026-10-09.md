# Aether proxy engine review

**Reviewed:** 2026-10-09  
**Scope:** Current proxy viewer, local dependency pins, routing and origin boundaries, and maintained upstream alternatives. This is a source review, not a live test of veck.io or venge.io.

## Current engine paths

| Aether choice | Engine and transport | What it changes |
| --- | --- | --- |
| Ultraviolet | Ultraviolet 3.2.10, BareMux 2.1.9, Epoxy transport 2.1.28, Wisp 0.5.0 | Service-worker rewriting at `/service/`; the transport sends traffic through `/wisp/`. |
| Scramjet | Scramjet 2.0.67-alpha.2, controller 0.0.14, Libcurl transport 2.0.5 or Epoxy transport 3.0.1, Wisp 0.5.0 | Separate service-worker rewriting at `/service-sj/`; a selectable transport uses `/wisp/`. |
| Rammerhead | Rammerhead 1.3.6 and its Hammerhead-based server path | A different, older server-side rewrite/request path; it is a fallback, not a third modern transport for Scramjet. |

The browser setup is in [`proxy-viewer.js`](../public/proxy-viewer.js). UV registers its worker at `/uv/sw.js` with scope `/service/`; Scramjet registers `/scramjet-sw.js` with scope `/service-sj/`. Scramjet loads either its Libcurl client or Epoxy 3 ESM module, while UV retains Epoxy 2. The server explicitly allows those paths on the proxy origin and denies them on the app origin. All three Wisp-backed choices use `wss://<proxy-host>/wisp/` in production, matching the server's Wisp upgrade route.

Rammerhead creates a session at `/newsession`, then navigates to a session path. The current install also pins `testcafe-hammerhead` 31.7.8 and applies a narrow TLS patch at install time in `tools/patch-hammerhead-tls.mjs`. That keeps certificate verification enabled. A site with an invalid or incomplete certificate chain may stop working through Rammerhead after this fix, which is the correct security outcome rather than a routing regression.

## Why a game can sit on its loading screen

An iframe `load` event only says that a document navigation completed. It does not mean the game's JavaScript, WebAssembly, graphics setup, matchmaking, or socket handshake succeeded. Aether has no trusted game-ready signal for arbitrary third-party sites. The viewer's `engine-ready` status means the proxy machinery initialized; `document-loaded` means the iframe returned a document. Aether no longer turns a 35-second lack of detected input into a launch failure; the toolbar offers route changes without obstructing a working session. Neither says that a game is playable.

For Veck, the source alone cannot identify the failing request. A DevTools network trace is needed to distinguish a service-worker route failure, a blocked/missing game asset, a Wisp connection failure, a site-side bot/region check, a WebGL error, or a game-specific real-time protocol problem. Wisp can carry TCP/UDP streams for clients that use the proxy transport. It does not automatically capture browser-native `RTCPeerConnection`, WebTransport, or other game networking APIs. Adding another rewrite engine would not make those APIs proxy themselves.

## Options considered

### 1. Scramjet with Epoxy transport 3: integrated alternate transport, not another engine

The maintained upstream Scramjet demo explicitly switches between Libcurl and Epoxy transports. Scramjet's current bootstrap source pins the Scramjet-compatible Epoxy major to 3 and Libcurl major to 2. Aether uses Libcurl 2 for Scramjet and Epoxy 2.1.28 for UV, so the UV package must not simply be reused as Scramjet's transport. Epoxy 3 needs its own package alias and static asset path.

Aether 5.3.0 now pins `@mercuryworkshop/epoxy-transport-v3` to the upstream `@mercuryworkshop/epoxy-transport@3.0.1` package alias. Its browser module is served from `/epoxy-v3/index.mjs`; the separately pinned UV Epoxy 2 route stays at `/epoxy/`. Scramjet accepts `transport=epoxy` or `transport=libcurl`, defaulting to Libcurl when the parameter is absent. Epoxy 3's ESM bundle is 1,745,144 bytes before HTTP compression. The viewer constructs the module default export with `{ wisp }`, then passes it to the existing Scramjet `Controller`.

This provides a second Wisp-backed HTTP/TLS implementation. It may help if a particular game's requests behave differently under Libcurl. It still shares the same Wisp relay, uses the same Scramjet rewriter, and does not solve native WebRTC/WebTransport or site-specific restrictions. It is an alternate route to compare when a trace points to an HTTP/TLS transport failure, not a guaranteed Veck fix.

### 2. Scramjet with Bare transport: a real alternate route with a trust tradeoff

Scramjet's current upstream transport interface includes a Bare option, and the official `bare-transport` package connects to a TompHTTP Bare server. Aether already has a Bare server mounted at `/bare/`, but it does not currently serve the `bare-transport` browser client. Wiring it would require a new pinned package and a separate static client path. It would avoid Wisp for ordinary HTTP requests, so it could be useful if the Wisp WebSocket cannot connect.

This is not a safe blind compatibility upgrade. Bare moves target requests through the Aether server's TLS/request stack, so the server can inspect target traffic, and it does not provide Wisp's UDP stream path. Bare's WebSocket protocol is a separate capability and would need an end-to-end game check before anyone labels this route multiplayer-ready. It is a targeted fallback to test, not a general fix for FPS loading.

### 3. Corrosion: reject

Corrosion is the old TitaniumNetwork engine. Its upstream repository is archived and says it was superseded by Ultraviolet. Adding it would mean shipping another stale rewrite implementation with overlapping behavior. That is a new menu label, not a credible compatibility gain.

### 4. ChemicalJS or another wrapper: reject as a new engine

A wrapper can unify how existing engines are selected, but it does not create new page rewriting or network capabilities. Aether already selects UV, Scramjet, and Rammerhead directly. Adding a wrapper would increase integration surface without addressing Veck's unknown failure.

## Recommendation

Do not add more engine labels. Aether has three materially different engine paths and now offers Epoxy 3 as an alternate Scramjet transport. A second label with no genuinely different rewrite or transport path would be bullshit menu clutter. First capture Veck's failure in DevTools and compare UV, Scramjet/Libcurl, and Scramjet/Epoxy. Consider Bare only if Wisp cannot connect and its traffic-visibility tradeoff is acceptable. Keep a direct launch option for games whose networking depends on browser-native real-time APIs.

The production split between the Aether app host and proxy host remains useful: engine routes and profile APIs are separated, and the server checks Cloudflare Access on HTTP requests and WebSocket upgrades (`server.js:135-144, 1084-1088`). Service workers remain bound to the proxy host, which is required for these routes to work. One limitation remains inside that proxy host: the viewer embeds rewritten content in an iframe with both `allow-scripts` and `allow-same-origin` (`proxy-viewer.html:14`), and the rewritten URL stays on the proxy origin. That does not give untrusted game content the app origin or its profile API, but it does mean the viewer itself is not origin-isolated from the proxied document. Keep secrets and profile endpoints off the proxy host; do not describe the iframe sandbox as a separate-origin boundary.

### Viewer isolation correction in 5.3.0

The two-origin loopback check confirmed two document-policy gaps. `/proxy-viewer` returned before the generic Express header middleware, and the app had not delegated the `cross-origin-isolated` permission to the proxy host. The outer viewer and its rewritten child can both be blocked when their document policies do not match the isolated parent.

The viewer route now explicitly sends COEP `require-corp`, COOP `same-origin`, CORP `cross-origin`, and CSP `frame-ancestors` restricted to the configured app origin. App responses delegate `cross-origin-isolated` only to self and the exact configured proxy origin, and the outer iframe permits that feature for its source. The outer frame keeps normal cookie handling for Access. Rammerhead's separate destination-header hook now preserves compatible COEP, with a dispatcher fallback for service/error responses that do not pass a header object.

After the permission fix, Scramjet/Epoxy rendered a representative HTTPS page inside the two-origin loopback viewer. The final Docker response checks also confirmed the scoped headers, app-to-engine and proxy-to-profile 404 boundaries, and Rammerhead HTML rewriting with COEP. These observations do not verify production Access login, WebSocket authorization, or arbitrary game startup. The resumed browser connection became unavailable before the remaining live route and phone checks could finish.

The browser rules are documented in [Chrome COEP guidance](https://developer.chrome.com/blog/coep-credentialless-origin-trial), [W3C Permissions Policy inheritance](https://www.w3.org/TR/permissions-policy/), and the [HTML COEP navigation check](https://html.spec.whatwg.org/multipage/browsers.html#check-a-navigation-response%27s-adherence-to-its-embedder-policy).

## Small manual verification sequence

Use a two-origin staging configuration, not the NAS deployment. A same-origin local run will not exercise the app-to-proxy COEP boundary:

1. Open DevTools with Preserve log enabled. Confirm the app can embed `/proxy-viewer` from the proxy host without a COEP navigation violation, and inspect the actual response headers. Confirm Cloudflare Access succeeds for the proxy host and its WebSocket upgrade.
2. Launch a simple HTTPS page through UV. Confirm the frame requests use `/service/`, the UV worker is active for that scope, and `/wisp/` upgrades to HTTP 101.
3. Launch the same page through Scramjet with `transport=libcurl`, then with `transport=epoxy`. Confirm `/service-sj/`, `/scramjet-sw.js`, the selected transport asset (`/libcurl/index.js` or `/epoxy-v3/index.mjs`), and the Wisp upgrade.
4. Launch Veck through UV, Scramjet/Libcurl, and Scramjet/Epoxy separately. For each, inspect the first failed document, JavaScript, WASM, WebSocket, or console request. Compare the failure stage; a Wisp 101 alone does not prove that Veck's game session connected.
5. If the page becomes cross-origin after a redirect, confirm that Aether removes its startup cover and records a document response. That is still not a game-ready signal. If the game remains stuck, use the toolbar's alternate engine control or Original site link and record which path succeeds.

## Upstream sources

- [Ultraviolet upstream](https://github.com/titaniumnetwork-dev/Ultraviolet) identifies Scramjet as its successor.
- [Scramjet upstream](https://github.com/MercuryWorkshop/scramjet) describes the engine as experimental; its [release page](https://github.com/MercuryWorkshop/scramjet/releases) includes 2.0.67 alpha releases and a continuous build.
- The official [Scramjet demo](https://github.com/MercuryWorkshop/scramjet/blob/main/packages/demo/src/index.tsx) selects Libcurl or Epoxy for the same controller. Its [transport version pins](https://github.com/MercuryWorkshop/scramjet/blob/main/packages/bootstrap/src/common.ts) specify Epoxy 3, Libcurl 2, and Bare as supported transport choices.
- [Epoxy transport](https://github.com/MercuryWorkshop/epoxy-transport) describes its Wisp and Epoxy-TLS transport; [Wisp JS](https://github.com/MercuryWorkshop/wisp-js) documents TCP and UDP streams.
- The official [Bare transport](https://github.com/MercuryWorkshop/bare-transport) uses a TompHTTP Bare server. The [TompHTTP Bare server](https://github.com/tomphttp/bare-server-node) is the upstream server implementation; its [v3 specification](https://github.com/tomphttp/specifications/blob/master/BareServerV3.md) defines ordinary HTTP forwarding and a separate WebSocket tunnel. The server sees the HTTP request/response content, and this protocol does not add Wisp UDP streams.
- [Corrosion upstream](https://github.com/titaniumnetwork-dev/Corrosion) is archived and describes itself as succeeded by Ultraviolet.
- [TitaniumNetwork's project list](https://github.com/titaniumnetwork-dev) currently classifies Scramjet and Ultraviolet as active backend proxies, Rammerhead as affiliated, and Corrosion as old.
