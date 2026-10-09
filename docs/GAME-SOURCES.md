# Game sources and launch coverage

Catalog checked on 2026-10-08 for Aether v5.0.0. This document records sources, attribution, launch behavior, and the limits of the checks.

## Library summary

- 202 distinct catalog entries: 16 Aether Originals and 186 remote game or game-service entries.
- 134 remote additions plus 16 local originals were added to the previous 57-entry library; 5 unsuitable legacy targets were removed.
- 52 legacy entries were retained, with 15 launch targets repaired or moved to creator or publishing-platform pages.
- The remote library includes 2 publisher portals (Poki and CrazyGames) and 2 room-code companions (Kahoot! and Jackbox). These are labeled and are not represented as standalone games.
- GeoGuessr may require an account or a paid plan. All other access labels describe the provider landing page and do not promise the absence of provider ads or optional purchases.

## Checks and their limits

- Remote creator or publisher pages were requested with a regular HTTPS GET, following redirects. The result, final URL, title, content type, frame policy, and source metadata were recorded in [research-catalog.json](research-catalog.json).
- 185 of the 186 accepted remote entries returned HTTP 200. The original official Agar.io target returned HTTP 403 to the automated request; it is retained with that limitation documented.
- Newly added remote artwork URLs returned HTTP 200 to a HEAD request. The page supplied the image link; image files were not downloaded into the Aether build.
- HTTP 200 establishes that a page is reachable. It does not establish that the game starts, that a publisher SDK works through a proxy, that a multiplayer connection succeeds, or that a whole game can be completed.
- Redirects to generic publisher categories or homepages were rejected. Dead DNS names, an expired certificate, unavailable games, and questionable third-party clone sources were excluded rather than counted as playable additions.
- Gameplay and local-original behavior must be checked separately in the browser; use the release audit for those results. This source report does not claim end-to-end game compatibility.

## Launch behavior

| Mode | Count | Behavior |
| --- | ---: | --- |
| `local` | 16 | Original same-origin game implementation, delivered inside Aether without proxy startup or a remote provider. |
| `direct` | 22 | Creator-hosted game iframe loaded inside Aether. The checked response had no restrictive frame-ancestor or X-Frame-Options header. A provider can change that policy later. |
| `proxy` | 164 | A creator or publisher page launched through Aether. WebGL, cookies, ads, and multiplayer services can require further compatibility checks. |

Official js13kGames player responses restrict frame ancestors to the competition site. Those targets therefore use the Aether proxy. Their competition packages were constrained to 13 KB, but the served document and browser transfer can be larger. No promise is made that a proxied launch transfers only 13 KB.

Direct external games keep their provider origin and browser storage. They are not automatically imported into an Aether profile merely because they appear in the library. Aether Originals use their own game-specific save namespace.

## Attribution and rights

- Aether Originals are newly written implementations of classic mechanics and small original arcade concepts. Their code and cover illustrations live in `public/arcade/`. They contain no downloaded commercial game client, ROM, or third-party game bundle.
- Remote entries are links to games offered by their creator or a public publishing platform. Names are factual game titles and remain the property of their respective creators.
- New external cover art is referenced from a creator or publisher-provided image URL. It remains external and retains its creator or publisher ownership. A reachable image URL is not an assertion of a license to redistribute the file.
- Existing v4 local logo files remain for retained legacy entries. Their original provenance was not recorded in the incoming catalog. Each is marked as a legacy asset in `logoSource`; this report does not invent a license for them.
- The original Eaglercraft entry was excluded because an unauthorized redistribution of a Minecraft client is not treated as an approved game source.
- No external game source or asset bundle was copied into this release. Any later decision to self-host a remote game needs an explicit review of its code and asset licenses.

