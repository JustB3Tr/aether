# Aether 5.5.0: play, make, find

## Changes

- Three new local Originals: Rail Rush, Ricochet Relay and Skybound. All use the shared pause, restart, optional sound, touch controls and profile best-score runtime. Their renderer downloads only when one of this family is selected.
- Three local tools: Study Deck, Sketchpad and Number Lab. Each receives only its own profile save key through the existing validated iframe bridge. Flashcards can be edited and practiced; drawings support undo, erasing and PNG export; Number Lab parses a restricted arithmetic grammar without evaluating JavaScript.
- Game and app collections, quick genre shortcuts, clear app filters, and remembered per-page scroll positions during navigation. Recent sessions appear closer to the top of Home.
- A five-entry phone dock with an accessible More dialog for Focus, Party, Profile and Settings. Focus trapping, Escape, backdrop dismissal and focus restoration preserve keyboard access.
- An animated desktop navigation marker and a short More entrance, using the existing theme and route motion. Reduced-motion preferences disable these effects. The marker updates on navigation and resize, without a continuous idle animation loop.
- Drawings render new segments incrementally while drawing, avoiding a redraw of the entire saved canvas on every pointer event. Local tools bound their saved data to fit the existing profile bridge limit.

## Current validation

Source preview at `127.0.0.1:15015`, isolated disposable userdata under `.Codex/v55-userdata`.

- Study Deck: added a question/answer, received successful profile save, closed/reopened and found the card intact; flipped and marked it, showing one remembered out of one reviewed.
- Number Lab: Enter calculated `(18 + 6) / 3 = 8`; converted `32 °F` to `0 °C`; successful history profile save shown.
- Sketchpad: pointer drawing enabled Undo and saved to the profile; Undo returned the canvas to blank. Export in a regular Brave tab produced `Downloads/aether-sketch.png`. The in-app browser showed the export status but did not deliver a download event through its automation interface.
- Rail Rush: movement, jump and pause exercised; a collision-ended round scored 217, saved its best, and Play again reset the current score.
- Ricochet Relay: pointer shot hit a target for 120; the 90-second round ended, saved a best of 120, and Play again reset the round.
- Skybound: keyboard and held touch steering changed the jumper's position; pause/resume worked; a fall ended the climb with 87 and Play again reset the current score.
- Phone at 390 by 844: five dock entries; all four More destinations present; Shift+Tab wrapped within the dialog; Settings navigation closed it. No horizontal document overflow observed.
- Racing shortcut selected 18 entries and scrolled to the library. Home then Games restored the racing collection and scroll position 937px.
- Reduced motion: route animation duration zero and navigation marker transition effectively zero.

These are manual browser observations, not exhaustive gameplay or device coverage. New games' win conditions, every collision/bank angle and long drawing sessions are not claimed verified. v5.4.2 deployment evidence remains in its own release notes.

## Packaged image verification

The final image was built locally using Docker Desktop for Linux AMD64. Container `aether-v550-preview` is healthy at `127.0.0.1:15016`; `/health` reports version 5.5.0 and the catalog contains 231 games, 26 Originals, 44 apps and 3 local tools.

The packaged Study Deck saved a card, cancelled an edit without changing its saved answer, and preserved the original answer across a tool reload. Packaged Number Lab calculated `sqrt(81) + 2^3 − 10% = 16.9` on Enter and handled division by zero with a readable error. Packaged Rail Rush loaded its selected renderer, began a round, accepted movement/jump controls and paused. The shell, tools and kinetic renderer SHA-256 values match the local source files exactly.

`docker save` exported a real image archive, compressed to **85,605,640 bytes**. `docker load` successfully reloaded that archive.

- Archive SHA-256: `653d13bcc4744f39b422c2db77aca55eb7f5799321de04f58f1c32a81628efcf`.
- Image config identity: `sha256:2fbd1ab4c2cb776c8b687642052aab8202ad057b1f571a44b637ee8b8fdc0e8d`.
- Platform: `linux/amd64`.

Publication and NAS replacement evidence will be recorded after the external operations finish.

## Tool limits

Study Deck holds 50 cards, with up to 1000 characters per side. Sketchpad has a 1000 by 750 export canvas and bounds drawings to 100 strokes and 6000 sampled points. Number Lab keeps the latest 20 calculation strings. Profile backup includes tool data; PNG files are exported separately. A standalone tool URL saves to browser storage, while launching through the Aether shell attaches the active profile.
