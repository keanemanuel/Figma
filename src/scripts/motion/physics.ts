/**
 * Physics pit (<JoinCta />): the tag pills are rigid bodies (Matter.js). They
 * drop in when the section scrolls into view and pile up on its floor.
 *   - grab one (mouse or finger) and throw it: it keeps the speed you gave it
 *   - on desktop the pointer itself is a body, so sweeping through the pile
 *     shoves pills out of the way
 * Touching a pill never scrolls the page (touch-action: none on the pills);
 * touching anywhere else scrolls as usual. Runs only while on screen.
 */
import Matter from 'matter-js';
import gsap from 'gsap';

type Cleanup = () => void;
const { Engine, Bodies, Body, Composite } = Matter;

export function physics(): Cleanup {
  const pit = document.querySelector<HTMLElement>('[data-physics]');
  if (!pit) return () => {};
  pit.classList.add('is-live');
  const engine = Engine.create();
  engine.gravity.y = 1.15;

  const items = [...pit.querySelectorAll<HTMLElement>('[data-pill]')].map((el) => {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const body = Bodies.rectangle(-500, -500, w, h, { chamfer: { radius: h / 2 - 1 }, restitution: 0.5, friction: 0.2, frictionAir: 0.012 });
    el.style.visibility = 'hidden';
    return { el, w, h, body };
  });

  let W = 0;
  let H = 0;
  let pitTop = 0;
  let pitLeft = 0;
  let walls: Matter.Body[] = [];
  const measure = () => {
    const r = pit.getBoundingClientRect();
    W = r.width;
    H = r.height;
    pitTop = r.top + scrollY;
    pitLeft = r.left + scrollX;
    Composite.remove(engine.world, walls);
    const t = 300;
    const fixed = { isStatic: true };
    walls = [
      Bodies.rectangle(W / 2, H + t / 2, W + t * 2, t, fixed),
      Bodies.rectangle(-t / 2, H / 2 - 1500, t, H + 3000, fixed),
      Bodies.rectangle(W + t / 2, H / 2 - 1500, t, H + 3000, fixed),
    ];
    Composite.add(engine.world, walls);
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(pit);

  const place = (it: (typeof items)[number], i: number) => {
    Body.setPosition(it.body, { x: W * (0.1 + 0.8 * Math.random()), y: -80 - i * 90 });
    Body.setAngle(it.body, (Math.random() - 0.5) * 1.4);
    Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 6, y: 0 });
    Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.2);
  };
  let dropped = false;
  const drop = () => {
    dropped = true;
    items.forEach((it, i) => {
      place(it, i);
      Composite.add(engine.world, it.body);
      it.el.style.visibility = '';
    });
  };

  // The pointer as a body (desktop).
  const hand = Bodies.circle(-999, -999, 30, { isStatic: true });
  const mouse = { x: -999, y: -999, on: false };
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) Composite.add(engine.world, hand);
  const onMouse = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.on = true;
  };
  window.addEventListener('pointermove', onMouse, { passive: true });

  // Grab and throw.
  let held: { it: (typeof items)[number]; id: number; x: number; y: number } | null = null;
  const toPit = (e: PointerEvent) => ({ x: e.clientX + scrollX - pitLeft, y: e.clientY + scrollY - pitTop });
  const offs: Cleanup[] = [];
  items.forEach((it) => {
    const down = (e: PointerEvent) => {
      e.preventDefault();
      it.el.setPointerCapture(e.pointerId);
      held = { it, id: e.pointerId, ...toPit(e) };
      it.el.classList.add('is-held');
    };
    const move = (e: PointerEvent) => {
      if (held?.id === e.pointerId) Object.assign(held, toPit(e));
    };
    const up = (e: PointerEvent) => {
      if (held?.id !== e.pointerId) return;
      it.el.classList.remove('is-held');
      held = null;
    };
    it.el.addEventListener('pointerdown', down);
    it.el.addEventListener('pointermove', move);
    it.el.addEventListener('pointerup', up);
    it.el.addEventListener('pointercancel', up);
    offs.push(() => {
      it.el.removeEventListener('pointerdown', down);
      it.el.removeEventListener('pointermove', move);
      it.el.removeEventListener('pointerup', up);
      it.el.removeEventListener('pointercancel', up);
    });
  });

  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  const tick = (_t: number, dtMs: number) => {
    if (held) {
      // A stiff spring to the finger: the body keeps this velocity when released.
      const b = held.it.body;
      Body.setVelocity(b, { x: clamp((held.x - b.position.x) * 0.35, 70), y: clamp((held.y - b.position.y) * 0.35, 70) });
      Body.setAngularVelocity(b, b.angularVelocity * 0.85);
    }
    if (mouse.on) Body.setPosition(hand, { x: mouse.x + scrollX - pitLeft, y: mouse.y + scrollY - pitTop }, held ? false : true);
    Engine.update(engine, Math.min(dtMs, 33));
    items.forEach((it, i) => {
      const { x, y } = it.body.position;
      // Thrown out of the pit: drop back in from the top.
      if (y > H + 400 || x < -400 || x > W + 400) place(it, i % 3);
      it.el.style.transform = `translate3d(${(x - it.w / 2).toFixed(1)}px, ${(y - it.h / 2).toFixed(1)}px, 0) rotate(${it.body.angle.toFixed(3)}rad)`;
    });
  };

  let running = false;
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !dropped && entry.intersectionRatio > 0.3) drop();
      const next = entry.isIntersecting && dropped;
      if (next === running) return;
      running = next;
      if (running) gsap.ticker.add(tick);
      else gsap.ticker.remove(tick);
    },
    { threshold: [0, 0.3, 0.6] },
  );
  io.observe(pit);

  return () => {
    io.disconnect();
    ro.disconnect();
    gsap.ticker.remove(tick);
    window.removeEventListener('pointermove', onMouse);
    offs.forEach((f) => f());
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    pit.classList.remove('is-live');
  };
}
