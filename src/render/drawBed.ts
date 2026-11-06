// Raised 2×2 vine beds: stone curb, soil, two trellis rows of state-driven grapevines.
import { Container, Graphics } from 'pixi.js';
import type { BedState } from '../types';
import { polyPoints, toScreen } from './iso';
import { C } from './palette';
import { range, rngFor, type Rng } from './rng';
import { mixColor } from './drawGround';

export const CURB_H = 10;

/** Draw a leaf from (x, y) at `angle` (radians, 0 = right, -PI/2 = up). */
export function leaf(g: Graphics, x: number, y: number, angle: number, len: number, wid: number, color: number) {
  const tx = x + Math.cos(angle) * len;
  const ty = y + Math.sin(angle) * len;
  const nx = -Math.sin(angle) * wid;
  const ny = Math.cos(angle) * wid;
  const mx = (x + tx) / 2;
  const my = (y + ty) / 2;
  g.moveTo(x, y)
    .quadraticCurveTo(mx + nx, my + ny, tx, ty)
    .quadraticCurveTo(mx - nx, my - ny, x, y)
    .fill(color);
  g.moveTo(x, y).lineTo(mx + (tx - x) * 0.3, my + (ty - y) * 0.3).stroke({ width: 0.6, color: mixColor(color, 0x000000, 0.25), alpha: 0.6 });
}

function beetle(g: Graphics, x: number, y: number) {
  g.ellipse(x, y, 2.6, 2).fill(0xc8312b);
  g.moveTo(x, y - 2).lineTo(x, y + 2).stroke({ width: 0.5, color: 0x1a1a1a });
  g.circle(x - 1, y - 0.3, 0.55).fill(0x1a1a1a);
  g.circle(x + 1, y + 0.5, 0.55).fill(0x1a1a1a);
  g.circle(x, y - 2.2, 0.9).fill(0x1a1a1a);
}

/** Grape varieties; each bed rotates through them. */
const GRAPES = [
  { name: 'cabernet', ripe: [0x4a1f5c, 0x5e2a72, 0x3a1648] },
  { name: 'pinot', ripe: [0x6b1730, 0x82203d, 0x561226] },
  { name: 'riesling', ripe: [0xbfc85a, 0xd2d66e, 0xa9b448] },
  { name: 'syrah', ripe: [0x2d2a4a, 0x3b3760, 0x22203a] },
];

/** A grape leaf: three overlapping lobes. */
function vineLeaf(g: Graphics, x: number, y: number, size: number, color: number) {
  g.circle(x, y, size * 0.62).fill(color);
  g.circle(x - size * 0.5, y - size * 0.25, size * 0.45).fill(color);
  g.circle(x + size * 0.5, y - size * 0.25, size * 0.45).fill(color);
  g.moveTo(x, y + size * 0.4).lineTo(x, y - size * 0.3).stroke({ width: 0.5, color: mixColor(color, 0x000000, 0.3), alpha: 0.6 });
}

/** Hanging bunch of grapes from (x, y) downwards. */
function bunch(g: Graphics, x: number, y: number, size: number, colors: number[], rng: Rng, shrivelled = false) {
  g.moveTo(x, y - 2).lineTo(x, y + 1).stroke({ width: 0.8, color: 0x5a4a2a });
  const r = shrivelled ? size * 0.32 : size * 0.42;
  const rows = [3, 3, 2, 1];
  rows.forEach((n, j) => {
    for (let i = 0; i < n; i++) {
      const gx = x + (i - (n - 1) / 2) * size * 0.78 + range(rng, -0.3, 0.3);
      const gy = y + 2 + j * size * 0.7;
      g.circle(gx, gy, r).fill(colors[Math.floor(rng() * colors.length)]);
    }
  });
  if (!shrivelled) g.circle(x - size * 0.5, y + 2 + size * 0.2, r * 0.35).fill({ color: 0xffffff, alpha: 0.35 });
}

interface VineLook {
  leaves: number[];
  leafSize: number;
  density: number;
  grapes: number[] | null;
  bunchSize: number;
  bunches: number;
  shrivelled?: boolean;
  droop?: boolean;
}

