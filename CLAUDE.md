# CLAUDE.md — CISSA "What's in Product?" website

## Project context
- Website for **CISSA**'s product events, under the headline **"What's in Product?"**. Student-run.
- Design source: Figma file `HOLf9SgIXM4v4HxNgNnlGW` (7 frames at 1728 × 1117: home hero, event picker, one screen per event, closing call to action). Read it through the Figma MCP server (`claude mcp add --transport http figma https://mcp.figma.com/mcp`).
- Events: there are exactly four, no others (source: the Figma file):
  - `thon`: **Product-thon**, hackathon × product strategy (theme `thon`, scene `arcade`)
  - `blitz`: **Design Blitz**, UX/UI challenge: research → ideate → prototype (theme `blitz`, scene `sprint`)
  - `folio`: **Portfolio Impressions**, portfolio review (theme `folio`, scene `glance`)
  - `lab`: **Figma Workshops**, hands-on workshop, the only light page (theme `lab`, scene `canvas`)
- Dates, venues, prices and team sizes are **not known yet**: the Figma file shows `[DATE]`, `[VENUE]`, `[PRICE]`, `[TEAM SIZE]` and so does the site. Don't invent them.

## Current scope: FRONTEND ONLY
- No backend, no database, no auth, no CMS, no payments.
- Join / Register / About / Career Portal / Meet the team / socials = links with `href="#"`. They show a "coming soon" toast (`components/layout/Toast.astro`). Leave a clear `TODO(backend)` when wiring them.
- All content comes from local files in `src/content` (JSON).

## Placeholders
- Every `[PLACEHOLDER]` value and every `#` link is listed in `PLACEHOLDERS.md` with the file and key to change.
- There are no photos or videos: all artwork is CSS or WebGL, built from primitives. If real media arrives, add a `media.json` map (key → path) rather than hardcoding paths.

## Tech stack
- **Astro** (static output), plain CSS with design tokens (no Tailwind)
- **GSAP** + ScrollTrigger (site-wide motion)
- **Lenis** (smooth scroll)
- **Three.js** (3D, lazy-loaded, one scene per page)
- **Matter.js** (the physics pit on the home page)
- **Astro View Transitions** (`ClientRouter`, page transitions)
- Fonts self-hosted through `@fontsource/*`
- Deploy target: any static host (Vercel works with zero config)

## Design concept
**The site is a hologram being projected.** Things arrive as scanlines that thicken until solid, split slightly into two colour channels, tear when pushed too fast, then lock.
- Near-black page, a faint grid, teal light. One accent per event.
- Big wide display type (Michroma), one word of each title drawn as an outline.
- Lots of negative space. One main object per screen.
- Holograms are **lines, panes and light**: wireframes, glass, beams, screens. **Not clouds of particles.** (Decided Oct 2026: the first home intro was a particle orb that exploded and reassembled; it was rejected as cluttered and too close to another site.)

### Colour themes (CSS variables, switched via `data-theme`; `src/styles/tokens.css`)
| theme | bg | primary | accent | used for |
|---|---|---|---|---|
| base | #0B0C0E | #00C3D0 | #8B7BFF | home, 404 |
| thon | #0B0C0E | #5FE3E0 | #FFD34D | Product-thon |
| blitz | #0D0C18 | #B3A6FF | #5FE3E0 | Design Blitz |
| folio | #0B0C0E | #5FE3E0 | #8B7BFF | Portfolio Impressions |
| lab | #F4F4F2 | #1A8F8C | #2B8CFF | Figma Workshops |

`--ink` is the single colour that stands for an event outside its own page (picker, pills).

### Typography
| role | font | fallback |
|---|---|---|
| Display / titles | Michroma | Arial Black, sans-serif |
| Navbar | Unbounded Light | Michroma |
| Body, buttons | Montserrat | system-ui |
| Kickers, labels | JetBrains Mono | ui-monospace |
| Game / HUD text | Press Start 2P | monospace |
| Script line ("impressions") | Instrument Serif Italic | Georgia |
| Sticky-note handwriting | Caveat | cursive |

