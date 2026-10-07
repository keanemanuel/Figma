/**
 * Home hero: a hologram projector.
 *
 * A puck on the floor throws a cone of light; in the light stands a glass
 * display case, and in the case turns a hologram globe (rings of latitude and
 * longitude round a bright core). "What's in Product?" Scrolling opens the
 * case: the globe is drawn back into the beam and three holographic screens
 * rise out of it and fan open. The middle one reads EVENTS; the view pushes
 * into it until its light takes the whole screen, and the events section is
 * there. No particles: everything is lines, panes and light.
 *
 * Scroll map (p = progress through the pinned section, 0..1):
 *   0.00-0.06  at rest where the Figma orb sits; it powers up when the page opens
 *   0.05-0.30  the projector glides to the centre and grows; the headline leaves
 *   0.26-0.60  the case opens out and fades; the globe sinks into the beam;
 *              the beam widens and the screens rise and fan out, one by one
 *   0.70-1.00  the push into the middle screen
 *   0.76-1.00  white-out, then dark: the hand-over to the event picker
 *              (two overlay layers, CSS on --p, see home.css)
 *
 * The rig leans with the pointer; drag sideways (mouse or finger) to spin the globe.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type Material,
  type Object3D,
} from 'three';
import { clamp01, createProjection, createRenderer, defaultPrint, disposeObject, ease, frameLoop, lerp, releaseRenderer, smooth, type SceneHandle } from './post';

const FOV = 35;
const DIST = 12;
const TEAL = '#5fe3e0';
const VIOLET = '#8b7bff';
/** The rig, in its own units: puck at the bottom, case above it. */
const RIG = { bottom: -2.75, top: 2.0, caseY: 0.6, caseSize: 2.5, globeY: 0.55, puckY: -2.6 };

/** Light: adds to whatever is behind it. */
const light = (hex: string, opacity = 1) => new MeshBasicMaterial({ color: hex, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });

/** The beam: a cone of light with slow streaks, brightest at the lens. */
function makeBeam() {
  const uniforms = { uR0: { value: 0.4 }, uR1: { value: 1.8 }, uH: { value: 2 }, uPower: { value: 0 }, uTime: { value: 0 }, uColor: { value: new Color(TEAL) } };
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uR0; uniform float uR1; uniform float uH;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.xz *= mix(uR0, uR1, uv.y);
        p.y = uv.y * uH;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uPower; uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float a = vUv.x * 6.2832;
        float streak = 0.55 + 0.45 * sin(a * 9.0 + sin(a * 4.0 + uTime * 0.6) * 2.0) * sin(a * 23.0 - uTime * 0.9);
        float fall = pow(1.0 - vUv.y, 1.6) * 0.75 + 0.07;
        float top = smoothstep(1.0, 0.8, vUv.y);
        vec3 col = mix(uColor, vec3(1.0), pow(1.0 - vUv.y, 5.0));
        gl_FragColor = vec4(col, fall * streak * top * uPower * 0.55);
      }
    `,
  });
  const mesh = new Mesh(new CylinderGeometry(1, 1, 1, 64, 1, true), material);
  return { mesh, uniforms };
}

/**
 * The glass of a screen. FILL is how much light the pane itself gives off: through the projection pass (alpha
 * from brightness, plus glow and scanlines) 0.14 comes out about 50% solid on the page. SHADE is how much of the
 * beam the pane holds back, so the lettering has something darker than itself to sit on.
 */
const FILL = 0.14;
const SHADE = 0.72;

/** One holographic screen: a little interface drawn in light, on a pane that dims the beam behind it. */
async function makeScreen(kind: 'events' | 'wire' | 'chart', hex: string) {
  await document.fonts.load('40px Michroma').catch(() => {});
  const W = 640;
  const H = 440;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d')!;
  const ink = (a: number) => `rgba(255,255,255,${a})`;
  // Small lettering gets a hairline stroke as well, so it survives the scanlines.
  const label = (text: string, x: number, y: number) => {
    c.save();
    c.lineWidth = 1;
    c.strokeText(text, x, y);
    c.restore();
    c.fillText(text, x, y);
  };
  c.fillStyle = ink(FILL);
  c.fillRect(0, 0, W, H);
  c.strokeStyle = ink(0.95);
  c.lineWidth = 3;
  c.strokeRect(1.5, 1.5, W - 3, H - 3);
  // Header bar: brand, nav dots.
  c.fillStyle = ink(FILL * 0.9);
  c.fillRect(0, 0, W, 54);
  c.fillStyle = ink(1);
  c.font = '22px Michroma, sans-serif';
  c.textBaseline = 'middle';
  label('CISSA', 22, 28);
  for (let i = 0; i < 3; i++) c.fillRect(W - 40 - i * 26, 22, 14, 14);
  if (kind === 'events') {
    c.font = '74px Michroma, sans-serif';
    c.fillText('EVENTS', 22, 132);
    c.font = '22px Michroma, sans-serif';
    for (let i = 0; i < 4; i++) {
      const x = 22 + i * 152;
      c.fillStyle = ink(FILL * 0.6);
      c.fillRect(x, 200, 138, 150);
      c.strokeRect(x, 200, 138, 150);
      c.fillStyle = ink(1);
      label(`0${i + 1}`, x + 12, 226);
      c.fillRect(x + 12, 318, 80, 6);
      c.fillRect(x + 12, 332, 52, 6);
    }
    c.fillRect(22, 384, 240, 8);
    c.fillStyle = ink(0.5);
    c.fillRect(22, 404, 380, 6);
  } else if (kind === 'wire') {
    c.strokeRect(22, 78, 280, 170);
    c.beginPath();
    c.moveTo(22, 78);
    c.lineTo(302, 248);
    c.moveTo(302, 78);
    c.lineTo(22, 248);
    c.stroke();
    c.fillStyle = ink(0.9);
    c.fillRect(330, 84, 240, 16);
    c.fillStyle = ink(0.5);
    for (let i = 0; i < 5; i++) c.fillRect(330, 122 + i * 26, 288 - (i % 3) * 60, 8);
    c.strokeRect(22, 276, 180, 130);
    c.strokeRect(222, 276, 180, 130);
    c.strokeRect(422, 276, 196, 130);
    c.fillStyle = ink(0.9);
    c.beginPath();
    c.roundRect(330, 252 - 40, 130, 34, 17);
    c.fill();
  } else {
    // A chart and a list.
    c.beginPath();
    const pts = [330, 300, 250, 270, 190, 210, 120, 150];
    pts.forEach((y, i) => c.lineTo(30 + i * 82, y));
    c.stroke();
    c.fillStyle = ink(FILL * 0.7);
    c.lineTo(604, 400);
    c.lineTo(30, 400);
    c.fill();
    c.fillStyle = ink(0.95);
    pts.forEach((y, i) => c.fillRect(30 + i * 82 - 5, y - 5, 10, 10));
    c.fillRect(22, 82, 200, 14);
    c.fillStyle = ink(0.5);
    c.fillRect(22, 108, 300, 8);
    c.fillRect(22, 412, 596, 4);
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  const geometry = new PlaneGeometry(W / 180, H / 180);
  const face = new Mesh(geometry, new MeshBasicMaterial({ map, color: hex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  // Drawn after the beam and before the lettering, whatever the depth: the beam passes in front of the screens too.
  const shade = new Mesh(geometry, new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: DoubleSide }));
  shade.renderOrder = 1;
  face.renderOrder = 2;
  const group = new Group();
  group.add(shade, face);
  return { group, face: face.material, shade: shade.material };
}

export async function mountHero(host: HTMLElement, opts: { lite: boolean; maxDpr: number }): Promise<SceneHandle> {
  const stage = (host.querySelector('[data-gl-stage]') as HTMLElement) ?? host;
  const anchor = host.querySelector<HTMLElement>('[data-orb]');
  const scene = new Scene();
  const rig = new Group();
  scene.add(rig);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 200);
  camera.position.set(0, 0, DIST);

  // ---- The projector puck ----
  const puck = new Group();
  puck.position.y = RIG.puckY;
  const body = new Mesh(new CylinderGeometry(0.86, 1, 0.22, 56), new MeshBasicMaterial({ color: '#262b33' }));
  const lens = new Mesh(new CylinderGeometry(0.46, 0.46, 0.03, 48), light('#dffcfa'));
  lens.position.y = 0.12;
  const rim = new Mesh(new TorusGeometry(0.7, 0.025, 6, 64), light(TEAL));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  // A soft pool of light on the floor round it.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const gc = glowCanvas.getContext('2d')!;
  const grad = gc.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  gc.fillStyle = grad;
  gc.fillRect(0, 0, 128, 128);
  const pool = new Mesh(new PlaneGeometry(5.2, 5.2), new MeshBasicMaterial({ map: new CanvasTexture(glowCanvas), color: TEAL, transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -0.12;
  puck.add(body, lens, rim, pool);
  rig.add(puck);

  const beam = makeBeam();
  beam.mesh.position.y = RIG.puckY + 0.13;
  rig.add(beam.mesh);

  // ---- The glass case ----
  const glass = new Group();
  glass.position.y = RIG.caseY;
  const s = RIG.caseSize;
  const caseGeo = new BoxGeometry(s, s, s);
  const panes = new Mesh(caseGeo, light('#8fd6ff', 0.035));
  const edges = new LineSegments(new EdgesGeometry(caseGeo), new LineBasicMaterial({ color: '#a8e4ff', transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false }));
  // The lid sits a little proud of the walls, like a real case.
  const lidGeo = new BoxGeometry(s * 1.14, 0.06, s * 1.14);
  const lid = new Mesh(lidGeo, light('#8fd6ff', 0.07));
  const lidEdges = new LineSegments(new EdgesGeometry(lidGeo), edges.material);
  lid.position.y = lidEdges.position.y = s / 2 + 0.03;
  glass.add(panes, edges, lid, lidEdges);
  rig.add(glass);

  // ---- The hologram globe: latitude and longitude drawn as thin rings, a facetted shell and a core ----
  const globe = new Group();
  globe.position.y = RIG.globeY;
  const R = 0.92;
  const tealLine = light(TEAL, 0.95);
  const violetLine = light(VIOLET, 0.9);
  for (const deg of [-62, -42, -21, 0, 21, 42, 62]) {
    const a = (deg * Math.PI) / 180;
    const ring = new Mesh(new TorusGeometry(Math.cos(a) * R, 0.011, 4, 72), tealLine);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = Math.sin(a) * R;
    globe.add(ring);
  }
  for (let m = 0; m < 5; m++) {
    const ring = new Mesh(new TorusGeometry(R, 0.009, 4, 72), tealLine);
    ring.rotation.y = (m / 5) * Math.PI;
    globe.add(ring);
  }
  const shell = new LineSegments(new EdgesGeometry(new IcosahedronGeometry(R * 0.58, 1)), new LineBasicMaterial({ color: VIOLET, transparent: true, blending: AdditiveBlending, depthWrite: false }));
  const core = new Mesh(new SphereGeometry(R * 0.2, 20, 14), light('#ffe9a8'));
  const halo = new Mesh(new SphereGeometry(R * 0.36, 20, 14), light('#ffd34d', 0.22));
  // Two orbit rings, tilted.
  const orbitA = new Mesh(new TorusGeometry(R * 1.22, 0.008, 4, 96), violetLine);
  orbitA.rotation.set(1.2, 0.3, 0);
  const orbitB = new Mesh(new TorusGeometry(R * 1.34, 0.008, 4, 96), violetLine);
  orbitB.rotation.set(1.9, -0.4, 0);
  globe.add(shell, core, halo, orbitA, orbitB);
  rig.add(globe);

  // ---- The screens that rise out of the beam ----
  const built = await Promise.all([makeScreen('events', '#7ff0ec'), makeScreen('wire', '#8fd0ff'), makeScreen('chart', '#a79cff')]);
  // Where each one ends up: the middle one faces you, the others stand either side, turned in.
  const posed = [
    { x: 0, y: 1.25, z: 0.5, ry: 0, scale: 1 },
    { x: -3.55, y: 1.0, z: -0.5, ry: 0.62, scale: 0.78 },
    { x: 3.55, y: 1.0, z: -0.5, ry: -0.62, scale: 0.78 },
  ];
  const screens = built.map((b) => b.group);
  const faces = built.map((b) => b.face);
  const shades = built.map((b) => b.shade);
  screens.forEach((m) => rig.add(m));

  const { renderer, canvas, dpr: startDpr } = createRenderer(stage, { maxDpr: opts.maxDpr });
  let dpr = startDpr;
  const pass = createProjection(renderer, { samples: opts.lite ? 0 : 4, grain: 0.3 });
  pass.uniforms.uEmissive.value = 1;

  // ---- Layout: where the rig rests (the Figma orb's box) and how big it gets in the centre ----
  const rest = { x: 0, y: 0, scale: 1 };
  const centre = { x: 0, y: 0, scale: 1 };
  const mid = (RIG.top + RIG.bottom) / 2;
  const tall = RIG.top - RIG.bottom;
  let halfH = 1;
  let wide = true;
  let top = 0;
  let span = 1;
  const resize = () => {
    const box = stage.getBoundingClientRect();
    const { width, height } = box;
    if (!width || !height) return;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    pass.setSize(width, height, dpr);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    halfH = DIST * Math.tan((FOV * Math.PI) / 360);
    const halfW = halfH * camera.aspect;
    wide = camera.aspect > 1.05;
    const perPx = (halfH * 2) / height; // world units per CSS px
    if (anchor) {
      const a = anchor.getBoundingClientRect();
      rest.scale = (a.height * perPx * 1.02) / tall;
      rest.x = (a.left + a.width / 2 - box.left - width / 2) * perPx;
      rest.y = -(a.top + a.height / 2 - box.top - height / 2) * perPx - mid * rest.scale;
    }
    // In the centre: as tall as the screen allows, and narrow enough that the fanned screens fit.
    centre.scale = Math.min((halfH * 2 * 0.8) / tall, (halfW * 2 * 0.92) / 10.4);
    centre.y = -mid * centre.scale - halfH * 0.04;
    const r = host.getBoundingClientRect();
    top = r.top + scrollY;
    span = Math.max(1, r.height - stage.offsetHeight);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  // ---- Pointer: the rig leans toward it; drag to spin the globe ----
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let spinVel = 0;
  let yaw = 0;
  let lastX: number | undefined;
  const onMove = (e: PointerEvent) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
    if (lastX !== undefined && (e.pointerType !== 'mouse' || e.buttons & 1)) spinVel += (e.clientX - lastX) * 0.0016;
    lastX = e.clientX;
  };
  const onUp = () => (lastX = undefined);
  stage.addEventListener('pointermove', onMove, { passive: true });
  stage.addEventListener('pointerdown', onMove, { passive: true });
  stage.addEventListener('pointerup', onUp, { passive: true });
  stage.addEventListener('pointercancel', onUp, { passive: true });
  stage.addEventListener('pointerleave', onUp, { passive: true });

  const progress = () => clamp01((scrollY - top) / span);
  const print = defaultPrint();
  const css = { p: '', scrolled: false };
  const fade = (m: Material, base: number, k: number) => ((m as MeshBasicMaterial).opacity = base * k);
  let smoothP = progress();
  let speed = 0;
  let boot = 0;
  let active = false;
  const start = performance.now();

  const render = (dt = 1000 / 60) => {
    const t = (performance.now() - start) / 1000;
    const prev = smoothP;
    smoothP += (progress() - smoothP) * ease(0.11, dt);
    const p = smoothP;
    speed += (Math.abs(p - prev) * (1000 / 60 / Math.max(dt, 1)) * 90 - speed) * ease(0.12, dt);
    const slip = Math.min(speed, 1);
    pointer.sx += (pointer.x - pointer.sx) * ease(0.06, dt);
    pointer.sy += (pointer.y - pointer.sy) * ease(0.06, dt);
    if (active) boot = Math.min(1, boot + dt / 1400);

    const move = smooth(0.05, 0.3, p);
    const open = smooth(0.26, 0.6, p);
    const zoom = smooth(0.7, 1, p);
    // The lamp is never perfectly steady.
    const hum = 0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 7.3);
    const power = boot * hum;

    // The push into the middle screen: scale up about its centre.
    const push = 1 + zoom * zoom * 4.2;
    const scale = lerp(rest.scale, centre.scale, move) * push;
    const unit = lerp(rest.scale, centre.scale, move);
    const baseY = lerp(rest.y, centre.y, move);
    // Keep the middle screen in view as it grows, and bring it to the centre of the screen.
    const screenY = lerp(baseY + posed[0].y * unit, -halfH * 0.02, zoom);
    rig.scale.setScalar(scale);
    rig.position.set(lerp(rest.x, centre.x, move), screenY - posed[0].y * scale, 0);
    rig.rotation.set(lerp(0.2, 0.05, zoom) + pointer.sy * 0.06, pointer.sx * 0.28 * (1 - zoom), 0);

    // Globe: spins, breathes, and is drawn down into the beam as the case opens.
    yaw += (0.35 * dt) / 1000 + spinVel;
    spinVel *= Math.pow(0.94, dt / 16.67);
    const alive = boot * (1 - open);
    globe.visible = alive > 0.005;
    globe.rotation.set(0.3, yaw, 0.12);
    globe.scale.setScalar(alive * (1 + Math.sin(t * 1.6) * 0.02));
    globe.position.y = lerp(RIG.globeY, RIG.puckY + 0.6, open * open);
    shell.rotation.set(t * 0.4, -t * 0.6, 0);
    orbitA.rotation.z = t * 0.5;
    orbitB.rotation.z = -t * 0.35;
    halo.scale.setScalar(1 + Math.sin(t * 3) * 0.12);

    // Case: the panes swing wide and go out.
    glass.visible = open < 0.995;
    glass.scale.setScalar(1 + open * 0.7);
    fade(panes.material, 0.035, power * (1 - open));
    fade(lid.material, 0.07, power * (1 - open));
    fade(edges.material, 0.75, boot * (1 - open));

    // Beam: narrow under the case, wide under the screens.
    beam.uniforms.uTime.value = t;
    beam.uniforms.uPower.value = power * (1 + open * 0.5);
    beam.uniforms.uR1.value = lerp(1.45, wide ? 4.9 : 2.6, open);
    beam.uniforms.uH.value = lerp(RIG.caseY - s / 2 - RIG.puckY, 3.5, open);
    fade(lens.material, 1, power);
    fade(rim.material, 1, power);
    fade(pool.material, 0.4, power);

    // Screens: each rises out of the lens to its place, a beat after the last.
    screens.forEach((m, i) => {
      const k = smooth(i ? 0.22 + i * 0.1 : 0, i ? 0.8 + i * 0.1 : 0.7, open);
      const to = posed[i];
      // On tall screens the side ones tuck in behind instead of standing out wide.
      const x = wide ? to.x : to.x * 0.42;
      const spread = 1 + zoom * 1.6;
      m.visible = k > 0.005;
      m.position.set(x * k * (i ? spread : 1), lerp(RIG.puckY + 0.4, to.y + Math.sin(t * 0.9 + i * 2) * 0.05, k), lerp(0, wide ? to.z : to.z - 0.6, k));
      m.rotation.y = to.ry * k;
      m.scale.setScalar(Math.max(0.001, to.scale * k));
      const on = k * (i ? 1 - zoom : 1);
      fade(faces[i], i ? 0.8 : 1, on * hum);
      fade(shades[i], SHADE, on);
    });

    // A hologram: now and then the projection drops a few rows. It slips more when you scroll fast.
    const flicker = t % 5.3 < 0.09 ? 0.45 : 0;
    print.scan = 0.4;
    print.glow = 0.55;
    print.split = 1.2 + slip * 9;
    print.glitch = Math.max(slip * 0.6, flicker, (1 - boot) * 0.35);
    pass.apply(print, t);

    const next = p.toFixed(3);
    if (next !== css.p) host.style.setProperty('--p', (css.p = next));
    if (p > 0.2 !== css.scrolled) host.classList.toggle('is-scrolled', (css.scrolled = p > 0.2));
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

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) loop.start();
      else loop.stop();
    },
    dispose() {
      active = false;
      loop.stop();
      ro.disconnect();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerdown', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('pointerleave', onUp);
      disposeObject(scene as Object3D);
      pass.dispose();
      releaseRenderer(renderer, canvas);
    },
  };
}