function vineLook(state: BedState, ripe: number[]): VineLook {
  const green = [0x3f8a3a, 0x58a845, 0x4f9e40];
  const unripe = [0x9ccf6a, 0x8cc25a, 0xb2da7e];
  switch (state) {
    case 'seedling':
      return { leaves: [0x8fcf5a, 0x7ec24c], leafSize: 3, density: 0, grapes: null, bunchSize: 0, bunches: 0 };
    case 'growing':
    case 'bugs':
      return { leaves: green, leafSize: 5, density: 6, grapes: unripe, bunchSize: 2.6, bunches: 2 };
    case 'thirsty':
      return { leaves: [0x8fae62, 0x9ab86c, 0xa9c47a], leafSize: 4.2, density: 4, grapes: unripe, bunchSize: 2.2, bunches: 1 };
    case 'blooming':
      return { leaves: green, leafSize: 5.4, density: 7, grapes: ripe, bunchSize: 3.2, bunches: 3 };
    case 'drooping':
      return { leaves: [0xc9b84a, 0xb5a63e, 0x9fae4a], leafSize: 4.4, density: 4, grapes: ripe.map((c) => mixColor(c, 0x8a7a4a, 0.35)), bunchSize: 2.6, bunches: 2, droop: true };
    case 'wilting':
      return { leaves: [0x8a6a3a, 0x9c7a45, 0x7a5a32], leafSize: 3.6, density: 3, grapes: [0x3a2a24, 0x4a3226], bunchSize: 2.4, bunches: 2, shrivelled: true, droop: true };
  }
}

/** One trellis row along world x at local y = `wy`, with vines for `state`. */
function trellisRow(g: Graphics, wy: number, H: number, state: BedState, ripe: number[], rng: Rng) {
  const look = vineLook(state, ripe);
  const a = toScreen(-0.78, wy);
  const b = toScreen(0.78, wy);
  const top = 26;
  const low = 14;
  // Posts.
  for (const p of [a, b]) {
    g.rect(p.x - 1.6, p.y - H - top - 2, 3.2, top + 2).fill(C.woodDark);
    g.rect(p.x - 1.6, p.y - H - top - 2, 1.2, top + 2).fill({ color: 0x000000, alpha: 0.15 });
  }
  // Wires.
  for (const h of [low, top]) g.moveTo(a.x, a.y - H - h).lineTo(b.x, b.y - H - h).stroke({ width: 0.7, color: 0x9a9a8a, alpha: 0.9 });
  const along = (t: number, h: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - H - h });

  // Trunks.
  const trunks = [0.2, 0.5, 0.8];
  for (const t of trunks) {
    const base = along(t, 0);
    const h = state === 'seedling' ? 5 : low;
    const tip = along(t + range(rng, -0.03, 0.03), h);
    g.moveTo(base.x, base.y).quadraticCurveTo(base.x + range(rng, -2, 2), (base.y + tip.y) / 2, tip.x, tip.y).stroke({ width: 2.2, color: 0x5e3d24, cap: 'round' });
    if (state === 'seedling') {
      leaf(g, tip.x, tip.y, -Math.PI / 2 - 0.9, 4, 1.6, look.leaves[0]);
      leaf(g, tip.x, tip.y, -Math.PI / 2 + 0.9, 4, 1.6, look.leaves[1]);
    }
  }
  if (state === 'seedling') return;

  // Canes trained along the low wire, foliage climbing to the top wire.
  g.moveTo(along(0.05, low).x, along(0.05, low).y).lineTo(along(0.95, low).x, along(0.95, low).y).stroke({ width: 1.4, color: 0x6e4a2c });
  const n = look.density * 2;
  for (let i = 0; i < n; i++) {
    const t = 0.06 + (0.88 * i) / Math.max(1, n - 1) + range(rng, -0.03, 0.03);
    const h = range(rng, low, look.droop ? top - 4 : top + 4);
    const p = along(t, h);
    vineLeaf(g, p.x, p.y + (look.droop ? range(rng, 0, 3) : 0), look.leafSize * range(rng, 0.85, 1.15), look.leaves[Math.floor(rng() * look.leaves.length)]);
  }
  // Bunches hang just under the low wire, in front of the leaves.
  if (look.grapes) {
    for (let i = 0; i < look.bunches; i++) {
      const t = (i + 0.5) / look.bunches + range(rng, -0.06, 0.06);
      const p = along(t, low - 1);
      bunch(g, p.x, p.y + (look.droop ? 2 : 0), look.bunchSize, look.grapes, rng, look.shrivelled);
    }
  }
  if (state === 'bugs') {
    for (let i = 0; i < 3; i++) {
      const p = along(range(rng, 0.1, 0.9), range(rng, low, top));
      beetle(g, p.x, p.y);
    }
  }
  if (state === 'wilting') {
    for (let i = 0; i < 4; i++) {
      const p = toScreen(range(rng, -0.7, 0.7), wy + range(rng, -0.15, 0.2));
      vineLeaf(g, p.x, p.y - H, 2.4, mixColor(look.leaves[0], 0x6e5236, 0.4));
    }
  }
}

