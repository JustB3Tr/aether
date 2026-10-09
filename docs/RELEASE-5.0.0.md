# Aether 5.0.0
## Experience
New generated Aether mark and orbital home artwork, self-hosted Outfit typography, responsive navigation, teal/violet graphite surfaces, and reduced-motion support. A separate Focus page replaces the old dashboard toggle.

## Library
202 entries, including 16 original local games. Games load incrementally with search, genre chips, favorites, recent history, and sorting. Original games include snake, 2048, breakout, dodging, memory, minesweeper, tic-tac-toe, connect four, slide puzzle, Simon, reaction, color/symbol matching, word scramble, Lights Out, orbit timing, and Sudoku.
Official source targets and known access limitations are documented in docs/GAME-SOURCES.md.

## Browser
Enter submits every engine form. Launches default to the Aether viewer, with a clear option for a separate Aether tab. Heavy browser engines load on demand. Local Originals bypass the proxy.

## Performance and reliability
Async serialized profile updates preserve concurrent writes. Asset compression and conditional caching reduce transferred bytes. Catalog-known artwork is served through a bounded image cache. Room sizes, payloads, profile values, queues, and caches have limits.
Rammerhead sessions now live with persistent profile data; old node_modules sessions are not migrated automatically.
A narrow runtime adapter keeps Rammerhead's storage listener methods available, fixing a dependency startup TypeError. The installed package is unchanged; the adapted browser client supports compression and conditional caching. See docs/PERFORMANCE.md for the exact compatibility check and upgrade guard.

## Compatibility and deployment
Restart updates use a separate NAS host supervisor and public releases from JustB3Tr/aether. Release checks compare stable versions, verify SHA-256/platform/image ID, preflight the image, preserve the named userdata volume, and restore the prior image/data if replacement health fails. No Docker socket or GitHub credential is placed in the web container. Builds are local.

The existing userdata volume remains the upgrade path. Preserve it and back it up. No database schema migration is needed.
Aether does not supply account authentication. Profile keys are capabilities, party rooms are public, and remote proxy destinations have separate trust boundaries. See final audit before public deployment.
