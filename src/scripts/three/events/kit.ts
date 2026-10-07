/** Building blocks for the event scenes: flat materials in brand colours, boxes, outlines, labels. */
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
} from 'three';

/** Unlit: the exact colour from every angle. */
export const flat = (hex: string) => new MeshBasicMaterial({ color: hex });
/** Lit, flat-shaded: faces catch the light, so shapes read as solid. */
export const lit = (hex: string) => new MeshStandardMaterial({ color: hex, roughness: 1, metalness: 0, flatShading: true });
/** See-through light (beams, halos). */
export const glow = (hex: string, opacity = 0.2) => new MeshBasicMaterial({ color: hex, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });

export const box = (w: number, h: number, d: number, m: Material) => new Mesh(new BoxGeometry(w, h, d), m);
export const mesh = (g: BufferGeometry, m: Material) => new Mesh(g, m);
/** The outline of a shape, as lines. */
export const wire = (g: BufferGeometry, hex: string) => new LineSegments(new EdgesGeometry(g), new LineBasicMaterial({ color: hex }));

/** A line of text on a transparent plane (pixel font), `height` world units tall. */
export async function label(text: string, hex: string, height = 0.5) {
  const font = '48px "Press Start 2P"';
  await document.fonts.load(font).catch(() => {});
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + 16;
  canvas.height = 64;
  ctx.font = font;
  ctx.fillStyle = hex;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 8, 34);
  const tex = new CanvasTexture(canvas);
  const m = new Mesh(new PlaneGeometry((height * canvas.width) / canvas.height, height), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  return m;
}

/** Deterministic random (same layout every visit). */
export function rng(seed = 7) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
