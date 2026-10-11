# Aether 5.5.1: motion throughout your orbit

## Changes

- Directional page entrances, staged heading reveals and short staggered card arrivals across all eight routes. New filter results and loaded cards use the same timing.
- More expressive button presses, navigation icons, favorites, search focus, card artwork, tool monograms and action arrows. The existing graphite, teal and violet theme remains.
- The desktop navigation marker interpolates position without animating its layout dimensions. The background shifts gently as the active page changes.
- Command search, the phone More sheet and the viewer transition in and out. Dismissal restores focus immediately; departing dialogs become inert during their fade. Reopening interrupts the transition.
- Local tool panels and game pause/result menus share the same motion style. Gameplay timing is unaffected.
- Event-driven animation scheduling, bounded stagger delays and detached-card observer cleanup. Hidden tabs cancel JavaScript effects; launching a game pauses shell CSS effects. There is no continuously running JavaScript animation loop in the shell.
- Reduced motion cancels active Web Animations and disables CSS effects. Existing Full motion and Follow device choices remain available.

## Verification

- All 19 existing launcher state, launch health and proxy viewer checks pass. An initial test failure exposed an unavailable CustomEvent in the test environment; optional motion events now guard support, matching existing page event handling.
- Browser inspection observed the 320ms page entrance, 360ms navigation marker transition and staggered heading timing. The mobile More destinations had delays of 0, 35, 70 and 105ms.
- At 390 by 844, More focus trapping worked, Settings navigation dismissed the menu, and there was no horizontal overflow. Reduced motion reported zero active animations.
- The packaged application rendered Home, Games, Apps, Party, Browser, Focus, Profile and Settings with active motion and no observed horizontal overflow or console errors.
- Command search closed on Escape, restored focus to its invoker and released the background immediately while its fade ran. The packaged viewer became hidden and inert on close, restored its launch button's focus and released the app.
- Packaged Number Lab calculated `18 * 7 = 126` on Enter and saved the result through the profile bridge.

These checks cover the motion changes and affected navigation/launch behavior. They do not claim exhaustive device, gameplay or remote proxy compatibility. The production dependency installation still reports five inherited vulnerabilities, two moderate and three high; this release does not change dependency versions.

## Build and deployment

Built locally with Docker Desktop for Linux AMD64. The final preview container is healthy, and the real Docker save archive was compressed and successfully loaded back with `docker load`.

- Archive size: **85,607,014 bytes**.
- Archive SHA-256: `272224a40d5b65e9a14d38cf6c7900792be49366e592c69fa881e685b6a3d295`.
- Image config identity: `sha256:04c9e82e7fe466b7564b92da3a88ddb9410bf1db468749a903718a41061d2870`.
- Image tag and platform: `aether:5.5.1`, `linux/amd64`.

Published [v5.5.1](https://github.com/JustB3Tr/aether/releases/tag/v5.5.1) from source commit `c66fc34d1305b768052eec0d1a2f703f9ef4c9f1`. GitHub reports all three assets uploaded; its archive digest matches the local checksum above.

Restarting the existing NAS container triggered the host updater. It downloaded at **2026-10-11 21:56:21 UTC** and installed at **21:56:32 UTC**. Docker now reports `aether:5.5.1 healthy`; public HTTPS health reports version 5.5.1. The three deployed motion files match local source SHA-256 values exactly. The public Home page shows V5.5.1, active motion and no observed horizontal overflow or console errors.

All four existing profiles matched their stopped-write backup byte for byte immediately after installation. The original `aether-data` volume remains, failed version is null and three successful rollback sets remain. The new rollback container is `aether-backup-20261011T215629332070Z`. No host reboot or forced failure recovery was exercised.