## Motion direction
- Rich, **site-wide** motion: every page and section has some.
- Reusable reveals via data attributes, so content opts in without new code:
  `data-reveal="fade-up | decode | glitch | scan | flip"` (+ `data-reveal-delay`, `data-reveal-children`, `data-reveal-stagger`)
- Other opt-ins: `data-magnetic` (buttons), `data-tilt` (cards), `data-cursor="Label"` (what the cursor's name tag says), `data-countdown`, `<SignalRule />` (live divider).
- What exists:
  - **Boot screen** on every hard load (full log on the first page of a visit, a short "re-sync" on reloads)
  - **Home intro**: a hologram projector (puck, beam, glass case, globe); scrolling opens the case, screens rise out of the beam, and the view pushes into the EVENTS screen and lands in the picker
  - **Event picker**: pinned; scrolling moves the selection through the four cards; Enter opens
  - **Event intros**: one scroll-driven 3D scene per event (`src/scripts/three/events/*`)
  - **Cursor**: a Figma-style multiplayer cursor with a name tag and a pixel trail; a sonar ping on every click or tap
  - **Touch physics**: tag pills you can grab and throw (home, bottom); dividers that bend to the pointer or a finger; drag to spin the globe
  - **Page transition**: blinds in the next page's colour close and open

### Motion rules (non-negotiable)
- Heavy 3D: **max one scene per page**. Everything else is GSAP + CSS/SVG.
- 3D always goes through the projection pass (`src/scripts/three/post.ts`): scanlines, channel split, tearing, optional pixel blocks.
- **Mobile** runs lighter 3D (fewer objects, lower resolution, adaptive quality).
- Respect **`prefers-reduced-motion`**: `<html data-motion="off">` disables all motion, and GSAP/Lenis/Three/Matter are never downloaded. There is a manual toggle in the footer.
- Content must render and be readable **without JS**. Reveals never hide anything before the engine has loaded.
- No animation may block reading, clicking, or registering. Intros have a "Skip intro" link; the boot screen skips on any tap or key.
- Lazy-load Three.js; dispose WebGL contexts on page leave.

## Site structure
- `/`: home (hero → event picker → join)
- `/events/product-thon`, `/events/design-blitz`, `/events/portfolio-impressions`, `/events/figma-workshops`
- `/404`
- No About, Team or Career Portal pages yet: they are not in the Figma file. Don't invent them.

## Content rules
- **Never hardcode content in components.** Site copy is in `src/content/site.json`, events in `src/content/events.json`.
- Adding or editing an event = editing `events.json` only (see `README.md`).

## Quality bar
- Responsive at 375 / 768 / 1440; the Figma frames are the 1728 reference.
- WCAG AA contrast in every theme. Semantic HTML, one `h1` per page, decoration is `aria-hidden`.
- Per-page title + description + OG tags.

## Performance rules (keep these)
- No `overflow: hidden/clip` on an **ancestor** of a `position: sticky` stage (iOS Safari shakes it). Clipping the stage itself is fine.
- Fixed full-screen layers use `height: 100lvh`.
- Never re-theme `<body>` during a scroll animation; the picker re-inks only its own stage.
- 3D: 60 fps cap and time-based easing (`frameLoop`, `ease` in `post.ts`), build behind the boot screen, render only while on screen.
- Don't read layout every frame after writing styles: cache positions and re-measure on resize.

## Working style
- After motion, 3D or layout changes, run `npm run build`, then look at the result: `node scripts/shots.mjs <path> <scroll stops>` screenshots a page with headless Chrome (dev server must be running).
- These have only been checked in desktop Chrome and an emulated phone viewport. Before launch, check on a real iPhone (Safari) and a mid-range Android.
- Keep components small and reusable. Prefer data attributes and config over one-off code.
