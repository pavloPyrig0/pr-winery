import { describe, expect, it } from 'vitest';
import { toBed } from '../src/github/mapping';
import type { GardenItem } from '../src/types';
import { composeWorld, COMMONS_ROWS, HEDGE_COLS } from '../src/world/compose';
import { areaAt, isTileBlocked, layoutGarden } from '../src/world/layout';
import { findPath } from '../src/world/pathfinding';
import { NOW, makePr } from './fixtures';

const beds = (n: number, garden: 'mine' | 'review'): GardenItem[] =>
  Array.from({ length: n }, (_, i) =>
    toBed(makePr({ repo: `o/${i % 2}`, review: { requestedAt: new Date(NOW).toISOString(), isRequested: true, myLastReviewState: null, myLastReviewAt: null, newCommitsSinceReview: false } }), garden, 'me', NOW)!,
  );

function world(mine: number, review: number) {
  return composeWorld(layoutGarden(beds(mine, 'mine'), 'mine'), layoutGarden(beds(review, 'review'), 'review'));
}

describe('composeWorld', () => {
  it('puts both areas side by side with a hedge and a shared path below', () => {
    const w = world(3, 2);
    expect(w.width).toBe(14 + HEDGE_COLS + 14);
    expect(w.height).toBe(14 + COMMONS_ROWS);
    expect(w.areas.map((a) => [a.garden, a.label, a.x0])).toEqual([
      ['mine', 'My PRs', 0],
      ['review', 'To review', 15],
    ]);
    for (let y = 0; y < 14; y++) expect(isTileBlocked(w, 14, y)).toBe(true);
  });

  it('keeps every bed, tagged with its area and inside that area', () => {
    const w = world(3, 2);
    const bedsIn = (g: string) => w.placed.filter((p) => p.item.kind === 'bed' && p.garden === g);
    expect(bedsIn('mine')).toHaveLength(3);
    expect(bedsIn('review')).toHaveLength(2);
    for (const p of w.placed) expect(areaAt(w, p.x + 0.5, p.y + 0.5)?.garden).toBe(p.garden);
  });

  it('lines up the entrances when one area has extra rows', () => {
    const w = world(20, 1);
    expect(w.areas[0].arch.y).toBe(w.areas[1].arch.y);
    expect(w.height).toBe(20 + COMMONS_ROWS);
  });

  it('connects the start point to both entrances and inside both areas', () => {
    const w = world(5, 5);
    const blocked = (x: number, y: number) => isTileBlocked(w, x, y);
    const start = { x: Math.floor(w.spawn.x), y: Math.floor(w.spawn.y) };
    expect(areaAt(w, w.spawn.x, w.spawn.y)).toBeNull();
    for (const a of w.areas) {
      const goal = { x: Math.floor(a.spawn.x), y: Math.floor(a.spawn.y) };
      expect(areaAt(w, a.spawn.x, a.spawn.y)?.garden).toBe(a.garden);
      expect(findPath(blocked, w.width, w.height, start, [goal])).not.toBeNull();
    }
  });
});

describe('area fences', () => {
  it('only lets you into an area through its arch', () => {
    const w = world(2, 2);
    for (const a of w.areas) {
      for (let x = a.x0; x < a.x0 + a.width; x++) {
        const isArch = x === a.arch.x0 || x === a.arch.x1;
        expect(isTileBlocked(w, x, a.arch.y)).toBe(!isArch);
      }
    }
  });
});
