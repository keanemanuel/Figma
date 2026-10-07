# Project log: CISSA "What's in Product?"

What was built, in what order, the decisions behind it, and what we learned. For how to change content see [`README.md`](../README.md); for the rules see [`CLAUDE.md`](../CLAUDE.md).

Built 7 October 2026 with Claude Code, directed by Kean.

---

## 1. Timeline

| Step | What |
|---|---|
| 1 | Read the Figma file through the Figma MCP server: 7 frames, fonts, colours, the logo (exported as SVG, background rectangles removed). |
| 2 | Astro project, design tokens and five themes, content in `site.json` / `events.json`. |
| 3 | Static site: home hero, event picker (the Figma bento grid), closing call to action, four event pages with their illustrations rebuilt in HTML/CSS (console, process stack, portfolio fan, editor window). |
| 4 | Motion engine: kill switch, GSAP + Lenis, `data-reveal` system, cursor, magnetic buttons, tilt, signal-rule dividers, sonar pings, navbar hide. |
| 5 | Pinned event picker (scroll selects, Enter opens) and the Matter.js physics pit. |
| 6 | Boot screen (boot / re-sync) and the shutter page transition. |
| 7 | WebGL: projection pass, lazy loader, four event intro scenes, home intro. |
| 8 | **Home intro redone twice.** v1: a particle orb that exploded and reassembled into four icons, with a "Four ways in" screen. Rejected: cluttered, and the explode-and-reassemble idea belongs to another site. v2 (never shown): the globe unfurling into a ring tunnel. v3, current: a hologram projector from the reference images (puck, beam, glass case, floating screens), which hands straight over to the picker. |
| 9 | Checked every page in headless Chrome at 1440 × 900 and the home page at 390 × 844; fixed what the screenshots showed. |

## 2. How the main pieces work

- **The projection pass** (`three/post.ts`). Every scene renders to an offscreen target, then one full-screen shader shows it: optional pixel blocks, the red and blue channels sampled a few pixels apart, scanlines, a cheap 8-tap glow, grain, and row tearing. Scenes change these per frame through a `Print` object (the arcade scene blows the pixels up to hide its cut; the portfolio scene tears once when the brackets lock). Scroll speed adds split and tearing everywhere. "Emissive" mode (home) takes alpha from brightness, so light composites over the page like light.
- **Home intro** (`three/heroScene.ts`). A group of plain meshes: cylinder puck, a cone whose shader draws streaks, a box drawn as edges plus faint panes, a globe made of thin torus rings, three planes textured from a 2D canvas. The rig is fitted to the box the Figma orb occupies, so it sits where the design puts the orb at any screen size. Two overlay `div`s driven by `--p` do the white-out and the fade to dark.
- **Event intros** (`three/eventScene.ts` + `events/*`). One engine pins the stage, smooths scroll and pointer, and calls the scene's `update({ p, t, mx, my, print })`. Each scene is primitives posed as a function of `p`. Text beats are DOM, faded by CSS `clamp()` on `--p`.
- **Picker** (`motion/picker.ts`). Progress through the pinned section picks a card; classes do the rest. Only the stage is re-inked.
- **Physics** (`motion/physics.ts`). Matter.js bodies with DOM pills positioned from them. Dragging is our own pointer handling (a spring to the finger), not Matter's mouse constraint, so touching anything but a pill still scrolls the page.
- **Reveals** (`motion/reveals.ts`). One GSAP timeline per element, built from its `data-reveal` type; elements on screen at load wait for the boot screen to open.

## 3. Decisions

- **Plain CSS, no Tailwind.** The design is a handful of bespoke screens; tokens plus a few stylesheets is less code than utilities would be here.
- **The Figma grid image became CSS.** Same look, but it can light up round the pointer.
- **Event pages keep the full Figma screen below the 3D intro.** The intro is hidden unless motion and WebGL are available, so the page never depends on it.
- **The cursor is the Figma multiplayer cursor.** It was already in the design (the Workshops screens), so it became the site's cursor.
- **Placeholders stay visible as `[DATE]`.** Nothing is invented.

## 4. Lessons

- A centred grid item shrinks to its content: an illustration sized in percentages inside it collapses to nothing (Portfolio page). Give it `width: 100%`.
- A `MeshBasicMaterial` with additive blending rendered into a transparent target ends up with squared alpha. Deriving alpha from brightness in the post pass fixes it for scenes made of light.
- Looking at screenshots at several scroll positions caught every layout bug here; the build passing caught none.

## 5. Not done / before launch

- Real-device testing (iPhone Safari, mid-range Android). Only desktop Chrome and an emulated phone viewport have been checked.
- Lighthouse and a contrast audit.
- Real dates, venues, prices and links (`PLACEHOLDERS.md`).
- A social share image and the real `site` URL.
