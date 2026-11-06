// Handcrafted 14×14 vineyard template plus extension and cellar blocks.
//
// Legend
//   .  grass            #  brick path        ~  water          =  wooden dock
//   o  rowboat (water)  T  tree              b  bush           n  bench
//   f  picket fence
//   B  vine bed (2×2)   A  arch (exit)       c  pomace (compost) heap
//   K  cellar slot (one barrel or bottle)
//
// Rows are y (down-left on screen), columns are x (down-right on screen).

export type Tile =
  | 'grass'
  | 'path'
  | 'water'
  | 'dock'
  | 'boat'
  | 'tree'
  | 'bush'
  | 'bench'
  | 'fence'
  | 'bed'
  | 'arch'
  | 'cellar'
  | 'compost';

export const BASE_TEMPLATE: readonly string[] = [
  '~~~~.T...TbT.T',
  '~===..##.....T',
  '~o~~BB##BB.n.b',
  '~~~.BB##BB....',
  '..##########..',
  'T.BBBB##BBBB.b',
  '..BBBB##BBBB..',
  'b.BBBB##BBBB.T',
  '..BBBB##BBBB..',
  '.############.',
  'T.BBBB##BBBB.b',
  '..BBBB##BBBB.T',
  'Tb....##c...bT',
  'TT....AA....TT',
];

/** Extra rows (1 path row + 2 bed rows) inserted when slots run out. */
export const EXTENSION_BLOCK: readonly string[] = [
  '..##########..',
  'T.BBBB##BBBB.b',
  '..BBBB##BBBB..',
];

/** Where extension blocks are inserted (just above the first cross path). */
export const EXTENSION_INSERT_ROW = 4;

/**
 * Cellar rows added at the back of an area: a row of storage slots and an
 * aisle in front of it, so every barrel or bottle can be reached.
 */
export const CELLAR_BLOCK: readonly string[] = [
  'T.KKKK..KKKK.T',
  '.############.',
];
export const CELLAR_SLOTS_PER_BLOCK = 8;

export function cellarBlocksFor(count: number): number {
  return Math.ceil(count / CELLAR_SLOTS_PER_BLOCK);
}

const CHAR_TILE: Record<string, Tile> = {
  '.': 'grass',
  '#': 'path',
  '~': 'water',
  '=': 'dock',
  o: 'boat',
  T: 'tree',
  b: 'bush',
  n: 'bench',
  f: 'fence',
  B: 'bed',
  A: 'arch',
  K: 'cellar',
  c: 'compost',
};

export function parseTile(ch: string): Tile {
  const t = CHAR_TILE[ch];
  if (!t) throw new Error(`Unknown template char "${ch}"`);
  return t;
}

/** Template rows with `extraBlocks` extension blocks and `cellarBlocks` cellar rows at the back. */
export function buildTemplate(extraBlocks: number, cellarBlocks = 0): string[] {
  const rows = [...BASE_TEMPLATE];
  for (let i = 0; i < extraBlocks; i++) rows.splice(EXTENSION_INSERT_ROW, 0, ...EXTENSION_BLOCK);
  if (cellarBlocks > 0) {
    // Clear the trees that would hide the cellar, and join its walkway to the main path.
    rows[0] = rows[0].replace(/[Tb]/g, '.').slice(0, 6) + '##' + rows[0].replace(/[Tb]/g, '.').slice(8);
    for (let i = 0; i < cellarBlocks; i++) rows.unshift(...CELLAR_BLOCK);
  }
  return rows;
}

export const BLOCKED_TILES: ReadonlySet<Tile> = new Set<Tile>([
  'water',
  'boat',
  'tree',
  'bush',
  'bench',
  'fence',
  'bed',
  'cellar',
  'compost',
]);
