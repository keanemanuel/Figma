/**
 * Event picker (<EventPicker />). On desktop the stage pins and scrolling
 * moves the selection through the cards: the first stretch shows the whole
 * grid, then each event gets an equal share of the scroll. The selected card
 * lifts and its art plays; the stage re-inks in that event's colour (only the
 * stage: re-theming <body> would restyle the whole page mid-scroll). Enter
 * opens the selected event. Phones keep the plain stacked cards.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Cleanup = () => void;
const LEAD = 0.1; // share of the scroll before the first card is selected

export function picker(): Cleanup {
  const host = document.querySelector<HTMLElement>('[data-picker]');
  const stage = host?.querySelector<HTMLElement>('[data-picker-stage]');
  if (!host || !stage) return () => {};
  const cards = [...host.querySelectorAll<HTMLAnchorElement>('[data-pcard]')];
  const pips = [...host.querySelectorAll<HTMLElement>('[data-pip]')];
  const inks = cards.map((c) => getComputedStyle(c).getPropertyValue('--ink').trim());
  const mq = matchMedia('(min-width: 900px) and (min-height: 600px)');
  const n = cards.length;

  let pinned = false;
  let current = -1;
  let top = 0;
  let span = 1;
  const fills: string[] = [];

  const select = (i: number) => {
    if (i === current) return;
    current = i;
    host.classList.toggle('has-focus', i >= 0);
    cards.forEach((c, k) => c.classList.toggle('is-focus', k === i));
    pips.forEach((p, k) => p.classList.toggle('is-on', k === i));
    if (i >= 0 && inks[i]) {
      stage.style.setProperty('--c-primary', inks[i]);
      stage.style.setProperty('--c-glow', `color-mix(in srgb, ${inks[i]} 30%, transparent)`);
    } else {
      stage.style.removeProperty('--c-primary');
      stage.style.removeProperty('--c-glow');
    }
  };

  // Cached geometry: no layout reads per frame.
  const measure = () => {
    const r = host.getBoundingClientRect();
    top = r.top + scrollY;
    span = Math.max(1, r.height - stage.offsetHeight);
  };
  const apply = () => {
    pinned = mq.matches;
    host.classList.toggle('is-pinned', pinned);
    if (!pinned) select(-1);
    measure();
    ScrollTrigger.refresh();
  };
  apply();
  mq.addEventListener('change', apply);
  const ro = new ResizeObserver(measure);
  ro.observe(document.body);

  const tick = () => {
    if (!pinned) return;
    const raw = (scrollY - top) / span;
    const q = (raw - LEAD) / (1 - LEAD);
    select(raw < 0 || raw > 1.03 || q < 0 ? -1 : Math.min(n - 1, Math.floor(q * n)));
    pips.forEach((p, k) => {
      const fill = Math.min(1, Math.max(0, q * n - k)).toFixed(3);
      if (fill !== fills[k]) p.style.setProperty('--fill', (fills[k] = fill));
    });
  };
  gsap.ticker.add(tick);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || current < 0 || (e.target as Element)?.closest?.('a, button, input, textarea')) return;
    cards[current].click();
  };
  window.addEventListener('keydown', onKey);

  return () => {
    gsap.ticker.remove(tick);
    mq.removeEventListener('change', apply);
    ro.disconnect();
    window.removeEventListener('keydown', onKey);
    select(-1);
    host.classList.remove('is-pinned');
  };
}
