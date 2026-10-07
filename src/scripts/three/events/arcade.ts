/**
 * Product-thon: "Insert coin".
 *
 * The handheld console from the Figma screen, then the game inside it. The
 * projection is chunky pixels the whole way.
 *
 * Scroll map (p):
 *   0.00-0.20  the console swings in, its player hopping on the screen
 *   0.20-0.36  the camera dives into the screen; the pixels blow up (the cut)
 *   0.36-0.90  inside: the player runs a three-step level (LVL 1, 2, 3),
 *              jumping each step and collecting coins; the score counts up
 *   0.88-1.00  the trophy at the top; the camera pulls back for the title
 */
import { CylinderGeometry, Group, InstancedMesh, Object3D } from 'three';
import { box, flat, label, lit, mesh } from './kit';
import { lerp, smooth } from '../post';
import type { EventBuilder } from '../eventScene';

const STEPS = [7, 15, 23]; // x where each level starts
const RISE = 1.5; // height of one step
const END = 30;

/** Ground height under x. */
const ground = (x: number) => STEPS.reduce((h, s) => h + (x >= s ? RISE : 0), 0);

/** The player's height at x: on the ground, with a jump arc onto each step and a small hop between. */
function playerY(x: number) {
  let y = 0;
  let air = 0;
  for (const s of STEPS) {
    const k = Math.min(1, Math.max(0, (x - (s - 2.2)) / 2.2));
    y += RISE * k * k * (3 - 2 * k);
    air = Math.max(air, Math.sin(Math.PI * k) * 1.7);
  }
  return y + air + Math.abs(Math.sin(x * 2.4)) * 0.22 * (air > 0.05 ? 0 : 1);
}

