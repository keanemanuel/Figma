/**
 * Figma Workshops: the multiplayer canvas.
 *
 * The event card from the Figma screen, taken apart into its layers and put
 * back together by three live cursors. The only light-themed scene.
 *
 * Scroll map (p):
 *   0.00-0.30  exploded view: the card's layers hang apart in space, turning;
 *              three cursors wander the canvas
 *   0.30-0.72  each cursor takes a layer and drags it home, back to front
 *   0.72-0.88  the camera comes round to face it; the selection frame snaps
 *              on; two variants of the component slide out beside it
 *   0.88-1.00  the title
 */
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry, Points, PointsMaterial, Shape, Vector3 } from 'three';
import { box, flat } from './kit';
import { lerp, smooth } from '../post';
import type { EventBuilder } from '../eventScene';

/** One event card: body, picture, title, button (front to back order is the layer order). */
function makeCard(button: string) {
  const g = new Group();
  const body = box(3.2, 3.1, 0.12, flat('#0b0c0e'));
  const picGeo = new PlaneGeometry(2.6, 1.4);
  // Teal to violet, corner to corner.
  picGeo.setAttribute('color', new Float32BufferAttribute([0.37, 0.89, 0.88, 0.45, 0.68, 0.94, 0.45, 0.68, 0.94, 0.55, 0.48, 1], 3));
  const pic = new Mesh(picGeo, new MeshBasicMaterial({ vertexColors: true }));
  pic.position.set(0, 0.55, 0.08);
  const title = box(1.9, 0.2, 0.04, flat('#f4f4f2'));
  title.position.set(-0.35, -0.5, 0.1);
  const btn = box(1.45, 0.44, 0.06, flat(button));
  btn.position.set(-0.575, -1.05, 0.12);
  g.add(body, pic, title, btn);
  return { g, layers: [body, pic, title, btn] };
}

export const buildCanvas: EventBuilder = ({ scene, camera, lite, portrait, slate }) => {
  // The dotted canvas.
  const dots: number[] = [];
  for (let x = -24; x <= 24; x++) for (let y = -14; y <= 14; y++) dots.push(x * 0.9, y * 0.9, -4);
  const grid = new Points(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(dots, 3)), new PointsMaterial({ color: '#0b0c0e', size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0.3 }));
  scene.add(grid);

  const card = makeCard('#5fe3e0');
  scene.add(card.g);
  const home = card.layers.map((l) => l.position.clone());
  // Where each layer hangs in the exploded view.
  const apart = [new Vector3(0, 0, -2.7), new Vector3(0.25, 0.75, -0.9), new Vector3(-0.6, -0.35, 1), new Vector3(-0.35, -1.2, 2.8)];

  // Variants of the component.
  const variants = [makeCard('#b3a6ff'), makeCard('#ff6b4a')];
  variants.forEach((v) => scene.add(v.g));

  // Selection frame with handles.
  const fw = 1.85;
  const fh = 1.8;
  const frame = new LineSegments(
    new BufferGeometry().setAttribute('position', new Float32BufferAttribute([-fw, -fh, 0, fw, -fh, 0, fw, -fh, 0, fw, fh, 0, fw, fh, 0, -fw, fh, 0, -fw, fh, 0, -fw, -fh, 0], 3)),
    new LineBasicMaterial({ color: '#2b8cff' }),
  );
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const h = box(0.16, 0.16, 0.02, flat('#2b8cff'));
      h.position.set(sx * fw, sy * fh, 0);
      frame.add(h);
    }
  frame.position.z = 0.2;
  scene.add(frame);

  // Three cursors, each with a name pill.
  const arrow = new Shape();
  arrow.moveTo(0, 0);
  arrow.lineTo(0.9, -0.36);
  arrow.lineTo(0.5, -0.52);
  arrow.lineTo(0.34, -0.96);
  arrow.closePath();
  const arrowGeo = new ExtrudeGeometry(arrow, { depth: 0.08, bevelEnabled: false });
  const cursors = ['#ff6b4a', '#8b7bff', '#1a8f8c'].map((hex, i) => {
    const g = new Group();
    const pill = box([0.9, 1.3, 1.6][i], 0.34, 0.06, flat(hex));
    pill.position.set(0.95, -1, 0);
    g.add(new Mesh(arrowGeo, flat(hex)), pill);
    scene.add(g);
    return g;
  });

  const wander = new Vector3();
  const target = new Vector3();

  return {
    look: { scan: 0.12, split: 0.7, glow: 0 },
    keepTone: false,
    update({ p, t, mx, my }) {
      // Layers come home back to front, each over its own stretch of the scroll.
      const homeAt = card.layers.map((_, i) => smooth(0.3 + i * 0.1, 0.42 + i * 0.1, p));
      card.layers.forEach((l, i) => {
        const k = homeAt[i];
        l.position.set(lerp(apart[i].x, home[i].x, k), lerp(apart[i].y, home[i].y, k), lerp(apart[i].z, home[i].z, k));
        l.rotation.set((1 - k) * Math.sin(t * 0.7 + i) * 0.25, (1 - k) * Math.cos(t * 0.5 + i * 2) * 0.3, 0);
      });

      // It starts off to the right, clear of the intro title, and comes to the centre.
      card.g.position.x = portrait() ? 0 : lerp(3.2, 0, smooth(0.08, 0.3, p));

      // Cursor i drags layer i+1 (the first layer, the body, settles on its own).
      cursors.forEach((c, i) => {
        const layer = card.layers[i + 1];
        const a = 0.3 + (i + 1) * 0.1;
        const hold = smooth(a - 0.1, a - 0.02, p) * (1 - smooth(a + 0.14, a + 0.24, p));
        wander.set(Math.sin(t * (0.5 + i * 0.17) + i * 2) * 5.5, Math.cos(t * (0.4 + i * 0.13) + i) * 2.8, 1.5 + Math.sin(t * 0.3 + i) * 1.5);
        target.copy(layer.position).add(card.g.position);
        target.x += 0.45;
        target.y -= 0.2;
        target.z += 0.35;
        c.position.lerpVectors(wander, target, hold);
        c.scale.setScalar(0.85);
      });

      const done = smooth(0.7, 0.8, p);
      frame.visible = done > 0.01;
      frame.scale.setScalar(lerp(1.5, 1, done));
      const out = smooth(0.74, 0.9, p);
      variants.forEach((v, i) => {
        const side = i ? 1 : -1;
        v.g.visible = out > 0.01;
        v.g.position.set(side * lerp(0, portrait() ? 0 : 4.6, out), portrait() ? side * lerp(0, 4.2, out) : 0, -0.6);
        v.g.scale.setScalar(lerp(0.3, 0.72, out));
      });
      const editing = 1 + cursors.length;
      slate(done > 0.5 ? `HUG × HUG · GAP 14` : `${editing - 1} PEOPLE EDITING · ${homeAt.filter((k) => k > 0.99).length}/4 LAYERS`);

      // From a three-quarter view round to the front.
      const front = smooth(0.25, 0.8, p);
      const ang = lerp(0.72, 0, front) + Math.sin(t * 0.25) * 0.06 * (1 - front) + mx * 0.12;
      const dist = (portrait() ? 23 : 13.5) + out * 3;
      camera.position.set(Math.sin(ang) * dist, lerp(5.5, 0, front) - my * 0.8, Math.cos(ang) * dist);
      camera.lookAt(0, 0, 0);
      grid.visible = !lite || front > 0.5;
    },
  };
};
