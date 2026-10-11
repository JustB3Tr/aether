# Aether 5.5: play, make, find

## Scope

Preserve the current visual theme, proxy origin isolation and profile ownership rules.

- Three local Originals: Rail Rush (lane runner), Ricochet Relay (bank-shot score attack), Skybound (vertical platform jumper). Keyboard and touch controls, pause/restart, real scoring and existing profile best-score saves.
- Three local tools: Study Deck (editable flashcards and practice), Sketchpad (drawing, undo and PNG export), Number Lab (safe expression calculator and unit conversion). Open inside Aether or in its own Aether tab; tool data remains scoped to its own profile save key.
- Game collections for instant play, racing, action, puzzles, favorites and recent play. Useful app collections and local-tool filtering.
- Five primary mobile destinations with an accessible More menu for secondary routes. Keep desktop navigation labels and all current routes reachable.
- Preserve each page's browsing position; preserve filters during navigation; make library shortcuts and search easier to find. Continue-playing content belongs near the top of Home.
- Animate route changes and the active navigation marker; provide responsive card feedback and bounded, one-time entrance motion. Honor device and Aether reduced-motion preferences. No scrolling takeover or continuous idle JavaScript loop.

## Evidence required

Inspect the rendered desktop and phone navigation, filtering, keyboard access, reduced-motion behavior and history restoration. Launch each new game and exercise its controls, score changes and restart. Create/reopen tool data, practice cards, draw/undo/export, and calculate/convert actual inputs. Record implementation and any incomplete validation honestly. External release and NAS replacement follow only after the new version is ready.

## Completion evidence

Completed as v5.5.0. [Release evidence](RELEASE-5.5.0.md) records the concrete manual observations and coverage limits.

| Requirement | Implementation and evidence |
| --- | --- |
| Three playable Originals | Kinetic renderer and catalog entries; each launched, accepted controls, changed score, ended a round and restarted; best scores saved. |
| Three useful local tools | Study Deck saved/reopened/practiced and cancelled edits; Sketchpad drew/undid/exported a real PNG; Number Lab calculated on Enter and converted units. Public tool reopened profile history in its optional separate Aether shell tab. |
| Faster library navigation | Collections and header shortcuts; Racing selected 18 entries and jumped to its library; route return preserved filters and scroll. App collections and clear filters are implemented. |
| Reachable phone and desktop routes | Rendered desktop sidebar and five-entry phone dock; four secondary destinations available in More; focus trapping and Settings navigation exercised. |
| Motion and theme | Existing theme retained in rendered pages; bounded marker/sheet/reveal motion; reduced-motion route duration zero; no continuous marker animation loop. |
| Safe persistence and deployment | Existing tool-key bridge validation retained; packaged scripts matched source; real AMD64 image saved/reloaded; stable release digest matched; NAS healthy with four profiles preserved and three rollback sets. |

This completion covers the scoped additions and navigation work above. It does not assert compatibility of every remote game or exhaustive mechanics/device testing.
