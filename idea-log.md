# Aether idea log

## Session 2026-10-09

**New ideas explored:** Orbit Runs; Constellation friend rooms; Remix Studio; mood journeys; Focus rituals; Travel Shelf; device pairing and continuity; a web workspace; ghost replays and spectator nights.

**Top 3 picked:**

1. **Orbit Runs:** a daily, seeded journey through several Aether Originals, with one coherent result and a challenge link.
2. **Constellations:** a persistent home for a small group of friends, with shared seeded challenges and actual game-night rounds.
3. **Remix Studio:** a visual, data-only editor that lets a player make and share new levels and challenge packs for the Originals.

**Explicitly rejected / not worth it:** compulsory productivity gates before games; an AI companion that plays the game for the user; a public global social feed as the next default; pretending one score scale can fairly rank every remote game; an animated 3D navigation system required to access basic pages. These either remove the user's freedom, blur the pleasure of playing, add a large operating burden, make unsupported comparisons, or make a fast personal app harder to use.

**Open threads to revisit:** whether daily runs should have a relaxed and a competitive mode; which three Originals make the best first relay; local household rooms versus invited remote friends; whether creator packs belong in profile backups or their own export format; opt-in Focus-to-play sessions; a small offline collection; handoff between a phone and the desktop without exchanging a permanent profile key; friendly asynchronous ghost challenges.

### History and evidence

This is session 1. No previous `idea-log.md` existed in the named skill folder or the project root when history was checked. The named `C:\Users\brady\.agents\skills\app-visionary\SKILL.md` was read in full. Its hard rule permits this idea log and prohibits app code changes during the exercise; this pass changes no app sources.

The final v5 pass is a screenshot and code informed walkthrough, supported by the parent agent's recorded browser journeys. A fresh computer-use inventory in this agent's session returned no apps and no browsers, so this is not an independently repeated full clickthrough. This distinction matters: looking at a room form is not proof of joining and chatting in a room, and a visible backup button is not proof of a restored backup.

All eight final desktop captures and all eight actual 390 by 700 mobile captures were inspected: `.Codex/audit-tmp/screenshots/v5-{home,games,apps,focus,multiplayer,proxies,profile,settings}-{desktop,mobile}.jpg`. Fresh final Original captures for Prism Break, Echo Pairs, Orbit Lock and Cipher Scramble were also inspected. The parent recorded all sixteen final Original routes initializing with correct titles and no browser errors and supplied `.Codex/audit-tmp/screenshots/v5-original-<id>.jpg`. The sixteen routes and mechanics also had this agent's earlier live browser checks, described in `docs/ARCADE.md`.

Recorded final journeys include 202 game entries and 27 apps, library loading from 48 to 96 cards, the 16-Original filter, search and empty states, favorites surviving reload, Focus notes and task submission with Enter, timer pause, an Original round result with a server save acknowledgment, and actual target page content through all three proxy engines. The parent also observed a remote game's road canvas through Ultraviolet; that proves a loaded game surface, not a completed play session. Party chat and backup UI journeys were still pending at the evidence handoff. They are not claimed as completed here. Nine pure Original rule suites were rerun successfully by the parent.

Current files used for placement: `public/index.html`, `public/styles.css`, `public/app.js`, `public/arcade/{index.html,main.js,games.js,core.js,catalog.json}`, `data/games.json`, `data/apps.json`, `server.js`, `README.md`, and `docs/ARCADE.md`. This source inspection follows the skill's placement phase, not a bug or security audit.

### First-time walkthrough: what each place could become

**Home.** The graphite page and glassy teal/violet orbit give Aether a recognizable world immediately. The hero says there are 202 choices; the Originals strip says some are ready right here. As a new player, I can explore or ask for a surprise, but the truly memorable next step would be a small journey prepared for me: three games, one ten-minute run, a clear finish. Two years from now, this screen could show a friend's challenge orbit, a creation I made, and a relaxed evening playlist alongside the full collection.

**Games and the local player.** Categories, favorites, availability, sorting and incremental loading are a competent library. The sixteen small Originals make the product more interesting than a remote link shelf because Aether controls their rules, identity, timing and round results. That creates an opening for something bigger: I can race my own past attempt, send a friend the exact same puzzle, or build a new prism board. The external collection remains discovery; the owned games become a place where new experiences can actually be made.

**Apps.** This screen feels like the useful neighboring district of the same universe. A music app, a design tool and a reference page are currently separate launches. A future session could bring them together deliberately: a writing desk with a reference shelf, a music choice and a timer, or a creator desk that makes cover art for a local game pack. The opportunity is a workspace with a purpose, not adding another grid of website icons.

**Party.** The invitation is strong: bring your people, make a room, share a game. The source implements temporary rooms, chat, and a shared game/score card. What would make someone send this unprompted to a friend is an actual shared event: everyone receives the same little puzzle, the countdown starts, results arrive, and the room becomes a constellation of that night's rounds. A persistent friend space could remember the experience rather than disappearing when the temporary room ends.

