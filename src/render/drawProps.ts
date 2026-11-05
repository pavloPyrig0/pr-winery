// Decor and small interactables: trees, bushes, bench, arch, boat, basket,
// compost, weeds and floating markers. Each returns a container whose origin
// is the object's ground contact point in screen space.
import { Container, Graphics, Text } from 'pixi.js';
import type { MarkerKind } from '../types';
import { toScreen } from './iso';
import { C, type SeasonPalette } from './palette';
import { range, rngFor } from './rng';
import { mixColor } from './drawGround';
import { leaf } from './drawBed';

function shadow(g: Graphics, rx: number, ry: number, alpha = 0.18) {
  g.ellipse(0, 0, rx, ry).fill({ color: C.shadow, alpha });
}

export function drawTree(seed: string, pal: SeasonPalette): Container {
  const c = new Container();
  const g = new Graphics();
  const rng = rngFor(seed);
  const scale = range(rng, 0.9, 1.15);
  shadow(g, 26 * scale, 11 * scale);
  g.roundRect(-4, -26 * scale, 8, 27 * scale, 3).fill(pal.trunk);
  g.roundRect(-4, -26 * scale, 3, 27 * scale, 2).fill({ color: 0x000000, alpha: 0.15 });
  const cy = -46 * scale;
  const blobs: [number, number, number][] = [
    [-14, 6, 16],
    [14, 6, 16],
    [0, -8, 19],
    [-10, -4, 15],
    [11, -6, 15],
    [0, 8, 17],
  ];
  // Dark underside, mid body, light top highlights.
  for (const [x, y, r] of blobs) g.circle(x * scale, cy + y * scale + 3, r * scale).fill(pal.foliage[0]);
  for (const [x, y, r] of blobs) g.circle(x * scale, cy + y * scale, r * scale * 0.92).fill(pal.foliage[1]);
  for (let i = 0; i < 6; i++) {
    g.circle(range(rng, -14, 10) * scale, cy + range(rng, -18, 2) * scale, range(rng, 5, 9) * scale).fill({ color: pal.foliage[2], alpha: 0.9 });
  }
  if (pal.snow) {
    g.ellipse(-4 * scale, cy - 18 * scale, 14 * scale, 6 * scale).fill({ color: 0xffffff, alpha: 0.95 });
    g.ellipse(10 * scale, cy - 10 * scale, 8 * scale, 4 * scale).fill({ color: 0xffffff, alpha: 0.9 });
  } else {
    for (let i = 0; i < 5; i++) {
      const col = pal.foliageAccent[Math.floor(rng() * pal.foliageAccent.length)];
      g.circle(range(rng, -18, 18) * scale, cy + range(rng, -16, 12) * scale, 1.8).fill({ color: col, alpha: 0.9 });
    }
  }
  c.addChild(g);
  return c;
}

export function drawBush(seed: string, pal: SeasonPalette): Container {
  const c = new Container();
  const g = new Graphics();
  const rng = rngFor(seed);
  shadow(g, 20, 8);
  const blobs: [number, number, number][] = [
    [-9, -9, 10],
    [9, -9, 10],
    [0, -15, 12],
    [0, -6, 11],
  ];
  for (const [x, y, r] of blobs) g.circle(x, y + 2, r).fill(pal.foliage[0]);
  for (const [x, y, r] of blobs) g.circle(x, y, r * 0.9).fill(pal.foliage[1]);
  for (let i = 0; i < 4; i++) g.circle(range(rng, -10, 8), range(rng, -20, -8), range(rng, 3, 5)).fill(pal.foliage[2]);
  if (pal.snow) g.ellipse(0, -22, 10, 4).fill(0xffffff);
  else if (rng() < 0.6) {
    for (let i = 0; i < 5; i++) g.circle(range(rng, -12, 12), range(rng, -20, -4), 1.7).fill(0xffffff);
  }
  c.addChild(g);
  return c;
}

