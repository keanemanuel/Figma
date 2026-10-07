# Placeholders

Everything on the site that stands in for something real. Replace the value in the file shown; no code changes needed.

## Event facts (`src/content/events.json` → `facts`)

| event | label | current value |
|---|---|---|
| Product-thon | Date | `[DATE]` |
| Product-thon | Venue | `[VENUE]` |
| Product-thon | Entry | `[PRICE]` |
| Design Blitz | Date | `[DATE]` |
| Design Blitz | Team size | `[TEAM SIZE]` |
| Design Blitz | Entry | `[PRICE]` |
| Portfolio Impressions | Date | `[DATE]` |
| Portfolio Impressions | Venue | `[VENUE]` |
| Figma Workshops | Date | `[DATE]` |
| Figma Workshops | Venue | `[VENUE]` |
| Figma Workshops | `ticker` (the scrolling strip) | contains `[DATE] / [VENUE]` |

## Links that go nowhere yet (`href: "#"` → "coming soon" toast)

| what | file | key |
|---|---|---|
| Join CISSA (navbar, closing section) | `site.json` | `joinUrl` |
| About, Career Portal | `site.json` | `nav[].href` |
| Meet the team | `site.json` | `hero.secondary.href` |
| Instagram, Discord, LinkedIn | `site.json` | `socials[].href` |
| Register interest / Join the Blitz / Book a review slot / Save your seat | `events.json` | `registerUrl` per event |

## Other

| what | where | note |
|---|---|---|
| Site address | `astro.config.mjs` → `site` | `https://cissa-product.example.com` until the real domain is known |
| Social share image | none yet | add an `og:image` in `BaseLayout.astro` when there is one |
| Hero kicker | `site.json` → `hero.kicker` | `[ PRODUCTHON / WEEK 04 / WORKSHOPS ]`, copied from Figma as written |
| Countdown on the Design Blitz card | `scripts/motion/effects.ts` → `countdowns` | counts down from 48:00:00 from page load: decoration, not a real deadline |
| Console HUD, editor panel text | `components/event/EventVisual.astro` | illustration copy from Figma ("IDEAS 03", "cissa-workshop.fig"); the only text not in `src/content` |

## Differences from the Figma file, on purpose

- Hero line: Figma says "Where ideas get validate"; the site says "validated".
- Design Blitz tags: its event screen in Figma repeats Product-thon's tags (Hackathon / Product / Paid Entry); the site uses the tags from its home card (Hackathon / UX/UI / Paid Entry) in both places.
- The orbit label "04 Figma Lab" (hero) and the event name "Figma Workshops" are both kept as drawn.
- With motion on, the hero's orb is replaced by the hologram projector. With motion off you get the Figma orb.
