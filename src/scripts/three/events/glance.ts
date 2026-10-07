/**
 * Portfolio Impressions: the first glance.
 *
 * A recruiter's view of a pile of portfolios: everything moves, one thing lands.
 *
 * Scroll map (p):
 *   0.00-0.25  portfolios drift past in the dark under a sweeping spotlight
 *   0.25-0.66  they line up on a carousel that spins fast, then slows: the skim
 *   0.66-0.86  one card leaves the ring and comes forward; the rest fall away;
 *              focus brackets close on it and lock (a short tear at the lock)
 *   0.86-1.00  held in the brackets; the title
 * The corner label counts the seconds of attention left: 6.0 down to 0.
 */
import { BufferGeometry, Color, ConeGeometry, Float32BufferAttribute, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { box, flat, glow, lit, mesh, rng } from './kit';
import { lerp, smooth } from '../post';
import type { EventBuilder } from '../eventScene';

const W = 2.3;
const H = 1.66;

export const buildGlance: EventBuilder = ({ scene, camera, lite, portrait, slate }) => {
  const rand = rng(3);
  const n = lite ? 16 : 30;
  const R = 8.5;

  // A card = body + picture + two text lines, as four instanced layers.
  const bodies = new InstancedMesh(box(W, H, 0.05, lit('#ffffff')).geometry, lit('#ffffff'), n);
  const pictures = new InstancedMesh(box(W * 0.84, H * 0.5, 0.03, flat('#ffffff')).geometry, flat('#ffffff'), n);
  const lines = new InstancedMesh(box(W * 0.5, H * 0.07, 0.03, flat('#ffffff')).geometry, flat('#ffffff'), n * 2);
  scene.add(bodies, pictures, lines);

  const teal = new Color('#5fe3e0');
  const violet = new Color('#8b7bff');
  const cards = Array.from({ length: n }, (_, i) => ({
    drift: new Vector3((rand() - 0.5) * 22, (rand() - 0.5) * 11, -rand() * 46),
    tilt: new Quaternion().setFromAxisAngle(new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), rand() * 0.9),
    fall: 0.6 + rand() * 0.9,
    side: rand() - 0.5,
    order: rand(),
  }));
  cards.forEach((_, i) => {
    const featured = i === 0;
    bodies.setColorAt(i, new Color(featured ? '#f4f4f2' : i % 3 ? '#343a45' : '#454c59'));
    pictures.setColorAt(i, featured ? teal.clone().lerp(violet, 0.45) : teal.clone().lerp(violet, (i * 0.37) % 1).multiplyScalar(i % 3 ? 0.45 : 0.8));
    lines.setColorAt(i * 2, new Color(featured ? '#0b0c0e' : '#aab1bd'));
    lines.setColorAt(i * 2 + 1, new Color(featured ? '#c7ccd3' : '#6f7786'));
  });

  // Focus brackets: four corners, in the plane of the featured card's final pose.
  const bw = W * 1.75 * 0.56;
  const bh = H * 1.75 * 0.6;
  const arm = 0.42;
  const pts: number[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) pts.push(sx * bw, sy * bh, 0, sx * (bw - arm), sy * bh, 0, sx * bw, sy * bh, 0, sx * bw, sy * (bh - arm), 0);
  const brackets = new LineSegments(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(pts, 3)), new LineBasicMaterial({ color: '#5fe3e0' }));
  brackets.position.set(0, 0, 5.2);
  scene.add(brackets);

  // The spotlight.
  const beam = new Group();
  const cone = mesh(new ConeGeometry(5, 26, 24, 1, true), glow('#bff7f4', 0.1));
  cone.position.y = -13;
  beam.add(cone);
  beam.position.set(0, 13, -8);
  scene.add(beam);

  const d = new Object3D();
  const part = new Object3D();
  const m = new Matrix4();
  const pos = new Vector3();
  const q = new Quaternion();
  const qRing = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const front = new Quaternion();

  return {
    look: { scan: 0.4, split: 1.2, glow: 0.6 },
    update({ p, t, mx, my, print }) {
      const ring = smooth(0.25, 0.5, p);
      const pick = smooth(0.66, 0.86, p);
      const lock = smooth(0.74, 0.86, p);
      // The skim: fast, then slowing to a stop.
      const spin = (1 - smooth(0.3, 0.7, p)) ** 2 * 9 + t * 0.06;

      cards.forEach((c, i) => {
        // Drifting toward the camera, wrapping round.
        pos.copy(c.drift);
        pos.z = ((c.drift.z + t * 2.2 + 46) % 46) - 40;
        q.copy(c.tilt);
        // On the carousel.
        const g = smooth(c.order * 0.5, c.order * 0.5 + 0.5, ring);
        const ang = (i / n) * Math.PI * 2 + spin;
        d.position.set(Math.sin(ang) * R, Math.sin(ang * 2 + t) * 0.25, Math.cos(ang) * R - R - 1.5);
        qRing.setFromAxisAngle(up, ang);
        pos.lerp(d.position, g);
        q.slerp(qRing, g);
        let scale = 1;
        if (i === 0) {
          pos.lerp(d.position.set(0, 0, 5), pick);
          q.slerp(front, pick);
          scale = lerp(1, 1.75, pick);
        } else {
          // The rest fall out of the picture.
          pos.y -= pick * pick * 16 * c.fall;
          pos.x += pick * c.side * 6;
          scale = 1 - smooth(0.6, 1, pick);
        }
        d.position.copy(pos);
        d.quaternion.copy(q);
        d.scale.setScalar(Math.max(scale, 0.0001));
        d.updateMatrix();
        bodies.setMatrixAt(i, d.matrix);
        part.position.set(0, H * 0.17, 0.04);
        part.scale.set(1, 1, 1);
        part.updateMatrix();
        pictures.setMatrixAt(i, m.multiplyMatrices(d.matrix, part.matrix));
        part.position.set(-W * 0.17, -H * 0.22, 0.04);
        part.updateMatrix();
        lines.setMatrixAt(i * 2, m.multiplyMatrices(d.matrix, part.matrix));
        part.position.set(-W * 0.25, -H * 0.35, 0.04);
        part.scale.set(0.66, 1, 1);
        part.updateMatrix();
        lines.setMatrixAt(i * 2 + 1, m.multiplyMatrices(d.matrix, part.matrix));
      });
      bodies.instanceMatrix.needsUpdate = pictures.instanceMatrix.needsUpdate = lines.instanceMatrix.needsUpdate = true;

      brackets.visible = lock > 0.01;
      brackets.scale.setScalar(lerp(2.4, 1, lock));
      brackets.rotation.z = (1 - lock) * 0.5;
      // The lock: one hard tear.
      const snap = smooth(0.845, 0.86, p) * (1 - smooth(0.86, 0.93, p));
      print.glitch = snap;
      print.split += snap * 12;

      beam.rotation.set(Math.sin(t * 0.5) * 0.25, 0, Math.sin(t * 0.7) * 0.6);
      beam.visible = pick < 0.6;
      slate(`GLANCE ${(6 * (1 - smooth(0, 0.86, p))).toFixed(1).padStart(4, '0')}s`);

      // Above the carousel while it spins, then level with the card that is picked.
      const level = smooth(0.6, 0.84, p);
      camera.position.set(mx * 1.4, lerp(5.2, 0, level) - my * 0.9, portrait() ? 21 : 12);
      camera.lookAt(mx * 0.3, lerp(-1.2, 0, level), lerp(-6, 0, level));
    },
  };
};
