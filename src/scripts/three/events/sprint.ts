/**
 * Design Blitz: research -> ideate -> prototype, against the clock.
 *
 * One set of sticky notes plays all three phases. A ring of ticks around the
 * scene is the clock: it runs down as you scroll.
 *
 * Scroll map (p):
 *   0.00-0.28  research: a storm of sticky notes circling in the dark
 *   0.28-0.55  ideate: the notes snap onto a board, one by one, as a wireframe
 *   0.60-0.80  prototype: the gaps close, the notes take the colours of a real
 *              screen, and a phone forms around them
 *   0.80-1.00  the phone turns to face you; the title
 */
import { Color, Group, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import { box, lit, rng, wire } from './kit';
import { lerp, smooth } from '../post';
import type { EventBuilder } from '../eventScene';

// The wireframe: # = a note. Header, image, title, text, buttons, tab bar.
const PATTERN = ['##########', '..........', '##########', '##########', '##########', '##########', '..........', '#######...', '#####.....', '..........', '####..####', '..........', '#.#.#.#.#.'];
const CELL = 0.62;
const NOTE = ['#ffe37a', '#b3a6ff', '#5fe3e0', '#f4f4f2', '#ffb08a'];

export const buildSprint: EventBuilder = ({ scene, camera, lite, portrait, slate }) => {
  const rand = rng(48);
  const cells: { x: number; y: number; ui: Color }[] = [];
  const a = new Color('#8b7bff');
  const b = new Color('#5fe3e0');
  PATTERN.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch !== '#') return;
      const ui = r === 0 ? new Color('#2a2850') : r < 6 ? a.clone().lerp(b, (c / 9) * 0.7 + ((r - 2) / 3) * 0.3) : r === 7 ? new Color('#f4f4f2') : r === 8 ? new Color('#8c88b8') : r === 10 ? new Color(c < 5 ? '#b3a6ff' : '#3a376b') : new Color('#5fe3e0');
      cells.push({ x: (c - 4.5) * CELL, y: (6 - r) * CELL, ui });
    }),
  );

  const count = Math.max(cells.length, lite ? 90 : 150);
  const board = new Group();
  scene.add(board);
  const notes = new InstancedMesh(box(1, 1, 0.06, lit('#ffffff')).geometry, lit('#ffffff'), count);
  board.add(notes);

  const items = Array.from({ length: count }, (_, i) => {
    const r = 5 + rand() * 9;
    const th = rand() * Math.PI * 2;
    return {
      cell: cells[i],
      r,
      th,
      y: (rand() - 0.5) * 11,
      speed: 0.15 + rand() * 0.35,
      spin: new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
      spinSpeed: 0.4 + rand() * 1.4,
      size: 0.7 + rand() * 0.7,
      order: rand(),
      jitter: (rand() - 0.5) * 0.22,
      note: new Color(NOTE[(rand() * NOTE.length) | 0]),
    };
  });

  // The phone that forms around the board.
  const phone = new Group();
  const body = box(7.1, 9.3, 0.4, lit('#17162c'));
  body.position.set(0, -0.15, -0.26);
  const edge = wire(body.geometry, '#b3a6ff');
  edge.position.copy(body.position);
  phone.add(body, edge);
  board.add(phone);

  // The clock.
  const TICKS = 60;
  const ticks = new InstancedMesh(box(0.12, 0.5, 0.06, lit('#b3a6ff')).geometry, lit('#b3a6ff'), TICKS);
  scene.add(ticks);

  const d = new Object3D();
  const qA = new Quaternion();
  const qB = new Quaternion();
  const colour = new Color();
  const pos = new Vector3();

  return {
    look: { scan: 0.35, split: 1.4, glow: 0.55 },
    update({ p, t, mx, my }) {
      const gather = smooth(0.28, 0.56, p);
      const solid = smooth(0.6, 0.8, p);
      const face = smooth(0.78, 0.94, p);

      items.forEach((it, i) => {
        // Each note leaves the storm at its own moment.
        const g = it.cell ? smooth(it.order * 0.7, it.order * 0.7 + 0.3, gather) : 0;
        const gone = it.cell ? 0 : smooth(it.order * 0.6, it.order * 0.6 + 0.4, gather);
        const th = it.th + t * it.speed;
        pos.set(Math.cos(th) * it.r, it.y + Math.sin(t * 0.6 + it.th) * 0.6, Math.sin(th) * it.r);
        qA.setFromAxisAngle(it.spin, t * it.spinSpeed + it.th);
        let scale = it.size * (1 - gone);
        if (it.cell) {
          pos.lerp(d.position.set(it.cell.x, it.cell.y, 0), g);
          qB.setFromAxisAngle(d.up.set(0, 0, 1), it.jitter * (1 - solid));
          qA.slerp(qB, g);
          scale = lerp(it.size, lerp(CELL * 0.84, CELL * 1.02, solid), g);
          colour.copy(it.note).lerp(it.cell.ui, solid);
        } else colour.copy(it.note);
        d.position.copy(pos);
        d.quaternion.copy(qA);
        d.scale.setScalar(Math.max(scale, 0.0001));
        d.updateMatrix();
        notes.setMatrixAt(i, d.matrix);
        notes.setColorAt(i, colour);
      });
      notes.instanceMatrix.needsUpdate = true;
      if (notes.instanceColor) notes.instanceColor.needsUpdate = true;

      phone.visible = solid > 0.01;
      phone.scale.setScalar(lerp(0.7, 1, solid));
      board.rotation.set(lerp(0.3, 0, face) + my * 0.1, lerp(-0.55, 0.3, solid) * (1 - face) + mx * 0.25, 0);

      // The clock runs down with the scroll.
      const left = 1 - p;
      const on = Math.ceil(left * TICKS);
      d.quaternion.identity();
      for (let i = 0; i < TICKS; i++) {
        const ang = (i / TICKS) * Math.PI * 2 + t * 0.05;
        d.position.set(Math.sin(ang) * 8.4, Math.cos(ang) * 8.4, -3);
        d.rotation.set(0, 0, -ang);
        d.scale.setScalar(i < on ? 1 : 0.28);
        d.updateMatrix();
        ticks.setMatrixAt(i, d.matrix);
      }
      ticks.instanceMatrix.needsUpdate = true;
      const secs = Math.round(left * 48 * 3600);
      const pad = (n: number) => String(n).padStart(2, '0');
      slate(`T-${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}`);

      const far = portrait() ? 1.9 : 1;
      camera.position.set(mx * 1.6, 0.4 - my * 1.1, lerp(25, 17, smooth(0.1, 0.8, p)) * far);
      camera.lookAt(0, 0, 0);
    },
  };
};