**Browser.** The engine cards and in-Aether launch preference give the player choices without abandoning the shell. In the future, this can become the doorway into a saved workspace: a research rabbit hole, a learning session, or a game developer's source desk. The product should promise an organized session rather than pretending every website can be made compatible or every third-party login can move seamlessly between engines.

**Focus.** The clock, notes, tasks, and quick game choices already put effort and play next to each other. That is unusual and useful. A two-year version could let someone design an evening rhythm: focus on one task, spend a short break on a chosen puzzle, keep a thought, then return when ready. Aether would support the person's pace without scolding them or locking games behind a checklist.

**Profile.** The current profile groups supported game progress and includes favorites, notes, backup and restore. In a richer Aether, this can be a private play journal: the run I finished, the level I made, and a recent evening with friends. The profile is also the natural anchor for moving from a desktop to a phone, although that requires an intentional device handoff rather than assuming today's best-score record contains the current board and game state.

**Settings.** Motion, spacing, separate tabs and Focus defaults make the environment personal. This should become a small set of session presets that the person can understand: quiet desk, relaxed play, friend night. Those presets would select behavior across the app rather than piling on endless unrelated controls. They should continue to respect reduced motion and keep ordinary navigation immediate.

### Dream branches, placed in the actual code

#### 1. Orbit Runs

What if opening Aether offered today's tiny adventure instead of another choice to make? One run could combine a short word round, a shared Night Switch board and an Orbit Lock attempt. The player receives a single completion card with their own result, then can send the same run to a friend. A relaxed version could be untimed and let the player choose a replacement game; a competitive version could use fixed rules and seeds.

This attaches to the Home hero and Originals collection, `renderHome`, `launch`, `recordRecent`, and `gameMessage` in `public/app.js`. `public/arcade/main.js` already emits `aether-arcade-result`; `core.js` already allows an injected random function for several generated puzzles. `games.js` would need a consistent run configuration and seeded random source, and `server.js` would persist run definitions and completed run records separately from general best scores. Today the player finishes isolated rounds; afterward those rounds become one meaningful journey. It unlocks challenge links, personal run history, friendly relays and creator-made routes. Existing client scores are convenience statistics, so any genuinely competitive mode must define fair game-specific scoring and result verification rather than treating today's message bridge as an authoritative leaderboard.

#### 2. Constellations

What if a friend room felt like the group's own little clubhouse? People could keep a shared collection, leave a challenge for tomorrow, and start a live relay tonight. A visual constellation would add a star for each completed group round. This is a bigger swing than merely making chat prettier: the group is doing something together, and the history makes returning feel worthwhile.

It lives in `#page-multiplayer`, `joinParty`, `renderPartyState`, `renderMembers` and `shareGame`, plus the `/ws` room protocol and `rooms` map in `server.js`. Home could show a small invitation or latest group challenge. The local runtime would receive a room round identifier and shared seed; the server would coordinate ready states, starts, results and round transitions. The current flow shares a game card; the future flow launches the same challenge for the group and remembers its result. This unlocks cooperative modes, asynchronous challenges, hosted game nights and curated household collections. Temporary public room codes and display names would need to evolve into deliberately invited membership and durable room storage; external games keep their own multiplayer rules, so the first real shared rounds should use Originals.

#### 3. Remix Studio

What if the person who keeps asking for more games could make the next good one? Start with a visual prism-board editor, a custom word pack, or a clever Night Switch arrangement. The player chooses a palette, tests the level instantly, and sends a small pack to a friend. With time, Aether can have a growing collection of handmade challenges that feel native to its world.

This attaches to the Originals collection and the Apps creator district. The shared shell and the individual engines in `public/arcade/games.js` would take validated level/configuration data; pure checks belong near `core.js`. `data/games.json` and the controller's `indexCatalog`, `normalizeItem`, `card` and `launch` would distinguish owned packs from fixed catalog entries. Profile exports and a separate pack export could preserve creations. Today content is maintained in source files; afterward someone makes a playable variation without editing JavaScript. It unlocks community collections, room playlists and an effectively unbounded Original level shelf. The editor must begin with data-only templates and bounded options, with preview and validation, rather than executing arbitrary uploaded code or silently rewriting the shipped catalog.

#### 4. Mood journeys

What if discovery began with how I want the next few minutes to feel? "Something quiet," "one fast round," "make me think," or "friends are here" can make a 202-entry shelf easier to enter. A two-year version could assemble a small private playlist and learn which choices the person actually likes, with explanations they can understand.

This lives in Home collection strips, Games search, `filteredGames`, `renderHome`, `renderPalette`, and the catalog's `tags`, `category`, `local`, and launch metadata. It touches the recommendation order and favorites/recents metadata. The gain is a short intentional route instead of searching through a full list every visit. It unlocks Orbit Run discovery and room playlist suggestions. Current tags are not a complete duration or accessibility model; those fields need real editorial meaning before the app promises "five minutes" or a control type. Personalization should work locally and stay optional, without requiring an AI service for basic sorting.

#### 5. Focus rituals

What if Focus and play were one calm evening routine? A person can choose a task, a stretch length and a short game for the break, then let Aether offer the next step when the timer finishes. Someone else can skip every ritual and simply play. The value is continuity between effort and recovery, with no productivity guilt machine bolted on.

