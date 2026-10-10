# Aether 5.2.0 build and follow-up plan

**Scope:** local source changes and a Linux AMD64 image for Aether 5.2.0. This plan tracks actual readiness. It does not claim that a release, account, Cloudflare route, or NAS deployment has happened.

## Phase 1: Review the proxy boundary and startup failure

**Source work: implemented. Representative local verification: passed. Production Access verification: pending.**

- Keep the shell/profile API and untrusted proxy viewer on distinct HTTPS origins in production.
- Verify Cloudflare Access JWT signatures, issuer, audience, and time claims on HTTP and WebSocket routes.
- Keep original-game save messages scoped to the app origin; do not pass profile state to remote proxy pages.
- Repair the Rammerhead destination TLS configuration with a version-checked dependency patch.
- Treat iframe document load as a response, not proof of a working game. Offer a visible retry/alternate-engine path after the startup window.
- Route WebRTC-heavy multiplayer games to direct launch, because Aether cannot optimize code hosted by those game operators or relay browser-native peer traffic through its HTTP proxy.

**Acceptance:** Linux image builds and starts in loopback-only development mode; health, catalog, shell, Original save flow, and proxy engine boot are manually checked. Production launch remains blocked until both Access applications, origins, and audience values are configured and verified.

## Phase 2: Add game and app choices with source provenance

**Catalog work: implemented. Veck.io and Venge.io menus: reached. Matchmaking and remaining remote game checks: pending.**

- Add official Venge.io, Deadshot.io, Kour.io, Repuls.io, and War Brokers sources while retaining the existing Poki Venge option.
- Label real-time shooters for direct launch and preserve a recovery path when a destination blocks framing.
- Add CodePen, Excalidraw, and Photopea to the Apps shelf.
- Keep the catalog source notes clear that adding an official URL is not a verified Aether gameplay result.

**Acceptance:** entries appear in the rendered catalog, use the intended URL and launch mode, and do not break search, filters, favorites, or recent history. Verify remote games individually only where a real browser launch can reach the game and matchmaking.

## Phase 3: Improve the original arcade and interface

**Source work: implemented. Aether Drift start/pause: passed. Phone layout and remaining Original review: pending.**

- Add Aether Drift as a local playable arena game using the shared input, pause, restart, and score lifecycle.
- Propagate explicit and operating-system reduced-motion settings to Original games.
- Clarify Browser and Focus navigation labels and improve the phone dock and recovery card.
- Preserve the existing graphite, teal, and violet theme while improving motion and page hierarchy.

**Acceptance:** manually play Aether Drift with keyboard and touch, verify pause/restart/score lifecycle, and review navigation and reduced motion at desktop and narrow phone widths.

## Phase 4: Build and verify the image locally

**Status: built and manually smoke checked.**

1. Build with `docker build --platform linux/amd64 --build-arg AETHER_VERSION=5.2.0 -t aether:5.2.0 .`.
2. Run the loopback-only review container on port 15003 with a fresh named volume. Existing previews were left running.
3. Verify `/health`, `/api/games`, shell/viewer assets, Aether Drift start/pause, all three engine routes with a representative page, Veck.io and Venge.io menus, and fail-closed origin routing.
4. Export with `docker save`, compress the image, and verify the manifest's tag, image ID, `linux/amd64` platform, byte size, and SHA-256.
5. Upload the verified archive to the requested Drive folder and confirm the stored byte count. Full observations are in `DEPLOYMENT-5.2.0.md`.

## Phase 5: Prepare production configuration and updater policy

**Account and NAS work: intentionally not started.**

- Configure an Access application and policy for `aether.thetrademaster.trade` and a second one for `proxy.aether.thetrademaster.trade`; route both through the existing tunnel to the same container.
- Set the six production origin and Access environment values in the eventual container and mirror them in the private updater config.
- Exercise authorized and unauthorized HTTP/WebSocket requests before public use. Test the Access login path in a real browser, including first launch of the embedded proxy viewer.
- Keep image and userdata backups. The owner chose the latest three successful rollback sets on 2026-10-09; the 5.3 source implements this policy after healthy replacement, preserving failed and incomplete sets. See AUTO-UPDATES.md.
- Only after production configuration and local artifact validation, plan a separate NAS transfer and deployment window. No NAS or Cloudflare changes are part of this plan's current build step.

## Open decisions and limits

- Retention choice is resolved: keep the latest three complete successful rollback sets. This source policy still needs installation on the NAS; existing host backups were not pruned during implementation.
- Public game URLs may change, block embedding, require WebRTC, or need external login. Aether can improve catalog metadata, launch routing, and startup recovery; it cannot patch or speed up source code hosted by those game operators.
- The local development image uses one origin and does not verify production Cloudflare Access behavior. Production safety depends on configuring both origins and policies correctly.
