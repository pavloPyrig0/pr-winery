// Static ground: grass, brick paths, pond, dock and the map's earth skirt.
import { Container, Graphics } from 'pixi.js';
import type { World } from '../world/layout';
import { tileAt } from '../world/layout';
import type { Tile } from '../world/template';
import { polyPoints, toScreen } from './iso';
import { C, type SeasonPalette } from './palette';
import { mulberry32, range, type Rng } from './rng';

const isPathLike = (t: Tile | null) => t === 'path' || t === 'arch';
const isWaterLike = (t: Tile | null) => t === 'water' || t === 'boat' || t === 'dock';

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}
export { mix as mixColor };

function quad(g: Graphics, pts: [number, number][], color: number, alpha = 1) {
  g.poly(polyPoints(pts)).fill({ color, alpha });
}

function drawGrassTile(g: Graphics, x: number, y: number, pal: SeasonPalette, rng: Rng) {
  const base = mix(pal.grass[0], rng() < 0.5 ? pal.grass[1] : pal.grass[2], rng());
  quad(g, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], base);
  // Subtle mottling.
  for (let i = 0; i < 3; i++) {
    const cx = x + range(rng, 0.15, 0.85);
    const cy = y + range(rng, 0.15, 0.85);
    const s = toScreen(cx, cy);
    g.ellipse(s.x, s.y, range(rng, 6, 12), range(rng, 3, 5)).fill({ color: pal.grass[rng() < 0.5 ? 1 : 2], alpha: 0.55 });
  }
  // Tiny wildflowers.
  if (rng() < 0.45) {
    const n = 1 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const s = toScreen(x + range(rng, 0.15, 0.85), y + range(rng, 0.15, 0.85));
      const col = pal.wildflowers[Math.floor(rng() * pal.wildflowers.length)];
      g.circle(s.x, s.y, 1.6).fill(col);
      g.circle(s.x + 0.4, s.y - 0.3, 0.6).fill({ color: 0xffffff, alpha: 0.7 });
    }
  }
  if (pal.snow && rng() < 0.3) {
    const s = toScreen(x + range(rng, 0.2, 0.8), y + range(rng, 0.2, 0.8));
    g.ellipse(s.x, s.y, 9, 3.5).fill({ color: 0xffffff, alpha: 0.8 });
  }
}

function drawPathTile(g: Graphics, world: World, x: number, y: number, rng: Rng) {
  quad(g, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], C.brick);
  // Brick courses run along the world x axis, staggered per row.
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const y0 = y + r / rows;
    const y1 = y + (r + 1) / rows;
    const off = (r + y * rows) % 2 === 0 ? 0 : 0.25;
    for (let k = -1; k < 3; k++) {
      const x0 = Math.max(x, x + off + k * 0.5);
      const x1 = Math.min(x + 1, x + off + (k + 1) * 0.5);
      if (x1 - x0 < 0.05) continue;
      const shade = rng() < 0.3 ? C.brickLight : rng() < 0.2 ? 0xcf7f45 : C.brick;
      quad(g, [[x0 + 0.02, y0 + 0.02], [x1 - 0.02, y0 + 0.02], [x1 - 0.02, y1 - 0.02], [x0 + 0.02, y1 - 0.02]], shade);
    }
  }
  // Mortar lines.
  for (let r = 1; r < rows; r++) {
    g.poly(polyPoints([[x, y + r / rows], [x + 1, y + r / rows]]), false).stroke({ width: 0.8, color: C.brickJoint, alpha: 0.7 });
  }
  // Darker red-brick edging where the path meets something else.
  const e = 0.12;
  const n = (dx: number, dy: number) => isPathLike(tileAt(world, x + dx, y + dy));
  if (!n(0, -1)) quad(g, [[x, y], [x + 1, y], [x + 1, y + e], [x, y + e]], C.brickEdge);
  if (!n(0, 1)) quad(g, [[x, y + 1 - e], [x + 1, y + 1 - e], [x + 1, y + 1], [x, y + 1]], C.brickEdge);
  if (!n(-1, 0)) quad(g, [[x, y], [x + e, y], [x + e, y + 1], [x, y + 1]], C.brickEdge);
  if (!n(1, 0)) quad(g, [[x + 1 - e, y], [x + 1, y], [x + 1, y + 1], [x + 1 - e, y + 1]], C.brickEdge);
}