Primary source examples:
- [Poki game publishing platform](https://developers.poki.com/) and [Poki player FAQ](https://poki.com/en/c/faq).
- [js13kGames competition and authors](https://js13kgames.com/) and each submitted game repository linked below.
- [PhobosLab official game list](https://phoboslab.org/games).
- [doublespeak games official studio page](https://doublespeakgames.com/).
- [Nicky Case official projects](https://ncase.me/), which declares a public-domain waiver for the creator's work.
- [Candy Box 2 source-code license page](https://candybox2.github.io/source_code.html), which identifies GPLv3. Aether links to the hosted game and does not redistribute its source.
- [HexGL creator page](https://hexgl.bkcore.com/), which identifies its code as MIT unless otherwise specified. Aether links to the game and does not redistribute its code or assets.

## Aether Originals

| Game | Category | Launch URL |
| --- | --- | --- |
| Neon Serpent | Arcade | `/arcade/index.html?game=snake` |
| Signal Merge | Puzzle | `/arcade/index.html?game=merge` |
| Prism Break | Arcade | `/arcade/index.html?game=breakout` |
| Quiet Minefield | Puzzle | `/arcade/index.html?game=mines` |
| Echo Pairs | Puzzle | `/arcade/index.html?game=memory` |
| Threefold | Strategy | `/arcade/index.html?game=tictactoe` |
| Gravity Four | Strategy | `/arcade/index.html?game=connect4` |
| Pulse Check | Skill | `/arcade/index.html?game=reaction` |
| Cipher Scramble | Word | `/arcade/index.html?game=scramble` |
| Tile Shift | Puzzle | `/arcade/index.html?game=slide` |
| Afterglow | Memory | `/arcade/index.html?game=simon` |
| Meteor Lane | Arcade | `/arcade/index.html?game=dodge` |
| Night Switch | Puzzle | `/arcade/index.html?game=lights` |
| Still Sudoku | Puzzle | `/arcade/index.html?game=sudoku` |
| Hue Hunt | Skill | `/arcade/index.html?game=color` |
| Orbit Lock | Skill | `/arcade/index.html?game=orbit` |

## Remote catalog source index

Every source below is the creator, publisher game page, or official competition entry. Known creator names are listed when supplied by that page or its submission. The launch URL can differ from the source page, for example the js13kGames player URL.

| Game | Category | Creator / provider | Source | Mode | Page check |
| --- | --- | --- | --- | --- | --- |
| 13 Steps to Escape | Puzzle | Jonathan Vallet | [js13kGames 2024](https://js13kgames.com/2024/games/13-steps-to-escape) | `proxy` | 200 |
| 13th Floor | Adventure | Rob Louie | [js13kGames 2024](https://js13kgames.com/2024/games/13th-floor) | `proxy` | 200 |
| 1v1.LOL | FPS | CrazyGames | [CrazyGames](https://www.crazygames.com/game/1v1-lol) | `proxy` | 200 |
| 2048 | Puzzle | Gabriele Cirulli | [Gabriele Cirulli](https://play2048.co/) | `proxy` | 200 |
| A Dark Room | Adventure | doublespeak games | [doublespeak games](https://adarkroom.doublespeakgames.com/) | `direct` | 200 |
| A Small World Cup | Sports | Rujo Games | [Poki](https://poki.com/en/g/a-small-world-cup) | `proxy` | 200 |
| Adventures with Anxiety | Adventure | Nicky Case | [Nicky Case](https://ncase.me/anxiety/) | `direct` | 200 |
| Agar.io | Arcade | Agar.io official site | [Agar.io official site](https://agar.io/) | `proxy` | 403; automated access restricted |
| Antimatter Dimensions | Idle | Hevipelle | [Hevipelle](https://ivark.github.io/) | `direct` | 200 |
| Apple Worm | Puzzle | Gibton | [Poki](https://poki.com/en/g/apple-worm) | `proxy` | 200 |
| Ashes of Ulthar | Strategy | Elliot Nelson | [js13kGames 2025](https://js13kgames.com/2025/games/ashes-of-ulthar) | `proxy` | 200 |
| Astray | Puzzle | Rye Terrell | [Rye Terrell](https://wwwtyro.github.io/Astray/) | `direct` | 200 |
| Bad Ice-Cream | Arcade | Nitrome | [Poki](https://poki.com/en/g/bad-ice-cream) | `proxy` | 200 |
| Basket Random | Sports | RHM Interactive | [CrazyGames](https://www.crazygames.com/game/basket-random) | `proxy` | 200 |
| Basketball Stars | Sports | Madpuffers | [Poki](https://poki.com/en/g/basketball-stars) | `proxy` | 200 |
| Big Tall Small | Puzzle | Robert Alvarez | [Poki](https://poki.com/en/g/big-tall-small) | `proxy` | 200 |
| Biolab Disaster | Platformer | Dominic Szablewski | [Dominic Szablewski](https://playbiolab.com/) | `direct` | 200 |
| Black Cat Squadron | Arcade | Jesper Rasmussen | [js13kGames 2025](https://js13kgames.com/2025/games/black-cat-squadron) | `proxy` | 200 |
| Block the Pig | Puzzle | Sun Temple | [Poki](https://poki.com/en/g/block-the-pig) | `proxy` | 200 |
| Bloons TD | Strategy | Ninja Kiwi | [CrazyGames](https://www.crazygames.com/game/bloons-tower-defense) | `proxy` | 200 |
| Bloxd.io | Sandbox | Bloxd.io official site | [Bloxd.io official site](https://bloxd.io/) | `proxy` | 200 |
| Bloxorz | Puzzle | Coolmath Games | [Coolmath Games](https://www.coolmathgames.com/0-bloxorz) | `proxy` | 200 |
| Blumgi Ball | Sports | Blumgi | [Poki](https://poki.com/en/g/blumgi-ball) | `proxy` | 200 |
| Blumgi Bloom | Puzzle | Blumgi | [Poki](https://poki.com/en/g/blumgi-bloom) | `proxy` | 200 |
| Blumgi Castle | Arcade | Blumgi | [Poki](https://poki.com/en/g/blumgi-castle) | `proxy` | 200 |
| Blumgi Dragon | Arcade | Blumgi | [Poki](https://poki.com/en/g/blumgi-dragon) | `proxy` | 200 |
| Blumgi Rocket | Racing | Blumgi | [Poki](https://poki.com/en/g/blumgi-rocket) | `proxy` | 200 |
| Blumgi Slime | Platformer | Blumgi | [Poki](https://poki.com/en/g/blumgi-slime) | `proxy` | 200 |
| Bounce Back | Adventure | Frank Force | [Frank Force](https://killedbyapixel.github.io/BounceBack/) | `direct` | 200 |
| Boxing Random | Sports | RHM Interactive | [CrazyGames](https://www.crazygames.com/game/boxing-random) | `proxy` | 200 |
| Brain Test: Tricky Puzzles | Puzzle | Unico Studio | [Poki](https://poki.com/en/g/brain-test-tricky-puzzles) | `proxy` | 200 |
| Brewing Disaster | Strategy | Adrien Guéret | [js13kGames 2024](https://js13kgames.com/2024/games/brewing-disaster) | `proxy` | 200 |
| Bubble Burst | Arcade | John Edvard | [js13kGames 2024](https://js13kgames.com/2024/games/bubble-burst) | `proxy` | 200 |
| Bubble Shooter | Puzzle | Bubble Shooter official site | [Bubble Shooter official site](https://www.bubbleshooter.net/) | `proxy` | 200 |
| Candy Box | Adventure | aniwey | [aniwey](https://candybox2.github.io/candybox/) | `direct` | 200 |
| Candy Box 2 | Adventure | aniwey | [aniwey](https://candybox2.github.io/) | `direct` | 200 |
| Cat Survivors | Arcade | Elias Ku and Alexandra Al | [js13kGames 2025](https://js13kgames.com/2025/games/cat-survivors) | `proxy` | 200 |
| Catculus | Puzzle | Antti Haavikko | [js13kGames 2025](https://js13kgames.com/2025/games/catculus) | `proxy` | 200 |
| Checkers | Board | Checkers official site | [Checkers official site](https://www.247checkers.com/) | `proxy` | 200 |
| Chess | Board | Chess official site | [Chess official site](https://www.chess.com/play/computer) | `proxy` | 200 |
| Chess Grandmaster | Board | Ravalmatic | [Poki](https://poki.com/en/g/chess-grandmaster) | `proxy` | 200 |
| CLAWSTRIKE | Arcade | Rémi Vansteelandt | [js13kGames 2025](https://js13kgames.com/2025/games/clawstrike) | `proxy` | 200 |
| Clicker Heroes | Idle | Playsaurus | [Playsaurus](https://clickerheroes.com/play) | `proxy` | 200 |
| Codenames | Party | Codenames official site | [Codenames official site](https://codenames.game/) | `proxy` | 200 |
| Cookie Clicker | Idle | Orteil | [Orteil](https://orteil.dashnet.org/cookieclicker/) | `proxy` | 200 |
| Coup Ahoo | Strategy | Antti Haavikko | [js13kGames 2024](https://js13kgames.com/2024/games/coup-ahoo) | `proxy` | 200 |
| Cow Bay | Simulation | 7Spot Games | [Poki](https://poki.com/en/g/cow-bay) | `proxy` | 200 |
| Crazy Cars | Racing | No Pressure Studios | [Poki](https://poki.com/en/g/crazy-cars) | `proxy` | 200 |
| CrazyGames | Portal | CrazyGames | [CrazyGames](https://www.crazygames.com/) | `proxy` | 200 |
| Crossy Road | Arcade | Hipster Whale | [Poki](https://poki.com/en/g/crossy-road) | `proxy` | 200 |
| Diep.io | Arcade | Diep.io official site | [Diep.io official site](https://diep.io/) | `proxy` | 200 |
| Dino Game | Arcade | Chrome UX | [Poki](https://poki.com/en/g/dinosaur-game) | `proxy` | 200 |
| DR1V3N WILD | Racing | Frank Force | [js13kGames 2024](https://js13kgames.com/2024/games/dr1v3n-wild) | `proxy` | 200 |
| Dreadhead Parkour | Platformer | Gametornado | [Poki](https://poki.com/en/g/dreadhead-parkour) | `proxy` | 200 |
| Drift Boss | Racing | MarketJS | [Poki](https://poki.com/en/g/drift-boss) | `proxy` | 200 |
| Drift Hunters | Racing | CrazyGames | [CrazyGames](https://www.crazygames.com/game/drift-hunters) | `proxy` | 200 |
| Drive Mad | Racing | Fancade | [Poki](https://poki.com/en/g/drive-mad) | `proxy` | 200 |
| Duck Life 4 | Simulation | Coolmath Games | [Coolmath Games](https://www.coolmathgames.com/0-duck-life-4) | `proxy` | 200 |
| Ducklings.io | Arcade | Pelican Party Studios | [Poki](https://poki.com/en/g/ducklings-io) | `proxy` | 200 |
| Duo Survival | Puzzle | 7Spot Games | [Poki](https://poki.com/en/g/duo-survival) | `proxy` | 200 |
| Fancy Pants | Platformer | Borne Games | [Poki](https://poki.com/en/g/fancy-pants) | `proxy` | 200 |
| Fireboy & Watergirl | Puzzle | Oslo Albet | [CrazyGames](https://www.crazygames.com/game/fireboy-and-watergirl-the-forest-temple) | `proxy` | 200 |
| Fish Eat Fish | Arcade | Indiesoft | [Poki](https://poki.com/en/g/fish-eat-fish) | `proxy` | 200 |
| Football Legends | Sports | Madpuffers | [Poki](https://poki.com/en/g/football-legends) | `proxy` | 200 |
| Funny Shooter 2 | FPS | GoGoMan | [Poki](https://poki.com/en/g/funny-shooter-2) | `proxy` | 200 |
| Gartic Phone | Party | Gartic Phone official site | [Gartic Phone official site](https://garticphone.com/) | `proxy` | 200 |
| GeoGuessr | Trivia | GeoGuessr official site | [GeoGuessr official site](https://www.geoguessr.com/) | `proxy` | 200 |
| Getaway Shootout | Party | Neweichgames | [Poki](https://poki.com/en/g/getaway-shootout) | `proxy` | 200 |
| Ghosted | Puzzle | Jani Nykänen | [js13kGames 2024](https://js13kgames.com/2024/games/ghosted) | `proxy` | 200 |
| Gobble | Puzzle | Fancade | [Poki](https://poki.com/en/g/gobble) | `proxy` | 200 |
| Golf Champions | Sports | Bekho Team | [Poki](https://poki.com/en/g/golf-champions) | `proxy` | 200 |
| Gridland | Puzzle | doublespeak games | [doublespeak games](https://gridland.doublespeakgames.com/) | `direct` | 200 |
| Happy Wheels | Arcade | Happy Wheels official site | [Happy Wheels official site](https://www.totaljerkface.com/happy_wheels.tjf) | `proxy` | 200 |
| HexGL | Racing | Thibaut Despoulain | [Thibaut Despoulain](https://hexgl.bkcore.com/play/) | `direct` | 200 |
| Hole.io | Arcade | Voodoo | [Poki](https://poki.com/en/g/hole-io) | `proxy` | 200 |
| Idle Ants | Idle | Madbox | [Poki](https://poki.com/en/g/idle-ants) | `proxy` | 200 |
| Idle Mining Empire | Idle | MarketJS | [Poki](https://poki.com/en/g/idle-mining-empire) | `proxy` | 200 |
| Jackbox | Party | Jackbox official site | [Jackbox official site](https://jackbox.tv/) | `proxy` | 200 |
| Jumping Shell | Puzzle | Robert Alvarez | [Poki](https://poki.com/en/g/jumping-shell) | `proxy` | 200 |
| Kahoot! | Party | Kahoot! official site | [Kahoot! official site](https://kahoot.it/) | `proxy` | 200 |
| Kittens Game | Idle | bloodrizer | [bloodrizer](https://kittensgame.com/web/) | `direct` | 200 |
| Krunker | FPS | Krunker official site | [Krunker official site](https://krunker.io/) | `proxy` | 200 |
| Kuro Neko Market | Simulation | Federico Tibaldo | [js13kGames 2025](https://js13kgames.com/2025/games/kuro-neko-market) | `proxy` | 200 |
| Level Devil | Platformer | Unept | [Poki](https://poki.com/en/g/level-devil) | `proxy` | 200 |
| Lichess | Board | Lichess official site | [Lichess official site](https://lichess.org/) | `proxy` | 200 |
| Little Alchemy | Puzzle | Jakub Koziol | [Jakub Koziol](https://littlealchemy.com/) | `direct` | 200 |
| Little Alchemy 2 | Puzzle | Little Alchemy | [Little Alchemy](https://littlealchemy2.com/) | `proxy` | 200 |
| Longcat | Puzzle | Fancade | [Poki](https://poki.com/en/g/longcat) | `proxy` | 200 |
| Make It Meme | Party | Poki | [Poki](https://makeitmeme.com/) | `proxy` | 200 |
| Minecraft Classic | Sandbox | Mojang | [Mojang](https://classic.minecraft.net/) | `proxy` | 200 |
| Minesweeper | Puzzle | Minesweeper official site | [Minesweeper official site](https://minesweeper.online/) | `proxy` | 200 |
| Monkey Mart | Simulation | TinyDobbins | [Poki](https://poki.com/en/g/monkey-mart) | `proxy` | 200 |
| Monkeytype | Skill | Monkeytype official site | [Monkeytype official site](https://monkeytype.com/) | `proxy` | 200 |
| MooMoo.io | Survival | FRVR | [MooMoo.io official site](https://moomoo.io/) | `proxy` | 200 |
| Moto X3M | Racing | Madpuffers | [Poki](https://poki.com/en/g/moto-x3m) | `proxy` | 200 |
| Moving Truck | Racing | 7Spot Games | [Poki](https://poki.com/en/g/moving-truck) | `proxy` | 200 |
| Murder | Arcade | Studio Seufz | [Poki](https://poki.com/en/g/murder) | `proxy` | 200 |
| My Perfect Hotel | Simulation | SayGames | [Poki](https://poki.com/en/g/my-perfect-hotel) | `proxy` | 200 |
| Narrow.One | FPS | Pelican Party Studios | [Poki](https://poki.com/en/g/narrow-one) | `proxy` | 200 |
| Non-Mewtonian Cat | Puzzle | Mohammed Saud | [js13kGames 2025](https://js13kgames.com/2025/games/non-mewtonian-cat) | `proxy` | 200 |
| Olly the Paw | Simulation | 7Spot Games | [Poki](https://poki.com/en/g/olly-the-paw) | `proxy` | 200 |
| OvO | Platformer | Dedra Games | [CrazyGames](https://www.crazygames.com/game/ovo) | `proxy` | 200 |
| Pac-Man | Retro | Google Doodles | [Google Doodles](https://www.google.com/logos/2010/pacman10-i.html) | `proxy` | 200 |
| Papa's Burgeria | Simulation | Flipline Studios | [Poki](https://poki.com/en/g/papas-burgeria) | `proxy` | 200 |
| Papa's Freezeria | Simulation | Flipline Studios | [Poki](https://poki.com/en/g/papas-freezeria) | `proxy` | 200 |
| Papa's Pizzeria | Simulation | Flipline Studios | [Poki](https://poki.com/en/g/papas-pizzeria) | `proxy` | 200 |
| Papa's Sushiria | Simulation | Flipline Studios | [Poki](https://poki.com/en/g/papas-sushiria) | `proxy` | 200 |
| Paper.io | Arcade | CrazyGames | [CrazyGames](https://www.crazygames.com/game/paper-io-2) | `proxy` | 200 |
| PartyToons | Party | TinyDobbins | [Poki](https://poki.com/en/g/partytoons) | `proxy` | 200 |
| Penalty Shooters 2 | Sports | 10x10games | [Poki](https://poki.com/en/g/penalty-shooters-2) | `proxy` | 200 |
| Phantomicus | FPS | Cody Ebberson | [js13kGames 2024](https://js13kgames.com/2024/games/phantomicus) | `proxy` | 200 |
| Poki | Portal | Poki | [Poki](https://poki.com/) | `proxy` | 200 |
| Pool Club | Sports | Ravalmatic | [Poki](https://poki.com/en/g/pool-club) | `proxy` | 200 |
| Poor Bunny | Arcade | Adventure Islands | [Poki](https://poki.com/en/g/poor-bunny) | `proxy` | 200 |
| Q1K3 | FPS | Dominic Szablewski | [Dominic Szablewski](https://phoboslab.org/q1k3/) | `direct` | 200 |
| Rabbit Samurai | Platformer | IP Eliseenko Maksim Andreevich | [Poki](https://poki.com/en/g/rabbit-samurai) | `proxy` | 200 |
| Raft Wars | Strategy | Martijn Kunst | [Poki](https://poki.com/en/g/raft-wars) | `proxy` | 200 |
| Raft Wars Multiplayer | Strategy | Martijn Kunst | [Poki](https://poki.com/en/g/raft-wars-multiplayer) | `proxy` | 200 |
| Ragdoll Hit | Arcade | Ericetto | [Poki](https://poki.com/en/g/ragdoll-hit) | `proxy` | 200 |
| Red Ball 4 | Platformer | Yohoho Games | [Poki](https://poki.com/en/g/red-ball-4) | `proxy` | 200 |
| Retro Bowl | Sports | New Star Games | [Poki](https://poki.com/en/g/retro-bowl) | `proxy` | 200 |
| Retro Bowl College | Sports | New Star Games | [Poki](https://poki.com/en/g/retro-bowl-college) | `proxy` | 200 |
| Rocket Soccer Derby | Sports | No Pressure Studios | [Poki](https://poki.com/en/g/rocket-soccer-derby) | `proxy` | 200 |
| Rodeo Stampede | Arcade | Featherweight | [Poki](https://poki.com/en/g/rodeo-stampede-savannah) | `proxy` | 200 |
| Rooftop Snipers | Party | Neweichgames | [Poki](https://poki.com/en/g/rooftop-snipers) | `proxy` | 200 |
| Run 3 | Arcade | Coolmath Games | [Coolmath Games](https://www.coolmathgames.com/0-run-3) | `proxy` | 200 |
| Shell Shockers | FPS | Shell Shockers official site | [Shell Shockers official site](https://shellshock.io/) | `proxy` | 200 |
| Short Life | Platformer | Gametornado | [Poki](https://poki.com/en/g/short-life) | `proxy` | 200 |
| Short Ride | Racing | Gametornado | [Poki](https://poki.com/en/g/short-ride) | `proxy` | 200 |
| Skribbl.io | Party | Skribbl.io official site | [Skribbl.io official site](https://skribbl.io/) | `proxy` | 200 |
| Sling Kong | Arcade | Protostar | [Poki](https://poki.com/en/g/sling-kong) | `proxy` | 200 |
| Slither.io | Arcade | Slither.io official site | [Slither.io official site](https://slither.io/) | `proxy` | 200 |
| Slope | Arcade | Y8 | [Y8](https://www.y8.com/games/slope) | `proxy` | 200 |
| Smash Karts | Racing | Smash Karts official site | [Smash Karts official site](https://smashkarts.io/) | `proxy` | 200 |
| Snake.is MLG Edition | Arcade | CrioDev | [Poki](https://poki.com/en/g/snake-is-mlg-edition) | `proxy` | 200 |
| Soccer Random | Sports | RHM Interactive | [CrazyGames](https://www.crazygames.com/game/soccer-random) | `proxy` | 200 |
| Soccer Skills Euro Cup | Sports | Radical Play | [Poki](https://poki.com/en/g/soccer-skills-euro-cup) | `proxy` | 200 |
| Soccer Skills World Cup | Sports | Radical Play | [Poki](https://poki.com/en/g/soccer-skills-world-cup) | `proxy` | 200 |
| Solitaire | Cards | Solitaire official site | [Solitaire official site](https://solitaired.com/) | `proxy` | 200 |
| Space Huggers | Arcade | Frank Force | [Frank Force](https://killedbyapixel.github.io/SpaceHuggers/) | `direct` | 200 |
| Stickman Bike | Racing | WeLoPlay | [Poki](https://poki.com/en/g/stickman-bike) | `proxy` | 200 |
| Stickman Climb 2 | Platformer | No Pressure Studios | [Poki](https://poki.com/en/g/stickman-climb-2) | `proxy` | 200 |
| Stickman Hook | Arcade | Madbox | [Poki](https://poki.com/en/g/stickman-hook) | `proxy` | 200 |
| Subway Surfers | Arcade | SYBO | [Poki](https://poki.com/en/g/subway-surfers) | `proxy` | 200 |
| Sudoku | Puzzle | Sudoku official site | [Sudoku official site](https://sudoku.com/) | `proxy` | 200 |
| Super Liquid Soccer | Sports | Punyrobot | [Poki](https://poki.com/en/g/super-liquid-soccer) | `proxy` | 200 |
| Super Star Car | Racing | Barnzmu | [Poki](https://poki.com/en/g/super-star-car) | `proxy` | 200 |
| Sushi Party | Arcade | Terminarch Games | [Poki](https://poki.com/en/g/sushi-party-io) | `proxy` | 200 |
| Swingo | Platformer | Blumgi × Gesinimo × Venturous | [Poki](https://poki.com/en/g/swingo) | `proxy` | 200 |
| Sword Masters | Adventure | emolingo games | [Poki](https://poki.com/en/g/sword-masters) | `proxy` | 200 |
| Table Tennis World Tour | Sports | Famobi | [CrazyGames](https://www.crazygames.com/game/table-tennis-world-tour) | `proxy` | 200 |
| Tag | Party | WeLoPlay | [Poki](https://poki.com/en/g/tag) | `proxy` | 200 |
| Temple of Boom | Arcade | Colin Lane Games AB | [Poki](https://poki.com/en/g/temple-of-boom) | `proxy` | 200 |
| Temple Run 2 | Arcade | Imangi Studios | [Poki](https://poki.com/en/g/temple-run-2) | `proxy` | 200 |
| Tetris | Puzzle | Tetris official site | [Tetris official site](https://tetris.com/play-tetris) | `proxy` | 200 |
| The Evolution of Trust | Strategy | Nicky Case | [Nicky Case](https://ncase.me/trust/) | `direct` | 200 |
| The Way of the Dodo | Platformer | Jesper Rasmussen | [js13kGames 2024](https://js13kgames.com/2024/games/the-way-of-the-dodo) | `proxy` | 200 |
| There Is No Game | Puzzle | KaMiZoTo | [Poki](https://poki.com/en/g/there-is-no-game) | `proxy` | 200 |
| Tic Tac Toe | Board | Tic Tac Toe official site | [Tic Tac Toe official site](https://playtictactoe.org/) | `proxy` | 200 |
| Tiny Fishing | Idle | BuyHTML5 | [Poki](https://poki.com/en/g/tiny-fishing) | `proxy` | 200 |
| Trimps | Idle | GreenSatellite | [GreenSatellite](https://trimps.github.io/) | `direct` | 200 |
| Triska the Ninja Cat | Platformer | John Edvard | [js13kGames 2025](https://js13kgames.com/2025/games/triska-the-ninja-cat) | `proxy` | 200 |
| Tube Jumpers | Party | Neweichgames | [Poki](https://poki.com/en/g/tube-jumpers) | `proxy` | 200 |
| Tunnel Rush | Arcade | Deer Cat Games | [Poki](https://poki.com/en/g/tunnel-rush) | `proxy` | 200 |
| Two Button Bounce | Puzzle | Robert Alvarez | [Poki](https://poki.com/en/g/two-button-bounce) | `proxy` | 200 |
| Typing Club | Skill | Typing Club official site | [Typing Club official site](https://www.typingclub.com/) | `proxy` | 200 |
| Underrun | Arcade | Dominic Szablewski | [Dominic Szablewski](https://phoboslab.org/underrun/) | `direct` | 200 |
| Unicycle Hero | Sports | Unept | [Poki](https://poki.com/en/g/unicycle-hero) | `proxy` | 200 |
| Universal Paperclips | Idle | Frank Lantz | [Frank Lantz](https://www.decisionproblem.com/paperclips/index2.html) | `direct` | 200 |
| Veck.io | FPS | Legion Platforms | [Veck.io official site](https://veck.io/) | `proxy` | 200 |
| Vectaria.io | Sandbox | Vectaria | [Poki](https://poki.com/en/g/vectaria-io) | `proxy` | 200 |
| Venge.io | FPS | OnRush Studio | [Poki](https://poki.com/en/g/venge-io) | `proxy` | 200 |
| Voidcall | Strategy | Dominic Szablewski | [Dominic Szablewski](https://phoboslab.org/voidcall/) | `direct` | 200 |
| Volley Random | Sports | RHM Interactive | [CrazyGames](https://www.crazygames.com/game/volley-random) | `proxy` | 200 |
| War of Sticks | Strategy | Shoom Games | [Poki](https://poki.com/en/g/war-of-sticks) | `proxy` | 200 |
| Water Color Sort | Puzzle | VNStart Studio | [Poki](https://poki.com/en/g/water-color-sort) | `proxy` | 200 |
| Watermelon Drop | Puzzle | yeqwep | [Poki](https://poki.com/en/g/watermelon-drop) | `proxy` | 200 |
| Whiskers Witch Adventure | Adventure | Rob Louie | [js13kGames 2025](https://js13kgames.com/2025/games/whiskers-witch-adventure) | `proxy` | 200 |
| Who Is? | Puzzle | Unico Studio | [Poki](https://poki.com/en/g/who-is) | `proxy` | 200 |
| Witchcat | Adventure | Jonathan Vallet and Lylouf | [js13kGames 2025](https://js13kgames.com/2025/games/witchcat) | `proxy` | 200 |
| Woody Sort | Puzzle | Unico Studio | [Poki](https://poki.com/en/g/woody-sort) | `proxy` | 200 |
| Wordle | Puzzle | Wordle official site | [Wordle official site](https://www.nytimes.com/games/wordle/) | `proxy` | 200 |
| Xibalba | FPS | Dominic Szablewski | [Dominic Szablewski](https://phoboslab.org/xibalba/) | `direct` | 200 |
| XType | Arcade | Dominic Szablewski | [Dominic Szablewski](https://phoboslab.org/xtype/) | `direct` | 200 |
| Zombs Royale | Battle Royale | Zombs Royale official site | [Zombs Royale official site](https://zombsroyale.io/) | `proxy` | 200 |
| ZType | Skill | Dominic Szablewski | [Dominic Szablewski](https://zty.pe/) | `direct` | 200 |

## Rejected or removed targets

Failed candidates are recorded to avoid reintroducing them as apparently new games. A failed request alone does not prove that a game is permanently unavailable.

| Candidate | Legacy entry? | Reason |
| --- | --- | --- |
| Slope Plus | Yes | DNS lookup failed on the check date. |
| BitLife | Yes | Legacy target redirects to a third-party clone rather than a verified creator or publisher game. |
| Eaglercraft | Yes | Minecraft client redistribution is not treated as an authorized game source. |
| Vex 5 | Yes | Publisher game URL now redirects to a general platform category. |
| Doodle Jump | Yes | Publisher game URL now redirects to a general skill category. |
| Golfinity | No | Candidate redirects to a publisher category or homepage. |
| Stickman Parkour | No | Candidate did not return a successful publisher game page. |
| Heart Star | No | Candidate redirects to a publisher category or homepage. |
| Combat Online | No | Candidate redirects to a publisher category or homepage. |
| Moto Road Rash 3D | No | Candidate did not return a successful publisher game page. |
| Gold Digger FRVR | No | Candidate redirects to a publisher category or homepage. |
| Hextris | No | Candidate did not return a successful publisher game page. |
| Bit Butcher | No | Candidate did not return a successful publisher game page. |

## Maintaining the library

1. Prefer an official creator page or a publisher's individual game page, then confirm the final URL remains a game.
2. Add a unique stable `id`, human-written description, category, relevant tags, source attribution, and honest access requirements.
3. Use `local` only for Aether-owned same-origin implementations. Use `direct` only after checking frame policy and browser behavior. Other remote targets use `proxy`.
4. Keep remote game clients and artwork outside the Docker build unless their licenses have been explicitly reviewed.
5. Treat a URL change as a migration. The catalog retains `previousUrl` for repaired legacy targets because favorites, recents, and older save data may reference the original address.
6. Recheck target pages and test representative games from each provider during future releases.