export function drawBench(): Container {
  const c = new Container();
  const g = new Graphics();
  shadow(g, 24, 9);
  // Bench along the world y axis; legs then slats then backrest.
  const seat = (lift: number, color: number, a: [number, number], b: [number, number], depth: number) => {
    const p0 = toScreen(a[0], a[1]);
    const p1 = toScreen(b[0], b[1]);
    const p2 = toScreen(b[0] + depth, b[1]);
    const p3 = toScreen(a[0] + depth, a[1]);
    g.poly([p0.x, p0.y - lift, p1.x, p1.y - lift, p2.x, p2.y - lift, p3.x, p3.y - lift]).fill(color);
  };
  for (const [x, y] of [[-0.2, -0.35], [-0.2, 0.35], [0.1, -0.35], [0.1, 0.35]] as const) {
    const s = toScreen(x, y);
    g.rect(s.x - 1.5, s.y - 10, 3, 10).fill(C.woodDark);
  }
  seat(10, C.woodDark, [-0.22, -0.42], [-0.22, 0.42], 0.36);
  seat(11, C.wood, [-0.2, -0.42], [-0.2, 0.42], 0.1);
  seat(11, C.woodLight, [-0.08, -0.42], [-0.08, 0.42], 0.1);
  seat(11, C.wood, [0.04, -0.42], [0.04, 0.42], 0.1);
  // Backrest.
  const b0 = toScreen(-0.25, -0.42);
  const b1 = toScreen(-0.25, 0.42);
  g.poly([b0.x, b0.y - 11, b1.x, b1.y - 11, b1.x, b1.y - 24, b0.x, b0.y - 24]).fill(C.wood);
  g.poly([b0.x, b0.y - 18, b1.x, b1.y - 18], false).stroke({ width: 1, color: C.woodDark });
  c.addChild(g);
  return c;
}

export function drawBoat(): Container {
  const c = new Container();
  const g = new Graphics();
  g.ellipse(0, 3, 26, 10).fill({ color: C.waterDeep, alpha: 0.5 });
  g.ellipse(0, 0, 25, 10).fill(C.woodDark);
  g.ellipse(0, -3, 23, 8.5).fill(C.wood);
  g.ellipse(0, -2, 18, 5.8).fill(0x6d4a2e);
  g.rect(-2, -8, 4, 11).fill(C.woodLight);
  g.moveTo(-6, -2).lineTo(-22, 8).stroke({ width: 2, color: C.woodLight, cap: 'round' });
  g.ellipse(-22, 8, 3, 1.5).fill(C.woodLight);
  c.addChild(g);
  return c;
}

/** Vine-covered wooden arch spanning two tiles, with a hanging sign. */
export function drawArch(label: string, pal: SeasonPalette): Container {
  const c = new Container();
  const g = new Graphics();
  const rng = rngFor('arch:' + label);
  // Origin is the middle of the arch at ground level. Posts sit along world x.
  const l = toScreen(-0.95, 0);
  const r = toScreen(0.95, 0);
  const H = 78;
  for (const p of [l, r]) {
    g.ellipse(p.x, p.y, 8, 3).fill({ color: C.shadow, alpha: 0.2 });
    g.rect(p.x - 4, p.y - H, 8, H).fill(C.wood);
    g.rect(p.x - 4, p.y - H, 3, H).fill(C.woodDark);
  }
  // Curved top beam.
  const top = -H - 18;
  g.moveTo(l.x, l.y - H).quadraticCurveTo(0, top - 8, r.x, r.y - H).stroke({ width: 8, color: C.woodDark, cap: 'round' });
  g.moveTo(l.x, l.y - H - 1).quadraticCurveTo(0, top - 9, r.x, r.y - H - 1).stroke({ width: 4, color: C.woodLight, cap: 'round' });
  // Vines climbing the posts and over the top.
  const vine = (x: number, y: number) => {
    leaf(g, x, y, range(rng, -Math.PI, 0), range(rng, 5, 8), 2.6, rng() < 0.5 ? pal.foliage[1] : pal.foliage[2]);
  };
  for (const p of [l, r]) {
    for (let k = 0; k < 16; k++) vine(p.x + range(rng, -6, 6), p.y - range(rng, 4, H));
  }
  for (let k = 0; k < 22; k++) {
    const t = k / 21;
    const x = l.x + (r.x - l.x) * t;
    const y = (1 - t) * (1 - t) * (l.y - H) + 2 * (1 - t) * t * (top - 8) + t * t * (r.y - H);
    vine(x + range(rng, -3, 3), y + range(rng, -4, 4));
    if (!pal.snow && rng() < 0.35) g.circle(x + range(rng, -4, 4), y + range(rng, -4, 4), 2.4).fill(0xf49ac1);
  }
  // Hanging sign.
  const signY = -H + 8;
  g.moveTo(-26, signY - 18).lineTo(-26, signY).stroke({ width: 1.2, color: 0x3d2a1a });
  g.moveTo(26, signY - 18).lineTo(26, signY).stroke({ width: 1.2, color: 0x3d2a1a });
  g.roundRect(-46, signY, 92, 20, 4).fill(C.woodLight);
  g.roundRect(-46, signY, 92, 20, 4).stroke({ width: 2, color: C.woodDark });
  c.addChild(g);
  const t = new Text({
    text: label,
    style: { fontFamily: 'Roboto, sans-serif', fontSize: 9.5, fontWeight: '700', fill: 0x3d2a1a },
    resolution: 3,
  });
  t.anchor.set(0.5);
  t.position.set(0, signY + 10);
  c.addChild(t);
  return c;
}

