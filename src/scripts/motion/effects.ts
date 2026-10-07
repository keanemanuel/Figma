/**
 * Site-wide effects, each opt-in through markup so pages need no custom code.
 * Every setup returns a cleanup run before the next page swap.
 *
 *   .bg                     the grid lights up around the pointer
 *   (everything)            a sonar ping on every click / tap
 *   [data-magnetic]         buttons lean toward the pointer and spring back (desktop)
 *   [data-tilt]             cards tilt in 3D with a glare that follows the pointer (desktop)
 *   [data-nav]              header hides on the way down, returns on the way up
 *   [data-countdown]        a running HH:MM:SS countdown
 */
import gsap from 'gsap';
import type Lenis from 'lenis';

type Cleanup = () => void;
const desktop = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export function pointerGlow(): Cleanup {
  const bg = document.querySelector<HTMLElement>('.bg');
  if (!bg || !desktop()) return () => {};
  const root = document.documentElement;
  let x = 0;
  let y = 0;
  let dirty = false;
  const onMove = (e: PointerEvent) => {
    x = e.clientX;
    y = e.clientY;
    dirty = true;
    root.classList.add('has-pointer');
  };
  const tick = () => {
    if (!dirty) return;
    dirty = false;
    bg.style.setProperty('--mx', `${x}px`);
    bg.style.setProperty('--my', `${y}px`);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  gsap.ticker.add(tick);
  return () => {
    window.removeEventListener('pointermove', onMove);
    gsap.ticker.remove(tick);
    root.classList.remove('has-pointer');
  };
}

export function pings(): Cleanup {
  const onDown = (e: PointerEvent) => {
    const ping = document.createElement('div');
    ping.className = 'ping';
    ping.setAttribute('aria-hidden', 'true');
    ping.style.left = `${e.clientX}px`;
    ping.style.top = `${e.clientY}px`;
    // Inked like whatever was tapped.
    const theme = ((e.target as Element | null)?.closest?.('[data-theme]') as HTMLElement | null)?.dataset.theme;
    if (theme) ping.dataset.theme = theme;
    ping.innerHTML = '<i></i><i></i><i></i>';
    document.body.append(ping);
    setTimeout(() => ping.remove(), 1000);
  };
  window.addEventListener('pointerdown', onDown, { passive: true });
  return () => window.removeEventListener('pointerdown', onDown);
}

export function magnetic(): Cleanup {
  if (!desktop()) return () => {};
  const offs: Cleanup[] = [];
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const inner = el.firstElementChild as HTMLElement | null;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: x * 0.28, y: y * 0.4, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      if (inner) gsap.to(inner, { x: x * 0.12, y: y * 0.16, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
    };
    const leave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' });
      if (inner) gsap.to(inner, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    offs.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      gsap.killTweensOf([el, inner]);
      gsap.set([el, inner], { clearProps: 'transform' });
    });
  });
  return () => offs.forEach((f) => f());
}

export function tilt(): Cleanup {
  if (!desktop()) return () => {};
  const offs: Cleanup[] = [];
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    const face = card.querySelector<HTMLElement>(':scope > .pcard__in') ?? card;
    gsap.set(face, { transformPerspective: 900 });
    const rx = gsap.quickTo(face, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    const ry = gsap.quickTo(face, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      ry((x - 0.5) * 9);
      rx((0.5 - y) * 8);
      face.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      face.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    };
    const leave = () => (rx(0), ry(0));
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerleave', leave);
    offs.push(() => {
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerleave', leave);
      gsap.set(face, { clearProps: 'transform' });
    });
  });
  return () => offs.forEach((f) => f());
}

export function navbar(lenis: Lenis | undefined): Cleanup {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav || !lenis) return () => {};
  let hidden = false;
  let stuck = false;
  const onScroll = () => {
    const y = lenis.scroll;
    const nextStuck = y > 40;
    if (nextStuck !== stuck) nav.classList.toggle('is-stuck', (stuck = nextStuck));
    const nextHidden = y > 240 && lenis.direction === 1 ? true : lenis.direction === -1 ? false : hidden;
    if (nextHidden !== hidden) nav.classList.toggle('is-hidden', (hidden = nextHidden));
  };
  lenis.on('scroll', onScroll);
  onScroll();
  return () => nav.classList.remove('is-stuck', 'is-hidden');
}

export function countdowns(): Cleanup {
  const els = [...document.querySelectorAll<HTMLElement>('[data-countdown]')];
  if (!els.length) return () => {};
  const start = Date.now();
  const tick = () => {
    const left = Math.max(0, 48 * 3600 - Math.floor((Date.now() - start) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    const text = `[${pad(Math.floor(left / 3600))}:${pad(Math.floor(left / 60) % 60)}:${pad(left % 60)}]`;
    els.forEach((el) => (el.textContent = text));
  };
  const id = window.setInterval(tick, 1000);
  return () => clearInterval(id);
}
