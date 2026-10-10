# Useful app discovery, 2026-10-09

Eleven proposed additions for students and creators around ages 14-16. Their names and URLs were checked against the current 30-entry Apps catalog before selection. None is already present. These entries complement the existing CodePen, Excalidraw, Photopea, Desmos, Figma, and learning links.

The proposed catalog data is in [discovery-apps-2026-10-09.json](discovery-apps-2026-10-09.json). No provider code, game package, commercial art, or logo asset was downloaded. Empty `logo` fields are intended for original Aether cover art when these candidates are merged.

## Scope of verification

- Primary official sites and their documentation were consulted for purpose, browser targets, persistence, and account requirements.
- A regular HTTPS GET followed redirects and returned HTTP 200 with HTML for all eleven proposed launch URLs on 2026-10-09. The final verification process explicitly enabled TLS certificate verification. No provider login or account was used.
- Frame response headers were inspected. Piskel and Kleki explicitly refuse an Aether-origin direct iframe. Other candidates had no prohibiting `X-Frame-Options` or `frame-ancestors` response header in this check. This does not prove that their application code, nested pages, file APIs, or account screens can be embedded.
- These are source and endpoint checks, not Aether app launch tests. Editing, playback, simulation, import, export, full persistence, offline behavior, and account flows were not exercised in Aether.
- `launch: "direct"` preserves provider origin and avoids rewriting complex editors. Aether's current direct launcher is still a credentialless iframe. `frameBlocked: true` is proposal metadata only and is not consumed by the current launcher.

## Candidate comparison

