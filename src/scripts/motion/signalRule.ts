/**
 * Signal rules (<SignalRule />): section dividers drawn as a live signal.
 * Each is a row of points on springs, coupled to their neighbours:
 *   - idle: a small carrier wave travelling along the line
 *   - pointer or finger near it: the line bends toward it
 *   - fast scrolling: noise, like interference
 * A second line in the accent colour lags behind the first (the same two
 * channel split used everywhere else). Only visible rules are simulated.
 */
import type Lenis from 'lenis';
import gsap from 'gsap';

type Cleanup = () => void;

const N = 44;
const MID = 24; // resting line, viewBox units (= px: the svg is 48px tall)
const REACH = 90; // px above/below where the pointer is felt
const PULL = 20; // px
const WIDTH = 0.1; // bend width, share of the rule's width

interface Rule {
  el: HTMLElement;
  main: SVGPathElement;
  ghost: SVGPathElement;
  y: Float32Array;
  v: Float32Array;
  lag: Float32Array;
  visible: boolean;
  phase: number;
  top: number;
  left: number;
  width: number;
}

function pathFor(y: Float32Array) {
  let d = `M0 ${(MID + y[0]).toFixed(1)}`;
  for (let i = 1; i < N; i++) d += ` L${((i / (N - 1)) * 1000).toFixed(0)} ${(MID + y[i]).toFixed(1)}`;
  return d;
}

export function signalRules(lenis: Lenis | undefined): Cleanup {
  const els = [...document.querySelectorAll<HTMLElement>('[data-signal]')];
  if (!els.length) return () => {};
  const rules: Rule[] = els.map((el, i) => ({
    el,
    main: el.querySelector<SVGPathElement>('.signal__main')!,
    ghost: el.querySelector<SVGPathElement>('.signal__ghost')!,
    y: new Float32Array(N),
    v: new Float32Array(N),
    lag: new Float32Array(N),
    visible: false,
    phase: i * 2.1,
    top: 0,
    left: 0,
    width: 1,
  }));

  const io = new IntersectionObserver((entries) =>
    entries.forEach((e) => {
      const r = rules.find((x) => x.el === e.target);
      if (r) r.visible = e.isIntersecting;
    }),
  );
  rules.forEach((r) => io.observe(r.el));

  // Rules sit in normal flow, so their page position only changes with layout.
  const measure = () => {
    for (const r of rules) {
      const b = r.el.getBoundingClientRect();
      r.top = b.top + scrollY + b.height / 2;
      r.left = b.left + scrollX;
      r.width = b.width || 1;
    }
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(document.body);

  const pointer = { x: -1e4, y: -1e4 };
  const onMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  const onEnd = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') pointer.x = pointer.y = -1e4;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  window.addEventListener('pointerup', onEnd, { passive: true });

  const tick = (time: number, dtMs: number) => {
    const dt = Math.min(dtMs / 16.67, 2);
    const noise = Math.min(Math.abs(lenis?.velocity ?? 0) * 0.35, 14);
    for (const r of rules) {
      if (!r.visible) continue;
      const dy = pointer.y - (r.top - scrollY);
      const px = (pointer.x - (r.left - scrollX)) / r.width;
      const near = Math.abs(dy) < REACH && px > -0.05 && px < 1.05;
      const pull = near ? Math.max(-PULL, Math.min(PULL, dy)) * Math.sqrt(1 - Math.abs(dy) / REACH) : 0;
      const { y, v, lag } = r;
      for (let i = 1; i < N - 1; i++) {
        const u = i / (N - 1);
        const ends = Math.sin(Math.PI * u);
        const idle = Math.sin(u * 40 + time * 3 + r.phase) * 1.6 * Math.sin(u * 5 - time * 0.8);
        const bend = near ? pull * Math.exp(-(((u - px) / WIDTH) ** 2)) : 0;
        const target = (idle + bend + (Math.random() - 0.5) * noise) * ends;
        v[i] += ((target - y[i]) * 0.09 + (y[i - 1] + y[i + 1] - 2 * y[i]) * 0.22) * dt;
        v[i] *= 0.86 ** dt;
      }
      for (let i = 1; i < N - 1; i++) {
        y[i] += v[i] * dt;
        lag[i] += (y[i] - lag[i]) * Math.min(1, 0.14 * dt);
      }
      r.main.setAttribute('d', pathFor(y));
      r.ghost.setAttribute('d', pathFor(lag));
    }
  };
  gsap.ticker.add(tick);

  return () => {
    gsap.ticker.remove(tick);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onMove);
    window.removeEventListener('pointerup', onEnd);
  };
}
