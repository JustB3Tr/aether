# Aether v5.1 brand

The identity stays graphite, mint teal and restrained violet. Outfit is self-hosted, distributed under the SIL Open Font License at `public/fonts/OFL.txt`. Pages have distinct compositions within the same world; their controls stay recognizable and readable.

## Production assets

| File | Actual dimensions | Bytes | Use |
| --- | --- | --- | --- |
| `public/assets/aether-mark.webp` | 256 × 205 | 11,830 | Transparent folded A monogram |
| `public/assets/favicon.png` | 64 × 51 | 4,278 | Browser icon |
| `public/assets/aether-portal.webp` | 1599 × 900 | 110,734 | Editorial Home portal |
| `public/assets/aether-observatory.webp` | 1672 × 941 | 95,064 | Focus introduction backdrop |

These dimensions and sizes are read from the current files. Artwork is decorative; meaningful names and controls are live HTML. Keep negative space behind headlines and adequate dark overlays behind text. Do not stretch the mark or place live-copy text inside the icon.

### Mark and wordmark

The generated monogram uses folded geometric teal ribbons, an orbital aperture, luminous edges and restrained violet detail. Its original source is `design/aether-mark.png`. The wordmark is live text, `aether.`, paired with the transparent mark.

### Home portal

The generated composition is an abstract orbital portal in a graphite universe, with teal ribbons, violet accents, floating geometric fragments on the right and dark room for the headline on the left. The original source is `design/aether-portal.png`; the production WebP preserves that composition.

### Focus observatory

The local 95 KB observatory scene adds a distinct setting to the Focus introduction. `public/spaces.css` layers a dark gradient over `/assets/aether-observatory.webp`; responsive crops keep the scene beside the text. The timer itself is a separate HTML/CSS composition, so the artwork does not hold the clock, its progress or any action.

## Page language

- **Home / Games:** editorial scale, Original-game cover art, clear discoveries and personal rails.
- **Apps:** creator and music spotlights plus a useful-tool shelf.
- **Focus:** observatory clock, lined field notes and small steps.
- **Party:** a rendezvous scene and practical room/chat surfaces; public temporary rooms are labeled honestly.
- **Browser:** globe gateway and route-specific UV, Scramjet and RH line art. No fake compatibility or security status.
- **Profile:** a personal passport, masked profile key and usable backup vault. The key's bearer-access warning stays visible.
- **Settings:** calm control groups, a sample collection that reflects real motion/spacing preferences, and visibly separate destructive controls.

## Motion contract

`public/app.js` stores the selected `system`, `full` or `reduced` preference and exposes the effective `data-motion` plus `data-motion-preference` on the document/body. Density uses `data-density`. Selecting a preference updates the interface immediately and emits `aether:settings`.

- Page, section and viewer entrances use brief opacity/translation. Optional intersection delivery never starts with hidden content.
- Fine-pointer hero depth in `public/experience.js` schedules work on pointer input, not a perpetual JavaScript frame loop. It resets on blur, hidden document, pointer/preference change and route preparation. Phone layouts disable that depth translation.
- Engine-card lifts and art scale are restricted to fine pointers and full motion. Browser and Settings orbit details are decorative CSS animations shown on their active pages.
- Explicit reduced motion stops decorative shell entrances, hover displacement and orbit motion. Device-reduced motion is respected under the system preference; an explicit full choice opts into the motion layer.
- Settings' sample collection responds to the actual density attribute. Its orbit responds to the actual motion preference; the sample cards are clearly previews rather than fake launch controls.
- The Originals have their own runtime and OS motion support. Explicit shell preference propagation into Original decorative UI remains a separate prior audit item. Necessary gameplay movement is not a decorative effect.

Use animation to support a transition or make a real action feel responsive. Do not make users wait through an entrance, hijack scrolling or require motion to navigate. Short-screen Focus rules keep the start action accessible below the introduction rather than letting decorative space dominate the page.

## Source layers

`public/styles.css` supplies the shared baseline. `public/experience.css` and `experience.js` own shell/motion details. `discovery.css`, `spaces.css` and `utility.css` own their page groups. `public/index.html` is the integrated markup; local design fragments are implementation inputs rather than shipped runtime files.

See [release notes](RELEASE-5.1.0.md) and the [next audit brief](NEXT-AUDIT-BRIEF.md). The visual refresh is not proof of new security boundaries or complete browser/game verification.

