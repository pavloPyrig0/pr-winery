// Raised 2×2 flower beds: stone curb, soil, border flowers, state-driven plants.
import { Container, Graphics } from 'pixi.js';
import type { BedState } from '../types';
import { polyPoints, toScreen } from './iso';
import { BORDER_PALETTES, C } from './palette';
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

function flower(g: Graphics, x: number, y: number, r: number, petals: number, petal: number, center: number) {
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    g.ellipse(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.5, r * 0.62, r * 0.42).fill(petal);
  }
  g.circle(x, y, r * 0.38).fill(center);
}

function stem(g: Graphics, x: number, y: number, tx: number, ty: number, bend: number, color: number) {
  g.moveTo(x, y)
    .quadraticCurveTo(x + bend, (y + ty) / 2, tx, ty)
    .stroke({ width: 1.3, color, cap: 'round' });
}

function beetle(g: Graphics, x: number, y: number) {
  g.ellipse(x, y, 2.6, 2).fill(0xc8312b);
  g.moveTo(x, y - 2).lineTo(x, y + 2).stroke({ width: 0.5, color: 0x1a1a1a });
  g.circle(x - 1, y - 0.3, 0.55).fill(0x1a1a1a);
  g.circle(x + 1, y + 0.5, 0.55).fill(0x1a1a1a);
  g.circle(x, y - 2.2, 0.9).fill(0x1a1a1a);
}