This attaches to `#page-focus`, `updateTimer`, `toggleTimer`, `resetTimer`, `renderTodos`, `renderFocus`, and the current notes/tasks/settings metadata. The shell's `launch` would accept an optional session context, and Profile could retain a private session summary. Today a timer and a game shortcut are adjacent; afterward the player designs a repeatable rhythm that carries one intention across both. It unlocks workspace presets and personal reflection. The ritual must be opt-in; timers should offer transitions rather than abruptly closing a game, and remote game sessions cannot be assumed to pause like an Original.

#### 6. Travel Shelf

What if the NAS could be out of reach and the small arcade still felt complete? A player selects a handful of Originals, sees a truthful "ready offline" shelf, and takes it to a phone or laptop. Their local results sync when they return, with conflicts they can understand. This is a practical branch with a bigger future: a personal arcade that travels without becoming dependent on a commercial game service.

It attaches to the `local` catalog filter, `public/arcade/`, the root shell assets and a dedicated install/offline flow. `prepareOriginal`, scoped profile caches, and save synchronization in `public/app.js` supply part of the continuity story. A new service-worker strategy would need to coexist with the existing UV and Scramjet worker scopes. The gain is a deliberately cached, owned game shelf, not a vague claim that every remote game is offline. It unlocks device pairing and a durable personal play journal. Install, updates, cache budgets and clear pending-sync state are required; proxy destinations and private API responses should not be blindly cached with the local arcade.

#### 7. Device pairing and continuity

What if I could begin a puzzle on the PC and finish it on the phone with a short pairing ceremony? The obvious product experience is a temporary QR or code, a device name, and a clear handoff card. A personal constellation of devices would make the self-hosted setup feel approachable instead of making the player move a permanent profile key by hand every time.

This lives in `#page-profile`, `importProfile`, `hydrateProfile`, `exportProfile`, `prepareOriginal`, the profile APIs in `server.js`, and resumable state hooks in `public/arcade/main.js` and each game. The current stored best/rounds/wins is not a serialized board, so actual continuation needs a versioned game-state contract. The user gain is resuming a specific moment rather than only seeing the same best score. It unlocks Travel Shelf synchronization, revocable device access and shared household use. Pairing tokens should expire and be separate from permanent bearer profile keys; this is a new flow, not a present v5 capability.

#### 8. A web workspace

What if Apps and Browser became a desk the player could lay out for a particular session? One saved workspace might hold a reference site, a design tool, Focus notes and a music shortcut. Another might support making a word pack in Remix Studio. This gives the non-game parts a story that fits the same personal universe.

It attaches to `#page-apps`, `#page-proxies`, `renderApps`, `normalizeTarget`, `shellURL`, `launch`, and metadata saved through the profile APIs. Workspace definitions would reference app IDs and URLs while notes and timer state remain the app's own data. Today the player repeatedly launches individual sites; afterward they open a prepared context and keep their intention visible. It unlocks creator workspaces and Focus presets. Each embedded site still controls its login and compatibility, so a workspace can organize launches and references without promising shared cookies, universal embedding or a remote website's internal state.

#### 9. Ghost replays and spectator nights

What if a challenge link showed my friend's earlier run moving through the same board while I try to beat it? Meteor Lane could have a translucent earlier path; Orbit Lock could show the previous attempt's taps. In a room, others could watch short highlight cards and jump into the same challenge. This is the most ambitious branch because it can make these small games feel like a social arcade with a memory.

It attaches to Orbit Runs, Constellation rooms, `public/arcade/core.js`, the input/timing loop in `main.js` and `games.js`, and `gameMessage`/`renderPartyState` in the parent. Today a round yields a scalar result; afterward an input log plus deterministic rules can reproduce an attempt. It unlocks spectating, friendly coaching and playable highlights. Deterministic seeds alone are not sufficient for canvas replays; physics timestep, game version and event order must be controlled, replay storage must be bounded, and the user should choose when to share a run. Start with one timing or grid game before claiming support for every Original.

### Why these three win

**Orbit Runs comes first.** It gives the player an immediate answer to "what should I play?" and turns the existing owned mechanics into a recognizable Aether experience that can be sent to a friend. Building it means adding seeded run configuration to a few Originals, one run coordinator in the parent, and a saved completion card.

**Constellations comes next.** It gives friends a reason to return together and makes the current Party entry point fulfill a much larger promise than sharing links. Building it means extending the existing room protocol and persistence with invited membership, shared round seeds, ready/start events and results.

**Remix Studio is the long-term content engine.** It answers the desire for more games by letting players contribute new experiences that are owned and instantly playable, while creating material for both runs and friend rooms. Building it means a visual editor for two or three validated game templates, a portable pack format and a preview/publish flow into the personal catalog.

These ideas stack into one product story: make a challenge, assemble it into a run, play it with your people, and remember the evening. Mood journeys, Focus rituals, offline play and device continuity can support that story later. Aether can become a personal, creative arcade where the cosmic theme represents the player's actual worlds and connections, rather than only decorating a long list of links. None of these ideas are implemented by this visionary exercise.
