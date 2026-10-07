/**
 * The cursor is a multiplayer cursor, like the ones in the Figma file: an
 * arrow with a name tag that says "You", and says what a click will do when
 * it is over something ([data-cursor="Enter"], links, buttons). It leaves a
 * trail of pixels snapped to a grid that shrink out. Desktop only (fine
 * pointer, hover). The native cursor comes back over form fields.
 */
import gsap from 'gsap';

export interface CursorHandle {
  destroy(): void;
}

const GRID = 10; // trail cell, px
const LIFE = 0.5; // seconds a trail pixel lives
const NAME = 'You';

export function startCursor(): CursorHandle | undefined {
  if (!matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches) return undefined;

  const root = document.documentElement;
  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="0 0 17 18"><path d="M0.5 0.5 16 6.6 9.2 9.4 6.4 17.2Z"/></svg><span class="cursor__tag">${NAME}</span>`;
  const tag = el.querySelector<HTMLElement>('.cursor__tag')!;
  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-trail';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas, el);
  root.classList.add('has-cursor');

  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const moveX = gsap.quickTo(el, 'x', { duration: 0.12, ease: 'power3.out' });
  const moveY = gsap.quickTo(el, 'y', { duration: 0.12, ease: 'power3.out' });

  // Trail: one pixel per grid cell, keyed by cell, refreshed when the pointer passes again.
  const cells = new Map<number, { x: number; y: number; age: number }>();
  let last: { x: number; y: number } | undefined;
  let ink = '#00c3d0';
  let inkAt = 0;
  const stamp = (x: number, y: number) => {
    const cx = Math.round(x / GRID);
    const cy = Math.round(y / GRID);
    cells.set(cy * 10000 + cx, { x: cx * GRID, y: cy * GRID, age: 0 });
    // A few stray pixels beside the path, already half faded.
    if (Math.random() < 0.3) {
      const ox = cx + ((Math.random() * 5) | 0) - 2;
      const oy = cy + ((Math.random() * 5) | 0) - 2;
      const key = oy * 10000 + ox;
      if (!cells.has(key)) cells.set(key, { x: ox * GRID, y: oy * GRID, age: LIFE * 0.5 });
    }
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    el.classList.add('is-visible');
    moveX(e.clientX);
    moveY(e.clientY);
    const from = last ?? { x: e.clientX, y: e.clientY };
    const steps = Math.max(1, Math.ceil(Math.hypot(e.clientX - from.x, e.clientY - from.y) / GRID));
    for (let i = 1; i <= steps; i++) stamp(from.x + ((e.clientX - from.x) * i) / steps, from.y + ((e.clientY - from.y) * i) / steps);
    last = { x: e.clientX, y: e.clientY };
  };

  const onOver = (e: PointerEvent) => {
    const t = e.target as Element;
    if (!t.closest) return;
    const field = t.closest('input, textarea, select');
    const hot = field ? null : (t.closest('[data-cursor], a, button, summary, [role="button"]') as HTMLElement | null);
    el.classList.toggle('is-field', !!field);
    el.classList.toggle('is-hover', !!hot);
    el.classList.toggle('is-drag', !!hot?.hasAttribute('data-drag'));
    const label = hot ? hot.dataset.cursor || 'Open' : NAME;
    if (tag.textContent !== label) tag.textContent = label;
    // Inked in the colours of whatever it is over (an event card, the page).
    const theme = (t.closest('[data-theme]') as HTMLElement | null)?.dataset.theme;
    if (theme) el.dataset.theme = theme;
  };
  const onDown = () => el.classList.add('is-down');
  const onUp = () => el.classList.remove('is-down');
  const onLeave = () => {
    el.classList.remove('is-visible');
    last = undefined;
  };

  const draw = (time: number, deltaMs: number) => {
    if (cells.size === 0) return;
    if (time - inkAt > 0.3) {
      inkAt = time;
      ink = getComputedStyle(el).getPropertyValue('--c-primary').trim() || ink;
    }
    const dt = deltaMs / 1000;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = ink;
    for (const [key, c] of cells) {
      c.age += dt;
      if (c.age >= LIFE) {
        cells.delete(key);
        continue;
      }
      const k = 1 - c.age / LIFE;
      const s = (GRID - 2) * k;
      ctx.globalAlpha = 0.25 + 0.6 * k;
      ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  root.addEventListener('pointerleave', onLeave);
  window.addEventListener('resize', resize);
  gsap.ticker.add(draw);

  return {
    destroy() {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', resize);
      gsap.ticker.remove(draw);
      el.remove();
      canvas.remove();
      root.classList.remove('has-cursor');
    },
  };
}
