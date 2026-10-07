/**
 * Scroll-driven 3D intros for the event pages (components/event/EventIntro3D.astro).
 *
 * One shared engine, one scene builder per event (./events/*). The builder
 * makes a scene from primitives; the engine shows it through the projection
 * pass (post.ts), pins it for a long scroll and feeds the builder the scroll
 * progress p (0..1). Scrolling fast makes the projection slip: the channels
 * split further and rows tear.
 *
 * Rules it follows: 60 fps cap, time-based easing, renders only while visible
 * (loader.ts), positions cached (no layout reads per frame), lighter on
 * phones, steps its resolution down if frames run slow, disposed on page leave.
 */
import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, type Object3D } from 'three';
import { clamp01, createProjection, createRenderer, defaultPrint, disposeObject, ease, frameLoop, releaseRenderer, smooth, type Print, type SceneHandle } from './post';

export interface BuildContext {
  scene: Scene;
  camera: PerspectiveCamera;
  lite: boolean;
  /** Portrait viewport (phones): builders frame their shots wider. */
  portrait: () => boolean;
  /** Writes the small status label in the corner of the intro (only when it changes). */
  slate: (text: string) => void;
}

export interface FrameState {
  /** Smoothed scroll progress through the pinned section, 0..1. */
  p: number;
  /** Seconds since mount. */
  t: number;
  dt: number;
  /** Smoothed pointer, -1..1. */
  mx: number;
  my: number;
  /** The projection for this frame; reset to the scene's look before every update. */
  print: Print;
}

export interface EventBuild {
  /** Called every frame: pose the camera and objects for this progress. */
  update(state: FrameState): void;
  dispose?(): void;
  /** The scene's resting projection (merged over the defaults). */
  look?: Partial<Print>;
  /** Keep full brightness under the final title (default: dims to let it read). */
  keepTone?: boolean;
}

export type EventBuilder = (ctx: BuildContext) => EventBuild | Promise<EventBuild>;

export async function mountEventScene(host: HTMLElement, builder: EventBuilder, opts: { lite: boolean; maxDpr: number }): Promise<SceneHandle> {
  const stage = (host.querySelector('[data-gl-stage]') as HTMLElement) ?? host;
  const slateEl = host.querySelector<HTMLElement>('[data-ev-slate]');
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 300);
  scene.add(new AmbientLight(0xffffff, 1.5));
  const key = new DirectionalLight(0xffffff, 2.6);
  key.position.set(5, 8, 7);
  scene.add(key);

  let portrait = false;
  let slateText = '';
  const build = await builder({
    scene,
    camera,
    lite: opts.lite,
    portrait: () => portrait,
    slate(text) {
      if (slateEl && text !== slateText) slateEl.textContent = slateText = text;
    },
  });
  const look = { ...defaultPrint(), ...build.look };

  const { renderer, canvas, dpr: startDpr } = createRenderer(stage, { maxDpr: opts.maxDpr });
  let dpr = startDpr;
  const pass = createProjection(renderer, { samples: opts.lite ? 0 : 4 });

  // Cached geometry: section top (page coords) and pinned span.
  let top = 0;
  let span = 1;
  const measure = () => {
    const r = host.getBoundingClientRect();
    top = r.top + scrollY;
    span = Math.max(1, r.height - stage.offsetHeight);
  };
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    portrait = width / height < 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    pass.setSize(width, height, dpr);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    measure();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  ro.observe(host);
  resize();

  const progress = () => clamp01((scrollY - top) / span);
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener('pointermove', onPointer, { passive: true });

  let cssP = '';
  let scrolled = false;
  let smoothP = progress();
  let speed = 0;
  const start = performance.now();
  const state: FrameState = { p: 0, t: 0, dt: 16, mx: 0, my: 0, print: { ...look } };

  const render = (dt = 1000 / 60) => {
    const prev = smoothP;
    smoothP += (progress() - smoothP) * ease(0.1, dt);
    // Scroll speed per 60 fps frame, smoothed: drives the slip.
    speed += (Math.abs(smoothP - prev) * (1000 / 60 / Math.max(dt, 1)) * 90 - speed) * ease(0.12, dt);
    const slip = Math.min(speed, 1);
    pointer.sx += (pointer.x - pointer.sx) * ease(0.05, dt);
    pointer.sy += (pointer.y - pointer.sy) * ease(0.05, dt);
    state.p = smoothP;
    state.t = (performance.now() - start) / 1000;
    state.dt = dt;
    state.mx = pointer.sx;
    state.my = pointer.sy;
    Object.assign(state.print, look);
    build.update(state);

    const print = state.print;
    print.split += slip * 10;
    print.glitch = Math.max(print.glitch, slip * 0.7);
    if (!build.keepTone) print.tone *= 1 - 0.7 * smooth(0.86, 0.97, smoothP);
    pass.apply(print, state.t);

    const next = smoothP.toFixed(3);
    if (next !== cssP) host.style.setProperty('--p', (cssP = next));
    if (smoothP > 0.15 !== scrolled) host.classList.toggle('is-scrolled', (scrolled = smoothP > 0.15));
    pass.render(scene, camera);
  };

  const loop = frameLoop(render, {
    onSlow() {
      if (dpr <= 1) return;
      dpr = Math.max(1, dpr - 0.5);
      resize();
    },
  });
  renderer.compile(scene, camera);
  render();

  let active = false;
  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) {
        measure();
        loop.start();
      } else loop.stop();
    },
    dispose() {
      active = false;
      loop.stop();
      removeEventListener('pointermove', onPointer);
      ro.disconnect();
      build.dispose?.();
      disposeObject(scene as Object3D);
      pass.dispose();
      releaseRenderer(renderer, canvas);
    },
  };
}
