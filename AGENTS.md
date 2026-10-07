# AGENTS.md

Instructions for AI coding agents working in this repository. The full brief is in [`CLAUDE.md`](CLAUDE.md): read it first. This file is the short version.

## Commands
| | |
|---|---|
| `npm install` | install dependencies (Node 22.12+) |
| `npm run dev` | dev server at http://localhost:4321 |
| `npm run build` | static build into `dist/` |
| `npm run preview` | serve the build |
| `node scripts/shots.mjs / 0,0.2,0.5` | screenshot a page at scroll positions (needs the dev server and Google Chrome) |

There is no test suite. "Done" means: `npm run build` passes, and you have looked at screenshots of every page you touched.

## Where things are
| | |
|---|---|
| `src/content/*.json` | all copy and event data. Edit these, not components |
| `src/styles/tokens.css` | colours, fonts, themes |
| `src/components/{layout,home,event,ui}` | Astro components |
| `src/scripts/motion/` | GSAP/Lenis engine, reveals, cursor, picker, physics |
| `src/scripts/three/` | WebGL: `post.ts` (projection pass), `heroScene.ts`, `eventScene.ts` + `events/*` |
| `docs/PROJECT-LOG.md` | what was built, decisions, lessons |

## Rules
1. Frontend only. No backend, no forms that submit, no invented dates, venues, prices or pages.
2. Content lives in `src/content`. Never hardcode copy in a component.
3. Everything must work with JavaScript off and with `data-motion="off"`.
4. One 3D scene per page, always through the projection pass, always with a static fallback.
5. Holograms are lines, panes and light. No particle clouds.
6. Match the surrounding code: its comments, naming and structure.
7. Don't commit unless asked.