| App | Useful task | Account and saved work | Offline limits | Primary evidence |
| --- | --- | --- | --- | --- |
| BeepBox | Compose a game soundtrack with layered patterns and drums. | No signup workflow is needed. The song data lives in the full URL; keep or share that link. | Official downloadable offline version is offered. Offline operation was not tested. | [Official app and instructions](https://www.beepbox.co/) |
| Song Maker | Sketch a quick melody and drum loop with a simple visual grid. | Chrome Music Lab explicitly says no account is required. Use the app's sharing controls. | No offline claim verified. The provider recommends Chrome. | [Chrome Music Lab FAQ](https://musiclab.chromeexperiments.com/) and [Song Maker](https://musiclab.chromeexperiments.com/Song-Maker/) |
| Piskel | Create pixel sprites, animation frames, and sprite sheets for games. | The creation endpoint is reachable anonymously. GIF/PNG/ZIP export is documented. The FAQ's explicit no-account statement applies to its optional Kids editor. The regular editor's complete account/export workflow remains untested. | Desktop/offline applications are offered. Desktop landscape use is recommended. | [Official features](https://www.piskelapp.com/) and [FAQ](https://www.piskelapp.com/faq/) |
| Kleki | Paint with layers, import line art, add text, and export artwork. | The official site lets users start drawing immediately. Browser snapshots are manual, and tab recovery does not replace exported files. | The changelog documents offline support after the app has been loaded. | [About](https://www.kleki.com/about/), [help](https://kleki.com/help/), and [changelog](https://kleki.com/changelog/) |
| Blockbench | Model, texture, and animate low-poly game characters. | Local modeling is presented without account setup. Uploading to outside communities can involve their accounts. Export model files. | The official PWA works offline, and a desktop app is available. Web import/export can require extra steps and manually loaded textures. | [Official features](https://blockbench.net/), [web limitations FAQ](https://blockbench.net/wiki/blockbench/faq/), and [PWA guide](https://blockbench.net/wiki/guides/blockbench-overview-tips/) |
| Squoosh | Resize and compress images for projects and faster pages. | The official app describes local image processing and immediate file saving. No signup is presented in that workflow. | Offline operation was not verified. Keep the downloaded optimized image. | [Official app](https://squoosh.app/) and [Google Chrome Labs repository](https://github.com/GoogleChromeLabs/squoosh) |
| Twine | Write a choice-based story game and publish it as HTML. | Browser Twine has no accounts. Stories stay in browser storage and can disappear when that storage is cleared. Export backups. | A downloadable desktop version is offered. Browser offline behavior was not verified. | [Official features](https://twinery.org/), [privacy policy](https://twinery.org/privacy-policy/), and [story storage guide](https://twinery.org/cookbook/questions/stories_saved.html) |
| TurboWarp | Build Scratch-style games with blocks and save project files. | Scratch sign-in is unavailable by design. Use local project-file save/load, then import into Scratch separately to publish. | TurboWarp Desktop is the documented offline editor. The web editor's offline behavior was not verified. | [Accounts and file workflows](https://docs.turbowarp.org/scratch-accounts), [desktop editor](https://desktop.turbowarp.org/), and [player embedding limits](https://docs.turbowarp.org/embedding) |
| MakeCode Arcade | Build sprite-based games with blocks or code and a simulator. | Projects are kept in browser storage; the documented local workflow does not depend on online account storage. Download files before clearing browser data. | The editor caches for offline work. New extensions and some compilation can still require a network connection. | [Local project storage](https://arcade.makecode.com/save) and [offline guide](https://arcade.makecode.com/offline) |
| GeoGebra Calculator Suite | Explore geometry, algebra, and 3D graphs beyond the existing Desmos link. | Official help documents local file saving with a skip-sign-in option. Online saving/sharing can involve an account. | Installed offline versions are available. Browser offline operation was not tested. | [Official apps and supported URLs](https://help.geogebra.org/hc/en-us/articles/10470108053277-GeoGebra-Apps) |
| wide.video | Assemble video clips, music, text, and transitions on a timeline. | The provider states that editing is local and requires no account, fee, or watermark. This does not verify every optional smart tool. | The official changelog documents offline web/PWA support. Large projects depend on device resources; offline behavior was not tested. | [Official features and changelog](https://wide.video/) |

## Launch endpoint and frame findings

| Candidate | Launch URL checked | Final response | Framing restriction seen |
| --- | --- | --- | --- |
| BeepBox | `https://www.beepbox.co/` | HTTP 200, same URL | No prohibiting header observed; Aether behavior unverified. |
| Song Maker | `https://musiclab.chromeexperiments.com/Song-Maker/` | HTTP 200, same URL | No prohibiting header observed; JavaScript and Web Audio required. |
| Piskel | `https://www.piskelapp.com/p/create/sprite/` | HTTP 200, same URL | CSP `frame-ancestors 'none'`; direct Aether embedding is blocked. |
| Kleki | `https://kleki.com/` | HTTP 200, same URL | CSP `frame-ancestors 'self'`; direct Aether embedding is blocked. |
| Blockbench | `https://web.blockbench.net/` | HTTP 200, same URL | No prohibiting header observed; requires a WebGL-capable browser. |
| Squoosh | `https://squoosh.app/` | HTTP 200, same URL | No prohibiting header observed; embedded codecs and downloads unverified. |
| Twine | `https://twinery.org/2/` | HTTP 200, same URL | No prohibiting header observed; iframe storage lifetime unverified. |
| TurboWarp | `https://turbowarp.org/editor` | HTTP 200, same URL | No prohibiting header observed. Official player-embed support is not a promise about the editor. |
| MakeCode Arcade | `https://arcade.makecode.com/` | HTTP 200, same URL | No prohibiting header observed; simulator, local storage, and downloads unverified. |
| GeoGebra | `https://www.geogebra.org/calculator` | HTTP 200, same URL | CSP present but no prohibiting frame-ancestor directive observed. |
| wide.video | `https://wide.video/app/` | HTTP 200, redirected to `/app/1.7.12/` | No prohibiting header observed; sandboxed file access and exports unverified. Use the stable `/app/` entry, not the observed version path. |

## Integration requirements

1. Add a genuine original-site opening path for Piskel and Kleki before enabling their direct catalog entries. An iframe inside a new Aether tab is still blocked. That path can open the provider in the current top-level page or a separate provider tab according to the user's choice. Do not silently bypass frame policies or claim that a new proxy automatically fixes them.
2. Keep complex editors on provider-origin direct launch where possible, and expose an original-site fallback for file permissions or persistence. Credentialless iframe storage is not a reliable substitute for keeping exported project files.
3. Do not promise that Aether profile backups contain projects from any of these third-party apps. Document exports and local browser data separately.
4. Create original local cover illustrations. No provider asset download or redistribution permission is inferred from a reachable website.

## Selection decisions

- BeepBox and Song Maker cover different music workflows: structured multitrack composition and a quick beginner melody grid.
- Piskel and Kleki cover different artwork workflows: pixel sprites/animation and freehand layered painting.
- TurboWarp, MakeCode Arcade, and Twine offer distinct project styles: Scratch-compatible blocks, sprite-game code/simulator, and branching fiction.
- GeoGebra adds geometry and 3D mathematics alongside the existing graphing calculator.
- Figma, Photopea, Excalidraw, CodePen, Desmos, and general learning services were excluded from proposals because they already exist in the catalog. Account-heavy alternatives and duplicate forks were not added just to inflate the count.