/** One plant at local (x, y) in screen px, drawn for the given state. */
function plant(g: Graphics, x: number, y: number, state: BedState, rng: Rng, accent: number) {
  const tilt = range(rng, -0.25, 0.25);
  switch (state) {
    case 'seedling': {
      g.moveTo(x, y).lineTo(x, y - 3).stroke({ width: 1, color: 0x7ab648 });
      leaf(g, x, y - 3, -Math.PI / 2 - 0.9, 4, 1.6, 0x8fcf5a);
      leaf(g, x, y - 3, -Math.PI / 2 + 0.9, 4, 1.6, 0x7ec24c);
      return;
    }
    case 'growing':
    case 'bugs':
    case 'thirsty': {
      const pale = state === 'thirsty';
      const dark = pale ? 0x7fa05a : 0x3f8a3a;
      const mid = pale ? 0x9ab86c : 0x5aac46;
      const light = pale ? 0xb5cc84 : 0x7cc65a;
      const h = pale ? range(rng, 9, 12) : range(rng, 12, 16);
      stem(g, x, y, x + tilt * 6, y - h, tilt * 4, dark);
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1;
        const ly = y - h * (0.25 + i * 0.17);
        leaf(g, x + tilt * 6 * (i / 4), ly, -Math.PI / 2 + side * range(rng, 0.8, 1.3), range(rng, 5, 7), 2.2, i % 2 ? mid : light);
      }
      leaf(g, x, y, -Math.PI / 2 - 1.3, 6, 2.4, dark);
      leaf(g, x, y, -Math.PI / 2 + 1.3, 6, 2.4, mid);
      // Closed buds with a hint of colour.
      const bx = x + tilt * 6;
      const by = y - h;
      g.ellipse(bx, by, 2.2, 3).fill(mid);
      g.ellipse(bx, by - 1.6, 1.4, 1.4).fill({ color: accent, alpha: pale ? 0.4 : 0.85 });
      if (state === 'bugs' && rng() < 0.7) beetle(g, x + range(rng, -4, 4), y - h * range(rng, 0.3, 0.7));
      return;
    }
    case 'blooming': {
      const h = range(rng, 14, 19);
      stem(g, x, y, x + tilt * 6, y - h, tilt * 4, 0x3f8a3a);
      leaf(g, x, y - 2, -Math.PI / 2 - 1.1, 7, 2.6, 0x4f9e40);
      leaf(g, x, y - 2, -Math.PI / 2 + 1.1, 7, 2.6, 0x66b64e);
      leaf(g, x + tilt * 3, y - h * 0.55, -Math.PI / 2 + (rng() < 0.5 ? 1 : -1), 6, 2.2, 0x7cc65a);
      flower(g, x + tilt * 6, y - h, range(rng, 4.2, 5.4), 5, accent, 0xffe27a);
      if (rng() < 0.5) flower(g, x - 4, y - h * 0.6, 3.2, 5, mixColor(accent, 0xffffff, 0.25), 0xffe27a);
      return;
    }
    case 'drooping': {
      const h = range(rng, 10, 13);
      const bend = (rng() < 0.5 ? -1 : 1) * range(rng, 5, 8);
      stem(g, x, y, x + bend, y - h * 0.65, bend * 0.9, 0x8f9a3a);
      leaf(g, x, y - 1, -Math.PI / 2 - 1.5, 6, 2.2, 0xc9b84a);
      leaf(g, x, y - 1, -Math.PI / 2 + 1.5, 6, 2.2, 0xb5a63e);
      leaf(g, x + bend * 0.4, y - h * 0.45, bend > 0 ? 0.3 : Math.PI - 0.3, 5, 2, 0xd6c35a);
      // Bud hanging down.
      g.ellipse(x + bend, y - h * 0.65 + 2.5, 2, 2.8).fill(0xa5a84a);
      g.ellipse(x + bend, y - h * 0.65 + 4.5, 1.3, 1.3).fill({ color: accent, alpha: 0.6 });
      return;
    }
    case 'wilting': {
      const h = range(rng, 6, 9);
      const bend = (rng() < 0.5 ? -1 : 1) * range(rng, 6, 9);
      stem(g, x, y, x + bend, y - h * 0.3, bend, 0x7a5a32);
      leaf(g, x, y, Math.PI + 0.2, 6, 1.8, 0x8a6a3a);
      leaf(g, x, y, -0.2, 6, 1.8, 0x9c7a45);
      leaf(g, x + bend * 0.5, y - h * 0.3, bend > 0 ? 0.6 : Math.PI - 0.6, 4, 1.4, 0xa88650);
      // Fallen petals on the soil.
      for (let i = 0; i < 3; i++) {
        g.ellipse(x + range(rng, -7, 7), y + range(rng, -2, 3), 1.8, 1).fill({ color: mixColor(accent, 0x8a6a3a, 0.55), alpha: 0.9 });
      }
      return;
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
  const pal = BORDER_PALETTES[paletteIndex % BORDER_PALETTES.length];
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

  // Ring of border flowers along the inner edge of the curb.
  const ring: [number, number][] = [];
  const steps = 6;
  const e = 0.86;
  for (let i = 0; i < steps; i++) {
    const t = -e + (2 * e * i) / steps;
    ring.push([t, -e], [e, t], [-t, e], [-e, -t]);
  }
  ring.sort((a, b) => a[0] + a[1] - (b[0] + b[1])); // back to front
  const dull = state === 'wilting';
  for (const [wx, wy] of ring) {
    const s = toScreen(wx, wy);
    const petal = pal.petals[Math.floor(rng() * pal.petals.length)];
    const col = dull ? mixColor(petal, 0x9c7a55, 0.6) : petal;
    leaf(g, s.x, s.y - H, -Math.PI / 2 - 1.2, 4, 1.6, dull ? 0x8f8a4a : 0x4f9e40);
    leaf(g, s.x, s.y - H, -Math.PI / 2 + 1.2, 4, 1.6, dull ? 0x9c925a : 0x5fae4a);
    flower(g, s.x + range(rng, -1, 1), s.y - H - 3 - range(rng, 0, 2), range(rng, 2.4, 3.2), 5, col, pal.center);
  }

  // 3×3 cluster of centre plants, back to front.
  const cells: [number, number][] = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) cells.push([-0.5 + i * 0.5, -0.5 + j * 0.5]);
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [cx, cy] of cells) {
    const s = toScreen(cx + range(rng, -0.08, 0.08), cy + range(rng, -0.08, 0.08));
    const accent = pal.petals[Math.floor(rng() * pal.petals.length)];
    plant(g, s.x, s.y - H, state, rng, accent);
  }

  root.addChild(g);
  return root;
}

/** Top-surface outline of a footprint, for highlight drawing. */
export function footprintOutline(w: number, h: number, lift: number): number[] {
  const hw = w / 2;
  const hh = h / 2;
  return polyPoints([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], lift);
}
