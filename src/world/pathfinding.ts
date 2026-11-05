// A* on the tile grid with 8-way movement and no corner cutting.
import type { BlockedFn } from './collision';

export interface TilePos {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;
const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

/** Minimal binary heap keyed by f-score. */
class Heap {
  private items: { k: number; f: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(k: number, f: number) {
    const a = this.items;
    a.push({ k, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.k;
  }
}

/**
 * Path from `start` to the nearest of `goals` (tiles), excluding the start
 * tile. Returns null if no goal is reachable; [] if already on a goal.
 */
export function findPath(
  isBlocked: BlockedFn,
  width: number,
  height: number,
  start: TilePos,
  goals: TilePos[],
): TilePos[] | null {
  const valid = goals.filter((g) => g.x >= 0 && g.y >= 0 && g.x < width && g.y < height && !isBlocked(g.x, g.y));
  if (!valid.length) return null;
  const key = (x: number, y: number) => y * width + x;
  const goalSet = new Set(valid.map((g) => key(g.x, g.y)));
  const h = (x: number, y: number) => {
    let m = Infinity;
    for (const g of valid) m = Math.min(m, octile(x, y, g.x, g.y));
    return m;
  };

  const startK = key(start.x, start.y);
  if (goalSet.has(startK)) return [];
  const g = new Map<number, number>([[startK, 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const open = new Heap();
  open.push(startK, h(start.x, start.y));

  while (open.size) {
    const cur = open.pop();
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (goalSet.has(cur)) {
      const path: TilePos[] = [];
      let k = cur;
      while (k !== startK) {
        path.push({ x: k % width, y: Math.floor(k / width) });
        k = came.get(k)!;
      }
      return path.reverse();
    }
    const cx = cur % width;
    const cy = Math.floor(cur / width);
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (isBlocked(nx, ny)) continue;
      // No squeezing diagonally between two blocked tiles or around a corner.
      if (dx !== 0 && dy !== 0 && (isBlocked(cx + dx, cy) || isBlocked(cx, cy + dy))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = g.get(cur)! + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, cur);
        open.push(nk, ng + h(nx, ny));
      }
    }
  }
  return null;
}

/** Walkable tiles surrounding a rectangular footprint (4-neighbourhood). */
export function tilesAround(x: number, y: number, w: number, h: number): TilePos[] {
  const out: TilePos[] = [];
  for (let i = x; i < x + w; i++) {
    out.push({ x: i, y: y - 1 }, { x: i, y: y + h });
  }
  for (let j = y; j < y + h; j++) {
    out.push({ x: x - 1, y: j }, { x: x + w, y: j });
  }
  return out;
}
