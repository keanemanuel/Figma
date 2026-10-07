# CISSA — What's in Product?

The website for CISSA's product events: Product-thon, Design Blitz, Portfolio Impressions and Figma Workshops. Static site, frontend only, built from the Figma file and then set in motion.

## Run it

```bash
npm install        # Node 22.12 or newer
npm run dev        # http://localhost:4321
npm run build      # static site in dist/
npm run preview    # serve dist/
```

## Update the content (no code needed)

Everything you can read on the site is in two files.

**`src/content/site.json`**: navbar links, the home headline, the picker heading, the closing call to action, social links, the boot-screen lines.

**`src/content/events.json`**: the four events. For each one:

| field | what it is |
|---|---|
| `slug` | the URL: `/events/<slug>` |
| `name`, `title`, `kicker`, `tags` | names and labels. `title` is the big title, one entry per line |
| `outline` / `serif` | which title line is drawn as an outline / in italic serif (`-1` = none) |
| `card` | the one-liner on the home page card |
| `tagline`, `description` | the two text beats in the 3D intro; `description` is also the page's paragraph |
| `steps` | the three or four steps (levels, phases, stages, topics) |
| `facts` | the Date / Venue / Entry row: **replace the `[PLACEHOLDER]` values here** |
| `cta`, `registerUrl` | the button. `"#"` shows a "coming soon" toast; put the sign-up link here |
| `theme`, `scene` | colours and 3D intro. Leave these unless you are adding an event |

What still needs real values is listed in [`PLACEHOLDERS.md`](PLACEHOLDERS.md).

## How it is put together

```
src/
  content/            site.json, events.json        all copy
  lib/content.ts      typed access to the content
  layouts/            BaseLayout.astro              head, background, navbar, footer, boot screen
  pages/              index, events/[slug], 404
  components/
    layout/           MotionHead, Loader, Navbar, Footer, Toast
    home/             HomeHero, EventPicker, JoinCta
    event/            EventIntro3D, EventBody, EventVisual
    ui/               SignalRule, MCursor
  styles/             tokens (themes), base, home, event, motion
  scripts/
    motion/           index (kill switch) → engine (GSAP + Lenis) → reveals, cursor,
                      effects, picker, physics, signalRule
    three/            loader (lazy mount) → post (projection pass) → heroScene,
                      eventScene + events/{arcade,sprint,glance,canvas}
scripts/shots.mjs     screenshots a page at scroll positions (headless Chrome)
docs/PROJECT-LOG.md   what was built, the decisions, what we learned
```

### Motion, in one paragraph

`MotionHead.astro` sets `<html data-motion="on|off">` before paint (off for reduced motion, or the footer toggle). With it off nothing below is downloaded and every page is its static Figma layout. With it on, `scripts/motion/engine.ts` starts smooth scroll and everything opted in through data attributes, and `scripts/three/loader.ts` mounts the page's one 3D scene behind the boot screen. Both tear down before each page transition and start again after.

### Adding things

- **A reveal on any element:** `data-reveal="fade-up | decode | glitch | scan | flip"`.
- **A magnetic button / tilting card:** `data-magnetic` / `data-tilt`.
- **Cursor label over something:** `data-cursor="Enter"`.
- **A new event:** add it to `events.json`, add a theme in `styles/tokens.css`, a card style (`.pcard--<id>`) in `styles/home.css`, an illustration in `EventVisual.astro`, and a scene builder in `scripts/three/events/` registered in `events/index.ts`.

### Checking your work

```bash
npm run dev
node scripts/shots.mjs /events/design-blitz 0,0.3,0.6,1          # desktop
node scripts/shots.mjs / 0,0.5,1 390 844                         # phone size
```

Images land in `.shots/`; console errors are printed. Needs Google Chrome installed (set `CHROME=/path/to/chrome` if it is somewhere unusual).

## Deploy

It is a plain static build. On Vercel: import the repository, framework preset "Astro", no settings to change. Set `site` in `astro.config.mjs` to the real domain first (canonical and social-share URLs use it).
