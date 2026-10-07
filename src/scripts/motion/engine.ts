/**
 * GSAP + ScrollTrigger + Lenis, loaded only when motion is on.
 * start() runs on every page load, stop() before every page swap.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { buildReveal, type RevealHandle } from './reveals';
import { startCursor, type CursorHandle } from './cursor';
import { countdowns, magnetic, navbar, pings, pointerGlow, tilt } from './effects';
import { picker } from './picker';
import { physics } from './physics';
import { signalRules } from './signalRule';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | undefined;
let cursor: CursorHandle | undefined;
const reveals: RevealHandle[] = [];
let cleanups: (() => void)[] = [];
const raf = (time: number) => lenis?.raf(time * 1000);

/** In-page links (#id, or /#id on the home page) scroll with Lenis instead of jumping. */
const onAnchorClick = (e: MouseEvent) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const link = (e.target as Element | null)?.closest?.('a[href*="#"]') as HTMLAnchorElement | null;
  if (!link || !lenis) return;
  const url = new URL(link.href, location.href);
  if (url.pathname !== location.pathname || url.hash.length < 2) return;
  const target = document.getElementById(url.hash.slice(1));
  if (!target) return;
  e.preventDefault();
  lenis.scrollTo(target, { duration: 1.4 });
  history.replaceState(history.state, '', url.hash);
};

export function start() {
  stop();

  // Smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync.
  lenis = new Lenis({ autoRaf: false, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const handle = buildReveal(el);
    if (handle) reveals.push(handle);
  });

  document.addEventListener('click', onAnchorClick, true);
  cursor = startCursor();
  cleanups = [pointerGlow(), pings(), magnetic(), tilt(), navbar(lenis), countdowns(), picker(), physics(), signalRules(lenis)];
  ScrollTrigger.refresh();

  // Arriving on /#events from another page.
  if (location.hash.length > 1) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) lenis.scrollTo(target, { immediate: true });
  }
}

export function stop() {
  reveals.splice(0).forEach((r) => r.kill());
  cleanups.forEach((c) => c());
  cleanups = [];
  ScrollTrigger.getAll().forEach((t) => t.kill());
  document.removeEventListener('click', onAnchorClick, true);
  gsap.ticker.remove(raf);
  lenis?.destroy();
  lenis = undefined;
  cursor?.destroy();
  cursor = undefined;
}
