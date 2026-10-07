/**
 * Reveal system. Any element opts in with a data attribute, no new code:
 *
 *   data-reveal="fade-up | decode | glitch | scan | flip"
 *   data-reveal-delay="0.2"     seconds before it starts
 *   data-reveal-children        animate each child in turn instead of the element
 *   data-reveal-stagger="0.1"   gap between children (default 0.08)
 *
 *   fade-up  rises into place
 *   decode   text resolves out of random glyphs, left to right
 *   glitch   lands split into two colour channels, in steps, then locks
 *   scan     projected line by line: scanlines thicken until solid
 *   flip     tips up from flat, like a panel opening
 *
 * Content is never hidden before this script runs. Elements already on screen
 * at load animate as soon as the boot screen opens; the rest as they scroll in.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export interface RevealHandle {
  kill(): void;
}

const CLEAR = 'opacity,visibility,transform,translate,rotate,scale,--gl,--sc-h';
const GLYPHS = '01<>/[]{}#_=+*';

interface Ctx {
  targets: HTMLElement[];
  tl: gsap.core.Timeline;
  stagger: number;
}
type Builder = (ctx: Ctx) => void | (() => void);

const builders: Record<string, Builder> = {
  'fade-up': ({ targets, tl, stagger }) => {
    tl.fromTo(targets, { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger });
  },

  decode: ({ targets, tl }) => {
    const restores: (() => void)[] = [];
    targets.forEach((el) => {
      const nodes: { node: Text; text: string }[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push({ node: walker.currentNode as Text, text: walker.currentNode.nodeValue ?? '' });
      const total = nodes.reduce((n, x) => n + x.text.length, 0) || 1;
      const restore = () => nodes.forEach((n) => (n.node.nodeValue = n.text));
      restores.push(restore);
      const state = { v: 0 };
      const draw = () => {
        let seen = 0;
        for (const n of nodes) {
          let out = '';
          for (const ch of n.text) out += ch === ' ' || seen++ / total < state.v ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
          n.node.nodeValue = out;
        }
      };
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 0);
      tl.to(state, { v: 1, duration: Math.min(1.4, 0.4 + total * 0.025), ease: 'none', onStart: draw, onUpdate: draw, onComplete: restore }, 0);
    });
    return () => restores.forEach((r) => r());
  },

  glitch: ({ targets, tl, stagger }) => {
    targets.forEach((t) => t.classList.add('reveal-gl'));
    tl.fromTo(
      targets,
      { autoAlpha: 0, '--gl': 1, x: -26, skewX: 14 },
      { autoAlpha: 1, '--gl': 0, x: 0, skewX: 0, duration: 0.7, ease: 'steps(7)', stagger },
    );
    return () => targets.forEach((t) => t.classList.remove('reveal-gl'));
  },

  scan: ({ targets, tl, stagger }) => {
    targets.forEach((t) => t.classList.add('reveal-scan'));
    tl.fromTo(targets, { autoAlpha: 1, '--sc-h': '0%', '--gl': 1 }, { '--sc-h': '100%', '--gl': 0, duration: 1.2, ease: 'power2.inOut', stagger });
    return () => targets.forEach((t) => t.classList.remove('reveal-scan'));
  },

  flip: ({ targets, tl, stagger }) => {
    tl.fromTo(
      targets,
      { autoAlpha: 0, rotateX: -62, y: 60, transformPerspective: 1200, transformOrigin: '50% 100%' },
      { autoAlpha: 1, rotateX: 0, y: 0, duration: 1, ease: 'power3.out', stagger },
    );
  },
};

/** Runs cb once the boot screen is no longer covering the page. */
function whenUncovered(cb: () => void) {
  const d = document.documentElement;
  if (d.dataset.loading !== 'on') return cb();
  const mo = new MutationObserver(() => {
    if (d.dataset.loading === 'on') return;
    mo.disconnect();
    cb();
  });
  mo.observe(d, { attributes: true, attributeFilter: ['data-loading'] });
}

export function buildReveal(el: HTMLElement): RevealHandle | undefined {
  const build = builders[el.dataset.reveal ?? ''];
  if (!build) {
    console.warn(`[reveal] Unknown data-reveal="${el.dataset.reveal}"`, el);
    return undefined;
  }
  // Not rendered: nothing to animate. It's never hidden, so it still shows if it appears later.
  if (!el.getClientRects().length) return undefined;

  const targets = el.hasAttribute('data-reveal-children') ? (Array.from(el.children) as HTMLElement[]) : [el];
  const stagger = Number(el.dataset.revealStagger ?? 0.08);
  const rect = el.getBoundingClientRect();
  const inView = rect.top < innerHeight && rect.bottom > 0;

  let cleanup: void | (() => void);
  let killed = false;
  const finish = () => {
    cleanup?.();
    gsap.set(targets, { clearProps: CLEAR });
  };
  const tl = gsap.timeline({ paused: true, delay: Number(el.dataset.revealDelay ?? 0), onComplete: finish });
  // fromTo() renders its start state immediately, so nothing flashes before it plays.
  cleanup = build({ targets, tl, stagger });

  let trigger: ScrollTrigger | undefined;
  if (inView) whenUncovered(() => !killed && tl.play());
  else trigger = ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => tl.play() });

  return {
    kill() {
      killed = true;
      trigger?.kill();
      tl.kill();
      finish();
    },
  };
}
