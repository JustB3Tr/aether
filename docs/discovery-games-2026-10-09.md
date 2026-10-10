# Aether game discovery, 2026-10-09

## Scope and verification

Reviewed the current `data/games.json` first. It contains 210 games, including the existing Venge.io official entry and the five recent shooter additions. The proposals below use unique IDs and launch URLs not already in that catalog. Existing Venge.io, Veck.io, and other current catalog entries were not proposed again.

I checked first-party game or publisher pages for titles, modes, controls, developer claims, and browser or networking caveats. This was source-page research only. I did not launch matches or verify gameplay inside Aether, and a page opening in a text browser does not prove that its game session works.

The `direct` choice in the proposal file means bypass Aether's proxy rewriting. It does not prove that a game's external site permits embedding. Keep the new-tab launch option available. If a game's embedded view stalls, test the official URL in a top-level tab before changing its proxy settings. All real-time or WebGL-heavy games should be treated as compatibility candidates until checked in Aether.

These are content-fit suggestions for the requested 14-16 audience, not age ratings. Multiplayer rooms, chat, community modes, and user-created content vary by game. The publisher pages reviewed do not establish a common ESRB or PEGI rating.

## Recommended first checks

1. [TagPro](https://tagpro.koalabeast.com/) has current public queues, simple keyboard controls, and recent developer updates. It adds a team objective without another first-person shooter.
2. [Kart Bros](https://kartbros.io/) adds current online kart races, solo time trials, and power-ups. Its official site was updated in September 2026 and documents browser controls.
3. [HaxBall](https://www.haxball.com/play) adds fast 3v3 and 4v4 team play. Its use of WebRTC means it needs a direct browser connection and should be tried in a top-level tab.
4. [Kirka.io](https://kirka.io/) and [Lurkers.io](https://lurkers.io/client/latest/index.html) add the shooter and survival depth Brady requested. Both are JavaScript-heavy, networked games, so they need a real launch test before being treated as reliable.
5. [Slow Roads](https://slowroads.io/) gives the racing section a quieter 3D driving option alongside the existing drift and arcade racers.

## Candidate source notes

| Candidate | Category and evidence from first-party pages | Launch choice and remaining risk |
| --- | --- | --- |
| [Kirka.io](https://kirka.io/) | Browser FPS page and official client page; lobby source lists servers, quests, weapons, and performance settings. | `direct`. Main page is JavaScript-heavy. No Aether session test. |
| [Lurkers.io](https://lurkers.io/client/latest/index.html) | [Official game modes](https://lurkers.io/wiki/about.html) include zombie survival, Bedwars, open-world survival, sandbox, and team deathmatch. Its [terms](https://lurkers.io/wiki/terms_and_conditions.html) say the game remains in development and community servers may be moderated by their operators. | `direct`. Online assets, early-development status, public servers, and user-created content need review. |
| [Wings.io](https://wings.io/) | [Official details](https://wings.io/more_info) describe mouse-controlled aerial combat, room links, weapons, and rotating events. The official changelog shown on the page dates to 2024. | `direct`. Source inspection showed a connection-failure state. Confirm current matchmaking before cataloging it as working. |
| [Starblast.io](https://starblast.io/) | Official menu lists Team, Survival, Invasion, and Pro Deathmatch. | `direct`. The official page warns that ad blockers can cause connection problems. Source inspection also showed a connection-lost message; high risk pending a normal browser test. |
| [Kart Bros](https://kartbros.io/) | Official page documents solo races, online friend races, power-ups, keyboard controls, and a September 2026 update. It recommends Chrome. | `direct`. Official FAQ warns that blocked sites or ad blockers can interfere. No Aether session test. |
| [HaxBall](https://www.haxball.com/play) | [Official about page](https://www.haxball.com/about) describes real-time 3v3 and 4v4 physics football and explicitly says it uses WebRTC peer connections. | `direct`. WebRTC and embedded-browser policies may fail through the proxy or iframe. Use a top-level tab and a supported browser. |
| [TagPro](https://tagpro.koalabeast.com/) | Official page shows public casual and ranked queues, keyboard remapping, all-chat and team-chat features, and recent 2026 updates. | `direct`. Public matchmaking and chat are part of the experience. No Aether session test. |
| [TETR.IO](https://tetr.io/) | [Official about page](https://tetr.io/about/) describes solo modes, ranked duels, public rooms, and private multiplayer matches. | `direct`. The official source did not load in the text inspection, although its official about page is indexed. Aether compatibility remains unverified. |
| [Soccer Bros](https://soccerbros.gg/) | Official page describes online soccer and says players can play against the computer or someone they invite. It recommends Chrome. | `direct`. Blockers can interfere with loading. No Aether session test. |
| [Baseball Bros](https://baseballbros.io/) | Official page describes online multiplayer, multiple teams, and keyboard controls for batting, pitching, and stealing. It recommends Chrome. | `direct`. Blockers can interfere with loading. No Aether session test. |
| [Slow Roads](https://slowroads.io/) | Official developer page describes solo procedural driving, adjustable scenery and weather, and a still-available free web version. | `direct`. 3D rendering may be demanding on low-end devices; this is an expectation, not a benchmark. No Aether session test. |
| [Basket Bros](https://basketbros.io/) | Official page describes fast 1v1 basketball, character selection, dunks, jump shots, and cartoon punch attacks. It recommends Chrome. | `direct`. Review slapstick combat for the intended audience. Blockers can interfere. |
| [Hockey Bros](https://hockeybros.io/) | Official page describes online friend matches, shooting, passing, checks, and stylized fights. The publisher says it launched in August 2026 and recommends Chrome. | `direct`. Review physical contact and fighting content for the intended audience. Browser extensions can interfere. |
| [Wrestle Bros](https://wrestlebros.io/) | Official page describes pro-wrestling attacks, CPU matches, online friend matches, and keyboard controls. It recommends Chrome. | `direct`. Review stylized combat for the intended audience. Blockers can interfere. |

## Exclusions and limits

- Venge.io is already present in the current catalog, including the official URL, so it is not a new proposal.
- PolyTrack was excluded because its publisher's [terms](https://www.kodub.com/terms/polytrack) prohibit iframe embedding, which conflicts with Aether's current embedded launch path unless the product routes it to a top-level tab.
- These entries contain no copied thumbnails. The `logo` fields are empty for Aether's local-cover pass.
- No HTTP status, in-Aether gameplay result, matchmaking result, or performance result is claimed here.
