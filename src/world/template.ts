// Handcrafted 14×14 garden template plus extension blocks.
//
// Legend
//   .  grass            #  brick path        ~  water          =  wooden dock
//   o  rowboat (water)  T  tree              b  bush           n  bench
//   B  bed slot (2×2)   A  arch (exit)       h  harvest basket c  compost heap
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
  | 'bed'
  | 'arch'
  | 'basket'
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
  'Tb...h##c...bT',
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

const CHAR_TILE: Record<string, Tile> = {
  '.': 'grass',
  '#': 'path',
  '~': 'water',
  '=': 'dock',
  o: 'boat',
  T: 'tree',
  b: 'bush',
  n: 'bench',
  B: 'bed',
  A: 'arch',
  h: 'basket',
  c: 'compost',
};

export function parseTile(ch: string): Tile {
  const t = CHAR_TILE[ch];
  if (!t) throw new Error(`Unknown template char "${ch}"`);
  return t;
}

/** Template rows with `extraBlocks` extension blocks inserted. */
export function buildTemplate(extraBlocks: number): string[] {
  const rows = [...BASE_TEMPLATE];
  for (let i = 0; i < extraBlocks; i++) rows.splice(EXTENSION_INSERT_ROW, 0, ...EXTENSION_BLOCK);
  return rows;
}

export const BLOCKED_TILES: ReadonlySet<Tile> = new Set<Tile>([
  'water',
  'boat',
  'tree',
  'bush',
  'bench',
  'bed',
  'basket',
  'compost',
]);
