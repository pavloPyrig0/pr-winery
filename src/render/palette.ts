import type { Season } from '../types';

export interface SeasonPalette {
  grass: [number, number, number];
  grassEdge: number;
  tuft: number;
  tuftDark: number;
  wildflowers: number[];
  foliage: [number, number, number]; // dark, mid, light
  foliageAccent: number[];
  trunk: number;
  snow: boolean;
  skirt: number;
  background: number;
}

export const SEASONS: Record<Season, SeasonPalette> = {
  spring: {
    grass: [0x86c75a, 0x7cbf52, 0x92cf62],
    grassEdge: 0x6aa847,
    tuft: 0x6cb446,
    tuftDark: 0x4f9a37,
    wildflowers: [0xfff2a8, 0xffffff, 0xf9d94a, 0xffd1e6],
    foliage: [0x3f8a3a, 0x58a845, 0x7cc65a],
    foliageAccent: [0xf6b8d0, 0xffffff],
    trunk: 0x7a5232,
    snow: false,
    skirt: 0x7b5a3c,
    background: 0xcfe3c0,
  },
  summer: {
    grass: [0x6fb24a, 0x66a943, 0x79bb52],
    grassEdge: 0x55933a,
    tuft: 0x5aa03b,
    tuftDark: 0x3f852b,
    wildflowers: [0xf9d94a, 0xffffff, 0xfff2a8],
    foliage: [0x2f7531, 0x46933c, 0x63ad4b],
    foliageAccent: [0xe85a5a],
    trunk: 0x6e4a2c,
    snow: false,
    skirt: 0x75553a,
    background: 0xc4dcb3,
  },
  autumn: {
    grass: [0xa2a957, 0x98a04f, 0xadb361],
    grassEdge: 0x878c43,
    tuft: 0x8d9443,
    tuftDark: 0x737a35,
    wildflowers: [0xf2c14e, 0xffffff],
    foliage: [0xb2471f, 0xdc7a2a, 0xf0b23f],
    foliageAccent: [0x8f3b1b],
    trunk: 0x5e3f27,
    snow: false,
    skirt: 0x6a4a31,
    background: 0xe3d7bd,
  },
  winter: {
    grass: [0xe6eef0, 0xdde7ea, 0xf0f5f6],
    grassEdge: 0xc6d3d8,
    tuft: 0xb9c9ae,
    tuftDark: 0x93a88a,
    wildflowers: [0xffffff],
    foliage: [0x2f5d46, 0x3f7357, 0x5a8a6c],
    foliageAccent: [0xffffff],
    trunk: 0x5a4434,
    snow: true,
    skirt: 0x6b5b50,
    background: 0xd9e3e8,
  },
};

export const C = {
  brick: 0xd98a4e,
  brickLight: 0xe39b5d,
  brickJoint: 0xb86b38,
  brickEdge: 0x9e3f2a,
  water: 0x4ba3b2,
  waterDeep: 0x3b8d9c,
  waterLight: 0x7cc3cd,
  shore: 0xc9b98a,
  lily: 0x4f9a3d,
  lilyLight: 0x6fb653,
  wood: 0xa8754a,
  woodDark: 0x7d5434,
  woodLight: 0xc48f5f,
  stoneTop: 0xc9c2b4,
  stoneLeft: 0x9b9386,
  stoneRight: 0xb2aa9c,
  stoneJoint: 0x847c70,
  soil: 0x6b4429,
  soilDark: 0x553420,
  soilDry: 0x9c7a55,
  soilCrack: 0x6e5236,
  shadow: 0x1b2a14,
  // The winemaker wears a burgundy apron-coat.
  hoodie: 0x6b1730,
  hoodieDark: 0x4e0f22,
  hoodieLight: 0x8a2a46,
  pants: 0x3a3f4a,
  skin: 0xf0c49a,
  hair: 0x5a3a22,
  can: 0x8fb3b8,
  canDark: 0x6a8c91,
};

/** Border flower palettes; each bed rotates through them. */
export const BORDER_PALETTES: { name: string; petals: number[]; center: number }[] = [
  { name: 'pink', petals: [0xf49ac1, 0xf7b6d2, 0xe57aa8], center: 0xfff1a8 },
  { name: 'purple', petals: [0xa77bd6, 0xbb98e3, 0x8b5fc2], center: 0xfff1a8 },
  { name: 'red', petals: [0xe0524f, 0xec7470, 0xc63d3a], center: 0xffe27a },
  { name: 'blue', petals: [0x5b8fe0, 0x7da8ec, 0x4776c9], center: 0xfff7d1 },
];
