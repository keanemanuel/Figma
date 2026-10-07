/**
 * Shared WebGL plumbing: renderer setup, the frame loop, and the projection
 * pass every scene is shown through (render the scene offscreen -> project it:
 * pixel blocks, scanlines, a two-channel split, tearing, glow, grain).
 */
import {
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
  type Camera,
  type Object3D,
} from 'three';

export const cssVar = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim();
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Smoothstep of v between a and b. */
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/**
 * Frame-rate independent easing: the share of the remaining distance to cover
 * this frame, for a rate tuned at 60 fps.
 */
export const ease = (rate: number, dtMs: number) => 1 - Math.pow(1 - rate, Math.min(dtMs, 100) / (1000 / 60));

export function createRenderer(host: HTMLElement, { maxDpr = 2 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  return { renderer, canvas, dpr };
}

/** What a scene can change about its projection, per frame. Sizes are CSS px. */
export interface Print {
  /** Pixel block size. 1 = off. */
  pixel: number;
  /** Dark gap between pixel blocks, 0..1. */
  gap: number;
  /** Scanline strength, 0..1. */
  scan: number;
  /** Channel split. */
  split: number;
  /** Row tearing, 0..1. */
  glitch: number;
  /** Bloom-ish halo, 0..1. */
  glow: number;
  /** 1 = normal, 0 = faded out. */
  tone: number;
}
export const defaultPrint = (): Print => ({ pixel: 1, gap: 0, scan: 0.3, split: 1.2, glitch: 0, glow: 0.5, tone: 1 });

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform vec2 uResolution; // device px
  uniform float uPixel;
  uniform float uGap;
  uniform float uScan;
  uniform float uScanSize;
  uniform float uSplit;
  uniform float uGlitch;
  uniform float uGlow;
  uniform float uGrain;
  uniform float uTone;
  uniform float uTime;
  uniform float uEmissive; // 1: the scene is light on nothing (particles): alpha comes from brightness
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  vec4 scene(vec2 px) {
    return texture2D(tScene, clamp(px / uResolution, 0.0, 1.0));
  }

  void main() {
    vec2 px = vUv * uResolution;
    float tick = floor(uTime * 16.0);

    // Tearing: some bands of rows jump sideways for a tick.
    if (uGlitch > 0.001) {
      float band = floor(px.y / (uResolution.y * 0.04));
      float on = step(1.0 - uGlitch * 0.6, hash(vec2(band, tick)));
      px.x += (hash(vec2(band * 3.1, tick)) - 0.5) * uResolution.x * 0.1 * uGlitch * on;
    }

    // Pixel blocks.
    vec2 cell = px;
    float gap = 1.0;
    if (uPixel > 1.5) {
      cell = (floor(px / uPixel) + 0.5) * uPixel;
      vec2 f = fract(px / uPixel);
      gap = mix(1.0, step(0.12, f.x) * step(0.12, f.y), uGap);
    }

    // Two channels, slightly apart.
    vec4 c = scene(cell);
    vec4 cr = scene(cell + vec2(uSplit, 0.0));
    vec4 cb = scene(cell - vec2(uSplit, 0.0));
    vec3 col = vec3(cr.r, c.g, cb.b);
    float a = max(c.a, max(cr.a, cb.a));

    if (uGlow > 0.001) {
      float d = 6.0 * uResolution.y / 900.0;
      vec4 g = scene(cell + vec2(d, d)) + scene(cell + vec2(-d, d)) + scene(cell + vec2(d, -d)) + scene(cell + vec2(-d, -d));
      g += scene(cell + vec2(2.2 * d, 0.0)) + scene(cell - vec2(2.2 * d, 0.0)) + scene(cell + vec2(0.0, 2.2 * d)) + scene(cell - vec2(0.0, 2.2 * d));
      g *= 0.125;
      col += g.rgb * uGlow * 0.8;
      a = max(a, g.a * uGlow * 0.55);
    }

    // The scene renders in linear light.
    col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
    if (uEmissive > 0.5) {
      float m = max(col.r, max(col.g, col.b));
      a = clamp(m * 1.2, 0.0, 1.0);
      col /= max(m, 0.001);
    }

    // Scanlines, and one bright line rolling up the picture.
    float line = 0.5 + 0.5 * sin(gl_FragCoord.y * 6.2832 / uScanSize);
    a *= 1.0 - uScan * 0.55 * line;
    col += uScan * 0.25 * smoothstep(0.985, 1.0, fract(vUv.y - uTime * 0.11));

    a *= gap;
    a *= 1.0 - uGrain * 0.22 * hash(gl_FragCoord.xy + tick);
    a *= 1.0 - uGlitch * 0.25 * hash(vec2(tick, 7.0));
    gl_FragColor = vec4(col, a * uTone);
  }
`;

export function createProjection(renderer: WebGLRenderer, { samples = 4, grain = 0.5 } = {}) {
  const target = new WebGLRenderTarget(1, 1, { depthBuffer: true, samples });
  const uniforms = {
    tScene: { value: target.texture },
    uResolution: { value: new Vector2(1, 1) },
    uPixel: { value: 1 },
    uGap: { value: 0 },
    uScan: { value: 0.3 },
    uScanSize: { value: 4 },
    uSplit: { value: 1 },
    uGlitch: { value: 0 },
    uGlow: { value: 0.5 },
    uGrain: { value: grain },
    uTone: { value: 1 },
    uTime: { value: 0 },
    uEmissive: { value: 0 },
  };
  const quad = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, blending: NoBlending, depthTest: false }));
  const postScene = new Scene();
  postScene.add(quad);
  const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let ratio = 1;

  return {
    uniforms,
    setSize(width: number, height: number, dpr: number) {
      ratio = dpr;
      target.setSize(Math.max(1, Math.round(width * dpr)), Math.max(1, Math.round(height * dpr)));
      uniforms.uResolution.value.set(width * dpr, height * dpr);
      uniforms.uScanSize.value = 4 * dpr;
    },
    apply(p: Print, time: number) {
      uniforms.uPixel.value = p.pixel * ratio;
      uniforms.uGap.value = p.gap;
      uniforms.uScan.value = p.scan;
      uniforms.uSplit.value = p.split * ratio;
      uniforms.uGlitch.value = p.glitch;
      uniforms.uGlow.value = p.glow;
      uniforms.uTone.value = p.tone;
      uniforms.uTime.value = time;
    },
    render(scene: Object3D, camera: Camera) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(postScene, postCamera);
    },
    dispose() {
      quad.geometry.dispose();
      (quad.material as ShaderMaterial).dispose();
      target.dispose();
    },
  };
}

/**
 * requestAnimationFrame loop for the scenes: capped at 60 fps (halves the GPU
 * work on 120 Hz screens; everything is time-based so motion stays smooth),
 * and onSlow() fires when the average frame stays over ~22 ms for two windows
 * in a row so a scene can lower its resolution. The first 2 s are not
 * measured (shader compiles, first uploads).
 */
export function frameLoop(render: (dtMs: number) => void, { maxFps = 60, onSlow }: { maxFps?: number; onSlow?: () => void } = {}) {
  const interval = 1000 / maxFps;
  let raf = 0;
  let running = false;
  let last = 0;
  let prev = 0;
  let warmUntil = 0;
  let sum = 0;
  let count = 0;
  let slow = 0;
  const tick = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    // Loose threshold: frame timestamps jitter by a few ms, and a tight one drops real 60 Hz frames.
    if (now - last < interval * 0.75) return;
    last = now;
    const frame = now - prev;
    prev = now;
    if (onSlow && now > warmUntil && frame < 250) {
      sum += frame;
      if (++count >= 60) {
        slow = sum / count > 22 ? slow + 1 : 0;
        if (slow >= 2) {
          onSlow();
          slow = 0;
          warmUntil = now + 1000;
        }
        sum = count = 0;
      }
    }
    render(frame);
  };
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now() - interval;
      prev = performance.now();
      warmUntil = performance.now() + 2000;
      sum = count = slow = 0;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}

/** Frees geometries, materials and textures in a scene graph. */
export function disposeObject(root: Object3D) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => (v as { isTexture?: boolean })?.isTexture && (v as { dispose(): void }).dispose());
      m.dispose();
    });
  });
}

export function releaseRenderer(renderer: WebGLRenderer, canvas: HTMLCanvasElement) {
  renderer.dispose();
  renderer.forceContextLoss();
  canvas.remove();
}

export interface SceneHandle {
  /** Render only while on screen (and not behind the boot screen). */
  setActive(active: boolean): void;
  dispose(): void;
}