export function drawBasket(count: number): Container {
  const c = new Container();
  const g = new Graphics();
  shadow(g, 20, 8);
  g.ellipse(0, -14, 17, 7).fill(0x8a5a2b);
  // Produce peeking out.
  const fruit = [0xe0524f, 0xf2a93b, 0x7cc65a, 0xe0524f, 0xf7d046, 0xa77bd6];
  const n = Math.min(fruit.length, Math.max(1, count));
  for (let i = 0; i < n; i++) g.circle(-10 + i * 4, -16 - (i % 2) * 3, 4.5).fill(fruit[i]);
  g.poly([-17, -14, 17, -14, 13, 0, -13, 0]).fill(0xb07a3f);
  for (let i = 0; i < 4; i++) g.moveTo(-16 + i, -10 + i * 3).lineTo(16 - i, -10 + i * 3).stroke({ width: 1, color: 0x8a5a2b });
  for (let i = -3; i <= 3; i++) g.moveTo(i * 4.5, -14).lineTo(i * 3.8, 0).stroke({ width: 0.8, color: 0x8a5a2b, alpha: 0.7 });
  g.moveTo(-14, -15).quadraticCurveTo(0, -38, 14, -15).stroke({ width: 2.5, color: 0x8a5a2b });
  c.addChild(g);
  return c;
}

export function drawCompost(): Container {
  const c = new Container();
  const g = new Graphics();
  shadow(g, 24, 9);
  g.ellipse(0, -8, 20, 12).fill(0x4a3424);
  g.ellipse(-3, -12, 13, 8).fill(0x5b4130);
  const rng = rngFor('compost');
  for (let i = 0; i < 14; i++) {
    const col = [0x7a5a32, 0x9c7a45, 0x6f8a3a, 0xc9b84a][Math.floor(rng() * 4)];
    leaf(g, range(rng, -14, 14), range(rng, -16, -4), range(rng, 0, Math.PI * 2), 4, 1.6, col);
  }
  // Little wooden frame.
  for (const x of [-21, 21]) g.rect(x - 2, -16, 4, 16).fill(C.woodDark);
  g.rect(-22, -8, 44, 3).fill(C.wood);
  c.addChild(g);
  return c;
}

export function drawWeed(seed: string): Container {
  const c = new Container();
  const g = new Graphics();
  const rng = rngFor(seed);
  shadow(g, 10, 4, 0.12);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + range(rng, -1.2, 1.2);
    leaf(g, range(rng, -3, 3), 0, a, range(rng, 7, 12), 1.6, rng() < 0.5 ? 0x5a7a2a : 0x6b8a34);
  }
  // Ragged dandelion.
  g.moveTo(0, 0).lineTo(2, -15).stroke({ width: 1, color: 0x5a7a2a });
  g.circle(2, -16, 3).fill(0xf2c14e);
  c.addChild(g);
  return c;
}

/** Floating marker shown above beds that need attention. */
export function drawMarker(kind: Exclude<MarkerKind, null>): Container {
  const c = new Container();
  const g = new Graphics();
  const ring = (fill: number) => {
    g.moveTo(-5, 9).lineTo(0, 16).lineTo(5, 9).fill(fill);
    g.circle(0, 0, 12).fill(fill);
    g.circle(0, 0, 12).stroke({ width: 2, color: 0xffffff });
  };
  if (kind === 'alert-amber' || kind === 'alert-red') {
    ring(kind === 'alert-red' ? 0xbb4e4e : 0xe0a526);
    g.roundRect(-1.8, -7, 3.6, 9, 1.5).fill(0xffffff);
    g.circle(0, 5.5, 2).fill(0xffffff);
  } else if (kind === 'drop') {
    ring(0x4ba3b2);
    g.moveTo(0, -8).quadraticCurveTo(6, -1, 4.5, 3).quadraticCurveTo(0, 9, -4.5, 3).quadraticCurveTo(-6, -1, 0, -8).fill(0xffffff);
    g.ellipse(-1.6, 1.5, 1, 1.8).fill(0x4ba3b2);
  } else {
    ring(0xbb4e4e);
    g.ellipse(0, 1, 5.5, 6).fill(0xffffff);
    g.moveTo(0, -5).lineTo(0, 7).stroke({ width: 1, color: 0xbb4e4e });
    g.circle(-2.4, -0.5, 1.1).fill(0xbb4e4e);
    g.circle(2.4, 2.5, 1.1).fill(0xbb4e4e);
    g.circle(0, -6.5, 2.4).fill(0xffffff);
  }
  c.addChild(g);
  return c;
}

export { mixColor };
