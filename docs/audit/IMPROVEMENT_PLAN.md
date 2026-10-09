> Public copy. UI screenshots and local runtime evidence remain in the private workspace.

# Aether 5.0.0: ranked improvement plan

**Date:** 2026-10-09. Based on [AUDIT.md](AUDIT.md). Ordered by user/security impact, not implementation effort. This auditor changed no application sources. Routine fixes already made by the implementation team are listed in the audit and are not repeated as unfinished work.

## 1. High H1: choose and enforce the deployment trust model

**Decision needed:** trusted LAN with private capability profiles, or a public multi-user service. Existing UUID possession is the access mechanism. Do not quietly describe that as an account system.

**Changes for public operation:**

1. Put shell/profile APIs and arbitrary proxied content on distinct origins. Preserve checked message sources/origins and replace assumptions that an iframe sharing the shell origin is an isolation boundary.
2. Gate HTTP and WebSocket proxy transports before Bare/Wisp/RH dispatch, with an explicit authenticated session/access policy. The profile API's present Origin checks do not gate these transports.
3. Add deliberate profile ownership and session controls for public users. Keep restore/export semantics explicit. Decide whether bearer-key import remains an opt-in recovery capability.
4. Define proxy egress policy and resource limits. Apply network rules to general transports, including WebSocket and RH resource paths; artwork's existing safe fetcher is not the general-proxy policy.
5. Document the deployed origins, gateway, TLS termination and trusted-forwarding assumptions. For trusted-LAN operation, state that scope plainly and restrict exposure accordingly.

**Files/surfaces:** `server.js`, `public/app.js`, `public/index.html`, worker configurations, Docker/deployment and README docs, reverse-proxy configuration.

**Tradeoffs:** stronger isolation affects storage, service workers, credentialless behavior and cross-frame messaging. Accounts change portability and existing UUID migration. Egress restrictions can intentionally break some remote sites. These are product/architecture choices; the overhaul request does not select a particular identity provider or public-access policy.

**Acceptance:** authorized and unauthorized HTTP/WebSocket proxy attempts behave as designed; untrusted proxy content cannot access shell/profile state across origins; existing supported Original saves and explicit restore migration continue to work. Do not claim an exploit was demonstrated by this audit.

## 2. High H2: restore RH destination certificate verification

1. Locate a maintained upstream fix or maintain a narrowly scoped, version-pinned fork/adapter that preserves TLS verification in Hammerhead request options and its HTTPS agent.
2. If that cannot be supported, make RH unavailable with honest UI copy until corrected. Remove the engine option and affected launch path consistently rather than allowing a silent failing choice.
3. Keep source preview and container environments free of global TLS-disable variables. Changing only that environment variable does not fix the installed internal false settings.
4. Preserve the storage-listener compatibility fix only while needed, with an explicit dependency-version guard.

**Files:** `package.json` and lockfile, `server.js`, proxy launch controls/copy, README/PERFORMANCE; maintained dependency source if a fork is selected.

**Tradeoff:** enforcing normal certificate validation can reject previously accepted invalid destinations. Do not reintroduce an insecure fallback to hide that behavior.

**Acceptance:** RH loads a valid HTTPS destination, rejects an invalid certificate, retains the Aether viewer and supported session behavior, and no unrelated engine/artwork trust setting regresses.

## 3. High H3: triage and replace vulnerable dependency paths

1. Preserve the current audit evidence and map each affected node to reachable RH request/session operations. The reported eight nodes include propagated chains.
2. Review maintained versions or replacements for Underscore/httpntlm/Hammerhead and UUID, with the actual call paths in view. The IP advisory lists no patched release; replacing/removing that vulnerable dependency path may be required.
3. Prefer a maintained RH dependency graph or engine replacement where upstream does not offer a safe direct update. Do not use `npm audit fix --force` as a substitute for compatibility review.
4. Reinstall from the chosen lockfile and record the remaining report with a precise reachability explanation for any intentionally accepted item.

**Files:** `package.json`, lockfile, server adapter and engine integration; dependency/deployment documentation.

**Acceptance:** resolved advisories disappear or have documented, tested mitigations; UV/Scramjet/RH launch and compression/HEAD/conditional handling still work. A clean advisory report alone is not proof of engine isolation or correct gameplay.

## 4. Medium M1: make launch recovery available after document load

1. Separate states such as preparing, document loaded, failed, and compatibility unknown. A frame load event is not proof the requested remote site works.
2. Keep retry, alternate-engine and return actions accessible from the viewer after loading, including proxy error documents.
3. Surface engine/server failure signals where available. For a cross-origin direct site, preserve an honest unknown state instead of attempting impossible DOM inspection.
4. Exercise a timeout, an engine-produced error page and a frame-blocked direct target. Keep the current successful Example Domain and Original paths.

**Files:** `public/app.js`, `public/index.html`, `public/styles.css`; `server.js` only if normalized transport failure signals require it.

**Tradeoff:** the shell cannot validate every external site's gameplay or account state. Recovery should help users without inventing a success guarantee.

## 5. Low: consistent accessibility and preferences

- **L1:** update the Focus button's accessible action/state on every route change, or remove its pressed-state semantics. Files: shell markup/controller.
- **L2:** pass explicit reduced-motion choice through the already origin/source-checked Original initialization message, applying it to decorative UI without breaking game rules. Files: controller, `public/arcade/main.js`, arcade CSS. Keep canvas/screen-reader limitations explicit.
- Review phone navigation readability with real users before replacing the working eight-route layout. Small labels alone are not a proven usability blocker.

## 6. Low: bounded operations and accurate docs

- **L3:** select backup/container/image/log retention and a free-space threshold for the private host updater. Preserve the latest known-working rollback and active named volume. Refuse an update before stopping the app if a consistent data backup cannot fit. Files: host updater/start script and AUTO-UPDATES. Retention deletion requires the administrator's chosen policy.
- **L4:** correct README: apps are in `data/games.json`; Scramjet is served from installed assets plus the generated worker. Keep the source map aligned with the repository.

## Evidence to complete with release/deployment work

These are verification gaps, not additional proven defects:

1. Keep the final source/image identities and current ten-container-check/111-file-match evidence recorded in AUDIT.md with the deployment handoff. Do not substitute earlier `BEFORE-SHELL-FIX` candidate results.
2. After native CUA input recovers, exercise final backup download/restore-file chooser, supported new-tab/popup behavior and the Party chat UI. Current static/protocol checks do not prove those native journeys.
3. Root reports the NAS container contract validated and supervisor installed. Complete and record the release-triggered boot/restart check and current-version no-op in DEPLOYMENT.md. Future new-release replacement, failed-health rollback and offline-release behavior need real-host evidence; the 20 passing mocked tests do not prove those executions. Preserve the independently reported final container restart/data survival result.
4. Keep remote claims representative. Reachability research and a loaded racing canvas do not prove 186 playable remote games.

Retain `.Codex/audit-tmp` until the accepted fixes and final deployment handoff are completed. The named audit skill's implementation step follows explicit authorization; this report itself makes no security architecture change.
