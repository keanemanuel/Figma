/**
 * Motion entry point. Always loaded (tiny). Handles the kill switch, the
 * footer toggle and page swaps, and only imports the engine (GSAP, Lenis,
 * Matter) when motion is on, so reduced-motion visitors never download it.
 *
 * Kill switch: <html data-motion="on|off">, set before paint by MotionHead.astro.
 */
type Engine = typeof import('./engine');

const root = document.documentElement;
const motionOn = () => root.dataset.motion === 'on';
let engine: Engine | undefined;

function setupToggle() {
  const btn = document.getElementById('motion-toggle');
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.hidden = false;
  btn.setAttribute('aria-pressed', String(motionOn()));
  btn.querySelector('[data-motion-state]')!.textContent = motionOn() ? 'On' : 'Off';
  btn.onclick = () => {
    try {
      localStorage.setItem('cissa-motion', motionOn() ? 'off' : 'on');
    } catch {}
    location.reload();
  };
}

document.addEventListener('astro:page-load', async () => {
  setupToggle();
  if (!motionOn()) return;
  engine ??= await import('./engine');
  engine.start();
});

document.addEventListener('astro:before-swap', (event: any) => {
  const next: HTMLElement = event.newDocument.documentElement;
  // The router copies <html> attributes from the new page; carry motion state over.
  next.dataset.motion = root.dataset.motion;
  if (!motionOn()) return;
  engine?.stop();
  // Shutter: the plate only exists in the incoming page (see motion.css).
  if ('startViewTransition' in document && event.viewTransition?.finished) {
    next.dataset.nav = '';
    event.viewTransition.finished.finally(() => delete document.documentElement.dataset.nav);
  }
});
