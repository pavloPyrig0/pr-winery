import { describe, expect, it } from 'vitest';
import { findPath, tilesAround } from '../src/world/pathfinding';

function grid(rows: string[]) {
  return {
    w: rows[0].length,
    h: rows.length,
    blocked: (x: number, y: number) => y < 0 || x < 0 || y >= rows.length || x >= rows[0].length || rows[y][x] === '#',
  };
}

describe('findPath', () => {
  it('finds a straight path and excludes the start tile', () => {
    const g = grid(['.....']);
    expect(findPath(g.blocked, g.w, g.h, { x: 0, y: 0 }, [{ x: 3, y: 0 }])).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });
  it('uses diagonals in open space', () => {
    const g = grid(['....', '....', '....', '....']);
    const p = findPath(g.blocked, g.w, g.h, { x: 0, y: 0 }, [{ x: 3, y: 3 }])!;
    expect(p).toHaveLength(3);
  });
  it('routes around walls', () => {
    const g = grid(['.#...', '.#.#.', '...#.']);
    const p = findPath(g.blocked, g.w, g.h, { x: 0, y: 0 }, [{ x: 4, y: 0 }])!;
    expect(p.at(-1)).toEqual({ x: 4, y: 0 });
    for (const t of p) expect(g.blocked(t.x, t.y)).toBe(false);
  });
  it('never cuts corners diagonally', () => {
    const g = grid(['.#', '..']);
    const p = findPath(g.blocked, g.w, g.h, { x: 0, y: 0 }, [{ x: 1, y: 1 }])!;
    expect(p).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });
  it('returns null when unreachable and [] when already there', () => {
    const g = grid(['.#.']);
    expect(findPath(g.blocked, g.w, g.h, { x: 0, y: 0 }, [{ x: 2, y: 0 }])).toBeNull();
    expect(findPath(g.blocked, g.w, g.h, { x: 0, y: 0 }, [{ x: 0, y: 0 }])).toEqual([]);
  });
  it('goes to the nearest of several goals (e.g. any side of a bed)', () => {
    const g = grid(['......', '..##..', '..##..', '......']);
    const goals = tilesAround(2, 1, 2, 2);
    const p = findPath(g.blocked, g.w, g.h, { x: 0, y: 3 }, goals)!;
    expect(p).toEqual([{ x: 1, y: 2 }]);
  });
});
