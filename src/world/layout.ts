// Deterministic placement of garden items into a tile map.
import type { BedItem, CellarItem, GardenId, GardenItem, WeedItem } from '../types';
import { stateRank } from '../github/mapping';
import { BLOCKED_TILES, buildTemplate, cellarBlocksFor, parseTile, type Tile } from './template';

export const BASE_SLOTS = 14;
export const SLOTS_PER_BLOCK = 4;

export interface Placed {
  item: GardenItem;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Blocks movement (beds, barrels, bottles, compost). Weeds do not. */
  solid: boolean;
  /** Which garden area the object belongs to. */
  garden: GardenId;
}

export interface Slot {
  x: number;
  y: number;
}

/** A fenced garden area inside the world, entered through its arch. */
export interface Area {
  garden: GardenId;
  /** Name on the entrance sign. */
  label: string;
  x0: number;
  y0: number;
  width: number;
  height: number;
  /** The two arch tiles (x0, x1) on row y, the area's bottom edge. */
  arch: { x0: number; x1: number; y: number };
  /** Just inside the arch. */
  spawn: { x: number; y: number };
}

export const AREA_LABEL: Record<GardenId, string> = { mine: 'My PRs', review: 'To review' };

export interface World {
  width: number;
  height: number;
  tiles: Tile[];
  placed: Placed[];
  areas: Area[];
  /** Where the gardener starts. */
  spawn: { x: number; y: number };
  /** Footprint lookup: tile index → placed object. */
  occupancy: Map<number, Placed>;
}

export function tileAt(world: World, x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return null;
  return world.tiles[y * world.width + x];
}

/** Find 2×2 bed slots by scanning top-left to bottom-right. */
export function findSlots(rows: string[]): Slot[] {
  const h = rows.length;
  const w = rows[0].length;
  const used = new Set<number>();
  const slots: Slot[] = [];
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      if (used.has(y * w + x)) continue;
      if (rows[y][x] === 'B' && rows[y][x + 1] === 'B' && rows[y + 1][x] === 'B' && rows[y + 1][x + 1] === 'B') {
        slots.push({ x, y });
        used.add(y * w + x).add(y * w + x + 1).add((y + 1) * w + x).add((y + 1) * w + x + 1);
      }
    }
  }
  return slots;
}

/** Entry point: the middle of the arch at the bottom edge. */
function entryOf(rows: string[]): { x: number; y: number } {
  const y = rows.length - 1;
  const x0 = rows[y].indexOf('A');
  return { x: x0 + 1, y: y + 1 };
}

/** Slots ordered nearest-entry first (stable tiebreaks). */
export function orderSlots(slots: Slot[], entry: { x: number; y: number }): Slot[] {
  const d = (s: Slot) => Math.abs(s.x + 1 - entry.x) + Math.abs(s.y + 1 - entry.y);
  return [...slots].sort((a, b) => d(a) - d(b) || b.y - a.y || a.x - b.x);
}

/**
 * Beds grouped by repository. Repos are ordered by their most urgent bed;
 * inside a repo, most urgent first. Only discrete, stable keys are used so
 * the order doesn't drift between refreshes.
 */
export function orderBeds(beds: BedItem[]): BedItem[] {
  const byRepo = new Map<string, BedItem[]>();
  for (const b of beds) {
    const list = byRepo.get(b.pr.repo) ?? [];
    list.push(b);
    byRepo.set(b.pr.repo, list);
  }
  const cmpBed = (a: BedItem, b: BedItem) =>
    stateRank(b.state) - stateRank(a.state) ||
    Date.parse(a.pr.createdAt) - Date.parse(b.pr.createdAt) ||
    a.pr.number - b.pr.number ||
    a.id.localeCompare(b.id);
  const groups = [...byRepo.entries()].map(([repo, list]) => ({ repo, list: list.sort(cmpBed) }));
  groups.sort((a, b) => {
    const top = cmpBed(a.list[0], b.list[0]);
    return top || a.repo.localeCompare(b.repo);
  });
  return groups.flatMap((g) => g.list);
}

/** Small deterministic hash for scattering weeds. */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function extraBlocksFor(bedCount: number): number {
  return Math.max(0, Math.ceil((bedCount - BASE_SLOTS) / SLOTS_PER_BLOCK));
}