/**
 * Draws a bed whose footprint is the 2×2 tile square at (tx, ty).
 * The container is positioned at the footprint's screen centre.
 */
export function drawBed(seed: string, state: BedState, paletteIndex: number): Container {
  const root = new Container();
  const g = new Graphics();
  const rng = rngFor(seed);
  const H = CURB_H;
  // Local world coords: footprint is [-1,1]×[-1,1] around the centre.
  const P = (pts: [number, number][], lift = 0) => polyPoints(pts, lift);
  const R = toScreen(1, -1);
  const B = toScreen(1, 1);
  const L = toScreen(-1, 1);

  // Soft shadow.
  g.ellipse(0, B.y - 14, 70, 24).fill({ color: C.shadow, alpha: 0.12 });
  // Side faces (left darker, right lighter) with stone joints.
  g.poly([L.x, L.y - H, B.x, B.y - H, B.x, B.y, L.x, L.y]).fill(C.stoneLeft);
  g.poly([B.x, B.y - H, R.x, R.y - H, R.x, R.y, B.x, B.y]).fill(C.stoneRight);
  for (let i = 1; i < 4; i++) {
    const a = toScreen(-1 + (i * 2) / 4, 1);
    const b = toScreen(1, 1 - (i * 2) / 4);
    const oy = i % 2 ? 0 : H / 2;
    g.moveTo(a.x, a.y - H + oy).lineTo(a.x, a.y - H / 2 + oy).stroke({ width: 1, color: C.stoneJoint, alpha: 0.7 });
    g.moveTo(b.x, b.y - H + oy).lineTo(b.x, b.y - H / 2 + oy).stroke({ width: 1, color: C.stoneJoint, alpha: 0.7 });
  }
  g.poly([L.x, L.y - H / 2, B.x, B.y - H / 2, R.x, R.y - H / 2], false).stroke({ width: 1, color: C.stoneJoint, alpha: 0.5 });
  // Curb top.
  g.poly(P([[-1, -1], [1, -1], [1, 1], [-1, 1]], H)).fill(C.stoneTop);
  g.poly(P([[-1, -1], [1, -1], [1, 1], [-1, 1]], H)).stroke({ width: 1, color: 0xe2ddd2, alpha: 0.8 });

  // Soil.
  const k = 0.82;
  const dry = state === 'thirsty' || state === 'wilting';
  const soil = dry ? C.soilDry : C.soil;
  g.poly(P([[-k, -k], [k, -k], [k, k], [-k, k]], H)).fill(soil);
  g.poly(P([[-k, -k], [k, -k], [k, -k + 0.12], [-k + 0.12, -k + 0.12], [-k + 0.12, k], [-k, k]], H)).fill({ color: C.soilDark, alpha: 0.6 });
  // Soil clods / cracks.
  for (let i = 0; i < 14; i++) {
    const s = toScreen(range(rng, -0.7, 0.7), range(rng, -0.7, 0.7));
    g.ellipse(s.x, s.y - H, range(rng, 1, 2.2), range(rng, 0.6, 1.1)).fill({ color: dry ? 0xb39270 : C.soilDark, alpha: 0.7 });
  }
  if (dry) {
    for (let i = 0; i < 7; i++) {
      let p = toScreen(range(rng, -0.6, 0.6), range(rng, -0.6, 0.6));
      g.moveTo(p.x, p.y - H);
      for (let j = 0; j < 3; j++) {
        p = { x: p.x + range(rng, -6, 6), y: p.y + range(rng, -3, 3) };
        g.lineTo(p.x, p.y - H);
      }
      g.stroke({ width: 0.9, color: C.soilCrack, alpha: 0.9 });
    }
  }

  // Two trellis rows of grapevines, back row first.
  const ripe = GRAPES[paletteIndex % GRAPES.length].ripe;
  trellisRow(g, -0.42, H, state, ripe, rng);
  trellisRow(g, 0.42, H, state, ripe, rng);

  root.addChild(g);
  return root;
}

/** Top-surface outline of a footprint, for highlight drawing. */
export function footprintOutline(w: number, h: number, lift: number): number[] {
  const hw = w / 2;
  const hh = h / 2;
  return polyPoints([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], lift);
}
