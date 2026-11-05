// Stitches the two garden areas into one world: side by side, separated by a
// hedge, with a shared brick path running along both entrance arches.
import type { Tile } from './template';
import { buildOccupancy, type Area, type Placed, type World } from './layout';

/** Rows of shared path below the areas. */
export const COMMONS_ROWS = 3;
/** Hedge columns between the two areas. */
export const HEDGE_COLS = 1;

export function composeWorld(left: World, right: World): World {
  const areaH = Math.max(left.height, right.height);
  const width = left.width + HEDGE_COLS + right.width;
  const height = areaH + COMMONS_ROWS;
  const tiles: Tile[] = new Array(width * height).fill('grass');
  const set = (x: number, y: number, t: Tile) => (tiles[y * width + x] = t);

  const placed: Placed[] = [];
  const areas: Area[] = [];

  const paste = (src: World, ox: number) => {
    // Shorter areas are padded at the top so both entrances line up.
    const oy = areaH - src.height;
    for (let y = 0; y < oy; y++) {
      set(ox, y, 'tree');
      set(ox + src.width - 1, y, 'tree');
    }
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) set(ox + x, oy + y, src.tiles[y * src.width + x]);
    }
    for (const p of src.placed) placed.push({ ...p, x: p.x + ox, y: p.y + oy });
    for (const a of src.areas) {
      areas.push({
        ...a,
        x0: a.x0 + ox,
        y0: 0,
        height: areaH,
        arch: { x0: a.arch.x0 + ox, x1: a.arch.x1 + ox, y: a.arch.y + oy },
        spawn: { x: a.spawn.x + ox, y: a.spawn.y + oy },
      });
    }
  };

  paste(left, 0);
  paste(right, left.width + HEDGE_COLS);

  // Picket fence along each area's front edge: the arch is the only way in.
  for (const a of areas) {
    for (let x = a.x0; x < a.x0 + a.width; x++) {
      const i = a.arch.y * width + x;
      if (tiles[i] === 'grass' && !placed.some((p) => p.y + p.h - 1 === a.arch.y && x >= p.x && x < p.x + p.w)) tiles[i] = 'fence';
    }
  }

  // Hedge between the areas.
  for (let y = 0; y < areaH; y++) for (let x = left.width; x < left.width + HEDGE_COLS; x++) set(x, y, 'bush');

  // Shared path: a spur under each arch, then a long avenue joining them.
  const spur = areaH;
  const avenue = areaH + 1;
  const edge = areaH + 2;
  for (const a of areas) {
    set(a.arch.x0, spur, 'path');
    set(a.arch.x1, spur, 'path');
  }
  const minX = Math.min(...areas.map((a) => a.arch.x0));
  const maxX = Math.max(...areas.map((a) => a.arch.x1));
  for (let x = minX - 2; x <= maxX + 2; x++) set(x, avenue, 'path');
  // A few bushes and trees along the outer edge, clear of the avenue.
  for (let x = 0; x < width; x++) {
    if (x === 0 || x === width - 1) set(x, edge, 'tree');
    else if (x % 7 === 3) set(x, edge, 'bush');
  }
  set(0, spur, 'tree');
  set(width - 1, spur, 'tree');

  return {
    width,
    height,
    tiles,
    placed,
    areas,
    spawn: { x: (areas[0].arch.x1 + areas[areas.length - 1].arch.x1) / 2, y: avenue + 0.5 },
    occupancy: buildOccupancy(placed, width),
  };
}