export function layoutGarden(items: GardenItem[], garden: GardenId): World {
  const beds = orderBeds(items.filter((i): i is BedItem => i.kind === 'bed'));
  // Barrels and bottles keep the order they came in (newest first).
  const cellar = items.filter((i): i is CellarItem => i.kind === 'barrel' || i.kind === 'bottle');
  const rows = buildTemplate(extraBlocksFor(beds.length), cellarBlocksFor(cellar.length));
  const height = rows.length;
  const width = rows[0].length;
  const tiles: Tile[] = [];
  for (const row of rows) for (const ch of row) tiles.push(parseTile(ch));

  const entry = entryOf(rows);
  const slots = orderSlots(findSlots(rows), entry);
  const placed: Placed[] = [];

  beds.forEach((bed, i) => {
    const s = slots[i];
    placed.push({ item: bed, x: s.x, y: s.y, w: 2, h: 2, solid: true, garden });
  });
  // Unused slots revert to grass.
  for (const s of slots.slice(beds.length)) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) tiles[(s.y + dy) * width + s.x + dx] = 'grass';
  }

  // Compost sits at its template marker near the arch.
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== 'compost') continue;
    const item = items.find((it) => it.kind === 'compost');
    if (item) placed.push({ item, x: i % width, y: Math.floor(i / width), w: 1, h: 1, solid: true, garden });
    else tiles[i] = 'grass';
  }

  // Cellar slots fill row by row from the back; unused ones become grass.
  let ci = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== 'cellar') continue;
    const item = cellar[ci++];
    if (item) placed.push({ item, x: i % width, y: Math.floor(i / width), w: 1, h: 1, solid: true, garden });
    else tiles[i] = 'grass';
  }

  // Weeds on open grass, scattered but stable.
  const weeds = items
    .filter((i): i is WeedItem => i.kind === 'weed')
    .sort((a, b) => a.id.localeCompare(b.id));
  if (weeds.length) {
    const archX = entry.x;
    const grass: number[] = [];
    for (let i = 0; i < tiles.length; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      if (tiles[i] !== 'grass') continue;
      if (y === height - 1) continue; // the front edge gets a fence
      if (y >= height - 2 && Math.abs(x + 0.5 - archX) < 3) continue; // keep the entrance clear
      grass.push(i);
    }
    grass.sort((a, b) => hash2(a % width, Math.floor(a / width)) - hash2(b % width, Math.floor(b / width)));
    weeds.forEach((w, k) => {
      const idx = grass[k];
      if (idx === undefined) return;
      placed.push({ item: w, x: idx % width, y: Math.floor(idx / width), w: 1, h: 1, solid: false, garden });
    });
  }

  const occupancy = buildOccupancy(placed, width);

  const spawn = { x: entry.x, y: height - 2.1 };
  return {
    width,
    height,
    tiles,
    placed,
    areas: [
      {
        garden,
        label: AREA_LABEL[garden],
        x0: 0,
        y0: 0,
        width,
        height,
        arch: { x0: entry.x - 1, x1: entry.x, y: height - 1 },
        spawn,
      },
    ],
    spawn,
    occupancy,
  };
}

export function isTileBlocked(world: World, x: number, y: number): boolean {
  const t = tileAt(world, x, y);
  if (t === null) return true;
  if (BLOCKED_TILES.has(t)) return true;
  const p = world.occupancy.get(y * world.width + x);
  return !!p && p.solid;
}

/** Shortest distance from a point to an object's footprint rectangle. */
export function distanceToPlaced(p: Placed, px: number, py: number): number {
  const dx = Math.max(p.x - px, 0, px - (p.x + p.w));
  const dy = Math.max(p.y - py, 0, py - (p.y + p.h));
  return Math.hypot(dx, dy);
}

/**
 * Nearest interactable within `maxDist` tiles that is roughly in front of
 * the gardener (very close objects count regardless of facing).
 */
export function nearestInteractable(
  world: World,
  px: number,
  py: number,
  facing: { x: number; y: number },
  maxDist = 1.2,
): Placed | null {
  let best: Placed | null = null;
  let bestScore = Infinity;
  for (const p of world.placed) {
    const d = distanceToPlaced(p, px, py);
    if (d > maxDist) continue;
    const cx = p.x + p.w / 2 - px;
    const cy = p.y + p.h / 2 - py;
    const len = Math.hypot(cx, cy) || 1;
    const dot = (cx * facing.x + cy * facing.y) / len;
    if (d > 0.45 && dot < -0.1) continue; // behind us
    const score = d - dot * 0.3;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function buildOccupancy(placed: Placed[], width: number): Map<number, Placed> {
  const occupancy = new Map<number, Placed>();
  for (const p of placed) {
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) occupancy.set(y * width + x, p);
  }
  return occupancy;
}

/** The area containing a world point, or null on the shared path. */
export function areaAt(world: World, x: number, y: number): Area | null {
  return world.areas.find((a) => x >= a.x0 && x < a.x0 + a.width && y >= a.y0 && y < a.y0 + a.height) ?? null;
}