function drawWaterTile(g: Graphics, world: World, x: number, y: number, rng: Rng, lilies: boolean) {
  quad(g, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], C.water);
  const inner = 0.22;
  quad(g, [[x + inner, y + inner], [x + 1 - inner, y + inner], [x + 1 - inner, y + 1 - inner], [x + inner, y + 1 - inner]], C.waterDeep, 0.35);
  // Shoreline where water meets land.
  const e = 0.1;
  const land = (dx: number, dy: number) => {
    const t = tileAt(world, x + dx, y + dy);
    return t !== null && !isWaterLike(t);
  };
  if (land(0, -1)) quad(g, [[x, y], [x + 1, y], [x + 1, y + e], [x, y + e]], C.shore);
  if (land(0, 1)) quad(g, [[x, y + 1 - e], [x + 1, y + 1 - e], [x + 1, y + 1], [x, y + 1]], C.shore);
  if (land(-1, 0)) quad(g, [[x, y], [x + e, y], [x + e, y + 1], [x, y + 1]], C.shore);
  if (land(1, 0)) quad(g, [[x + 1 - e, y], [x + 1, y], [x + 1, y + 1], [x + 1 - e, y + 1]], C.shore);
  // Sparkles.
  for (let i = 0; i < 2; i++) {
    const s = toScreen(x + range(rng, 0.2, 0.8), y + range(rng, 0.2, 0.8));
    g.ellipse(s.x, s.y, range(rng, 3, 6), 1).fill({ color: C.waterLight, alpha: 0.7 });
  }
  if (lilies && rng() < 0.55) {
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const s = toScreen(x + range(rng, 0.25, 0.75), y + range(rng, 0.25, 0.75));
      const r = range(rng, 5, 7.5);
      g.ellipse(s.x, s.y + 1, r, r * 0.5).fill({ color: C.waterDeep, alpha: 0.5 });
      g.ellipse(s.x, s.y, r, r * 0.5).fill(C.lily);
      g.ellipse(s.x - 1, s.y - 0.5, r * 0.6, r * 0.28).fill({ color: C.lilyLight, alpha: 0.8 });
      // notch
      g.poly([s.x, s.y, s.x + r, s.y - 1.5, s.x + r, s.y + 1.5]).fill(C.water);
      if (rng() < 0.35) {
        g.circle(s.x - 2, s.y - 2, 2.2).fill(0xf7c6dc);
        g.circle(s.x - 2, s.y - 2.4, 1).fill(0xfff2a8);
      }
    }
  }
}

function drawDockTile(g: Graphics, x: number, y: number) {
  const planks = 4;
  for (let i = 0; i < planks; i++) {
    const y0 = y + 0.08 + (i * 0.84) / planks;
    const y1 = y0 + 0.84 / planks - 0.03;
    quad(g, [[x, y0], [x + 1, y0], [x + 1, y1], [x, y1]], i % 2 ? C.wood : C.woodLight);
  }
  // Side face to make the dock read as raised above water.
  const a = toScreen(x, y + 0.92);
  const b = toScreen(x + 1, y + 0.92);
  g.poly([a.x, a.y, b.x, b.y, b.x, b.y + 5, a.x, a.y + 5]).fill(C.woodDark);
  for (const px of [x + 0.1, x + 0.9]) {
    const s = toScreen(px, y + 0.92);
    g.rect(s.x - 1.5, s.y, 3, 9).fill(C.woodDark);
  }
}

/** Earth skirt below the visible map edges, so the garden reads as a plot. */
function drawSkirt(g: Graphics, world: World, pal: SeasonPalette) {
  const { width: w, height: h } = world;
  const depth = 22;
  const l = toScreen(0, h);
  const b = toScreen(w, h);
  const r = toScreen(w, 0);
  g.poly([l.x, l.y, b.x, b.y, b.x, b.y + depth, l.x, l.y + depth]).fill(mix(pal.skirt, 0x000000, 0.1));
  g.poly([b.x, b.y, r.x, r.y, r.x, r.y + depth, b.x, b.y + depth]).fill(pal.skirt);
  // Grass lip.
  g.poly([l.x, l.y, b.x, b.y, b.x, b.y + 4, l.x, l.y + 4]).fill(pal.grassEdge);
  g.poly([b.x, b.y, r.x, r.y, r.x, r.y + 4, b.x, b.y + 4]).fill(mix(pal.grassEdge, 0xffffff, 0.1));
}

export function drawGround(world: World, pal: SeasonPalette): Container {
  const root = new Container();
  const g = new Graphics();
  drawSkirt(g, world, pal);
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const t = tileAt(world, x, y)!;
      const rng = mulberry32(x * 7349 + y * 1913 + 17);
      if (t === 'path' || t === 'arch') drawPathTile(g, world, x, y, rng);
      else if (t === 'water' || t === 'boat') drawWaterTile(g, world, x, y, rng, t === 'water');
      else if (t === 'dock') {
        drawWaterTile(g, world, x, y, rng, false);
        drawDockTile(g, x, y);
      } else drawGrassTile(g, x, y, pal, rng);
    }
  }
  root.addChild(g);
  return root;
}
