/**
 * Lazy loader for the WebGL blocks. Blocks opt in with data-gl="<kind>":
 *   hero    <HomeHero />       the orb that opens into the four events (pinned)
 *   event   <EventIntro3D />   scroll-driven event intro (pinned); data-scene
 *                              picks the builder in ./events
 *
 * - only with motion on and WebGL available; otherwise the static layout stays
 * - Three.js and the scene are separate chunks, downloaded only when needed
 * - phones and tablets get "lite" scenes (fewer objects, lower resolution)
 * - blocks with data-live-layout get .is-3d straight away (pinned layout),
 *   and .is-live once the first frame has rendered
 * - built behind the boot screen on hard loads (it waits for gl:settled)
 * - rendered only while on screen; disposed (context released) on page leave
 *
 * Budget: one scene per page.
 */
import type { SceneHandle } from './post';

interface Instance {
  handle?: SceneHandle;
  visible: boolean;
  io?: IntersectionObserver;
  disposed: boolean;
}

const instances = new Map<HTMLElement, Instance>();
let loadingObserver: MutationObserver | undefined;

/** Phones/tablets: lighter scenes. */
const lite = () => !matchMedia('(min-width: 1024px) and (pointer: fine)').matches;
/** Budget phones (≤4 cores or ≤4 GB) start at 1x instead of stepping down after a laggy start. */
const maxDpr = () => {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowEnd = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4;
  return lite() ? (lowEnd ? 1 : 1.5) : 2;
};

const mounters: Record<string, (el: HTMLElement) => Promise<SceneHandle>> = {
  hero: async (el) => (await import('./heroScene')).mountHero(el, { lite: lite(), maxDpr: maxDpr() }),
  event: async (el) => {
    const [{ mountEventScene }, { eventScenes }] = await Promise.all([import('./eventScene'), import('./events')]);
    const load = eventScenes[el.dataset.scene ?? ''];
    if (!load) throw new Error(`Unknown event scene "${el.dataset.scene}"`);
    return mountEventScene(el, await load(), { lite: lite(), maxDpr: maxDpr() });
  },
};

function webglAvailable(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

const covered = () => document.documentElement.dataset.loading === 'on';
const applyActive = (inst: Instance) => inst.handle?.setActive(inst.visible && !covered());

async function mount(el: HTMLElement, inst: Instance) {
  const mountFn = mounters[el.dataset.gl ?? ''];
  if (!mountFn) return console.warn(`[gl] Unknown kind "${el.dataset.gl}"`);
  try {
    inst.handle = await mountFn(el);
  } catch (err) {
    // Never leave a broken pinned layout behind: fall back to the static version.
    console.warn('[gl] Falling back to the static layout.', err);
    el.classList.remove('is-3d');
    return;
  }
  if (inst.disposed) return inst.handle.dispose();
  el.classList.add('is-live');
  inst.io = new IntersectionObserver(([entry]) => {
    inst.visible = entry.isIntersecting;
    applyActive(inst);
  });
  inst.io.observe(el);
}

/** Tells the boot screen (Loader.astro) that every block has built (or failed). */
function settle() {
  (window as any).__glSettled = true;
  document.dispatchEvent(new Event('gl:settled'));
}

function init() {
  const blocks = [...document.querySelectorAll<HTMLElement>('[data-gl]')];
  const run = document.documentElement.dataset.motion === 'on' && webglAvailable();
  if (!blocks.length || !run) return settle();

  const builds = blocks.map((el) => {
    const inst: Instance = { visible: false, disposed: false };
    instances.set(el, inst);
    if (el.hasAttribute('data-live-layout')) el.classList.add('is-3d');
    return mount(el, inst);
  });
  Promise.allSettled(builds).then(settle);

  // The boot screen starts to open: start rendering.
  if (covered()) {
    loadingObserver = new MutationObserver(() => {
      if (covered()) return;
      loadingObserver?.disconnect();
      instances.forEach(applyActive);
    });
    loadingObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-loading'] });
  }
}

function disposeAll() {
  instances.forEach((inst) => {
    inst.disposed = true;
    inst.io?.disconnect();
    inst.handle?.dispose();
  });
  instances.clear();
  loadingObserver?.disconnect();
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', disposeAll);