export const buildArcade: EventBuilder = async ({ scene, camera, lite, portrait, slate }) => {
  const sky = '#8ec5ff';

  // ---- The console ----
  const con = new Group();
  con.add(box(7.6, 5.2, 0.8, lit('#1c1f24')));
  const screen = box(6.8, 3.6, 0.1, flat(sky));
  screen.position.set(0, 0.5, 0.42);
  const strip = box(6.8, 0.7, 0.12, flat('#64a84f'));
  strip.position.set(0, -0.95, 0.43);
  const title = await label('PRODUCT-THON', '#ffd34d', 0.5);
  title.position.set(0, 1.2, 0.5);
  const press = await label('PRESS START', '#0b0c0e', 0.22);
  press.position.set(0, 0.45, 0.5);
  const mini = new Group();
  mini.add(box(0.36, 0.22, 0.1, flat('#ff6b4a')), box(0.36, 0.22, 0.1, flat('#5fe3e0')));
  mini.children[0].position.y = 0.11;
  mini.children[1].position.y = -0.11;
  mini.position.set(-2.1, -0.38, 0.5);
  con.add(screen, strip, title, press, mini);
  [
    ['#ff6b4a', -3.1],
    ['#4a4f58', -2.5],
  ].forEach(([hex, x]) => {
    const b = mesh(new CylinderGeometry(0.22, 0.22, 0.2, 20), lit(hex as string));
    b.rotation.x = Math.PI / 2;
    b.position.set(x as number, -2.05, 0.45);
    con.add(b);
  });
  scene.add(con);

  // ---- The level ----
  const world = new Group();
  world.visible = false;
  scene.add(world);
  const backdrop = box(400, 200, 0.1, flat(sky));
  backdrop.position.z = -30;
  world.add(backdrop);

  const d = new Object3D();
  const cols = END + 22;
  const dirt = new InstancedMesh(box(1, 1, 4, lit('#3f7a36')).geometry, lit('#3f7a36'), cols);
  const grassA = new InstancedMesh(box(1, 0.3, 4, flat('#64a84f')).geometry, flat('#64a84f'), cols);
  const grassB = new InstancedMesh(box(1, 0.3, 4, flat('#4f8f41')).geometry, flat('#4f8f41'), cols);
  let a = 0;
  let b = 0;
  for (let i = 0; i < cols; i++) {
    const x = i - 10;
    const h = ground(x) + 6;
    d.position.set(x, ground(x) - h / 2 - 0.3, 0);
    d.scale.set(1, h, 1);
    d.updateMatrix();
    dirt.setMatrixAt(i, d.matrix);
    d.position.set(x, ground(x) - 0.15, 0);
    d.scale.set(1, 1, 1);
    d.updateMatrix();
    if (i % 2) grassA.setMatrixAt(a++, d.matrix);
    else grassB.setMatrixAt(b++, d.matrix);
  }
  grassA.count = a;
  grassB.count = b;
  world.add(dirt, grassA, grassB);

  // Level signs on each step.
  for (const [i, s] of STEPS.entries()) {
    const sign = await label(`LVL ${i + 1}`, i === 2 ? '#ffd34d' : '#0b0c0e', 0.55);
    sign.position.set(s + 2.6, ground(s) + 3.4, -1.2);
    const post = box(0.12, 3.2, 0.12, flat('#0b0c0e'));
    post.position.set(s + 2.6, ground(s) + 1.6, -1.25);
    world.add(sign, post);
  }

  // Coins along the path.
  const coinXs = lite ? [3, 10.5, 18.5, 26] : [2, 4, 9.5, 11.5, 13, 17.5, 19.5, 21, 25.5, 27];
  const coins = coinXs.map((x) => {
    const c = mesh(new CylinderGeometry(0.34, 0.34, 0.1, 14), flat('#ffd34d'));
    c.rotation.x = Math.PI / 2;
    c.position.set(x, playerY(x) + 1.5, 0);
    world.add(c);
    return c;
  });

  // Clouds, far back.
  const clouds = new Group();
  for (let i = 0; i < (lite ? 5 : 9); i++) {
    const c = box(3 + (i % 3), 0.9, 0.5, flat('#ffffff'));
    c.position.set(-8 + i * 6.5, 5 + ((i * 37) % 5), -12 - (i % 3) * 3);
    clouds.add(c);
  }
  world.add(clouds);

  // Trophy at the top.
  const trophy = new Group();
  const cup = box(1.6, 1.6, 1.6, lit('#ffd34d'));
  cup.position.y = 1.6;
  trophy.add(cup, box(0.5, 0.9, 0.5, lit('#b3471e')), box(1.2, 0.3, 1.2, lit('#b3471e')));
  trophy.children[1].position.y = 0.45;
  trophy.position.set(END + 1.5, ground(END), 0);
  world.add(trophy);

  // The player: the two-tone block from the Figma console.
  const player = new Group();
  player.add(box(0.8, 0.5, 0.8, flat('#ff6b4a')), box(0.8, 0.5, 0.8, flat('#5fe3e0')), box(0.92, 1.12, 0.7, flat('#0b0c0e')));
  player.children[0].position.y = 0.25;
  player.children[1].position.y = -0.25;
  world.add(player);

  return {
    look: { pixel: 4, gap: 0.3, scan: 0.22, split: 1, glow: 0.25 },
    update({ p, t, mx, my, print }) {
      const swing = smooth(0, 0.2, p);
      const dive = smooth(0.2, 0.36, p);
      const inside = dive >= 0.999;
      con.visible = !inside;
      world.visible = inside;
      // The cut: for a moment the picture is a handful of huge pixels.
      const snap = smooth(0.3, 0.36, p) * (1 - smooth(0.36, 0.44, p));
      print.pixel = 4 + snap * 26;
      print.gap = 0.3 * (1 - snap);

      if (!inside) {
        con.rotation.set(lerp(0.35, 0, swing) + my * 0.08, lerp(-1.1, 0, swing) + mx * 0.2 * (1 - dive), lerp(-0.12, 0, swing));
        con.position.set(lerp(portrait() ? 0 : 3.2, 0, dive), lerp(-0.4, -0.5, dive), 0);
        mini.position.y = -0.38 + Math.abs(Math.sin(t * 5)) * 0.5;
        press.visible = Math.floor(t * 2) % 2 === 0;
        camera.fov = 40;
        camera.position.set(0, 0, lerp(portrait() ? 22 : 14, 2.1, dive));
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        slate('INSERT COIN · 1UP');
        return;
      }

      const run = smooth(0.38, 0.9, p);
      const x = lerp(-1, END - 0.8, run);
      const y = playerY(x);
      player.position.set(x, y + 0.56, 0);
      player.rotation.z = -Math.sin(x * 2.4) * 0.08;
      // Squash on landing, stretch in the air.
      const air = y - ground(x);
      player.scale.set(1 - air * 0.06, 1 + air * 0.1, 1);
      let got = 0;
      coins.forEach((c, i) => {
        const taken = x > coinXs[i];
        if (taken) got++;
        c.visible = !taken;
        c.rotation.z = t * 3 + i;
      });
      clouds.position.x = x * 0.55 + Math.sin(t * 0.1) * 2;
      trophy.rotation.y = t * 0.8;
      trophy.position.y = ground(END) + Math.sin(t * 2) * 0.15;
      slate(`SCORE ${String(got * 100 + Math.floor(run * 900)).padStart(5, '0')} · LVL ${Math.max(1, STEPS.filter((s) => x >= s).length)}`);

      const out = smooth(0.88, 1, p);
      const far = portrait() ? 1.7 : 1;
      backdrop.position.x = x;
      camera.fov = 42;
      camera.position.set(x - 3.5 + mx * 0.8 + out * 4, y + 2.6 - my * 0.5 + out * 3, (12 + out * 9) * far);
      camera.lookAt(x + 2.5 - out * 1.5, y + 1.2 + out * 1.5, 0);
      camera.updateProjectionMatrix();
    },
  };
};
