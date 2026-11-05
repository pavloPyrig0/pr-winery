import { describe, expect, it } from 'vitest';
import { collides, moveWithCollision } from '../src/world/collision';

// 5×5 room with walls around it and a single block at (2, 2).
const blocked = (x: number, y: number) => x < 0 || y < 0 || x > 4 || y > 4 || (x === 2 && y === 2);
const R = 0.25;

describe('collides', () => {
  it('detects overlap with a blocked tile', () => {
    expect(collides(blocked, 2.5, 2.5, R)).toBe(true);
    expect(collides(blocked, 1.8, 2.5, R)).toBe(true);
    expect(collides(blocked, 1.7, 2.5, R)).toBe(false);
  });
  it('uses the circle, not a box, at corners', () => {
    // Diagonally off the corner (2,2): box would overlap, circle does not.
    expect(collides(blocked, 1.8, 1.8, R)).toBe(false);
  });
});

describe('moveWithCollision', () => {
  it('moves freely in open space', () => {
    const p = moveWithCollision(blocked, { x: 0.5, y: 0.5 }, 0.5, 0.3, R);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(0.8);
  });
  it('stops at a wall without passing through', () => {
    const p = moveWithCollision(blocked, { x: 1.5, y: 2.5 }, 1, 0, R);
    expect(p.x).toBeLessThanOrEqual(2 - R + 1e-6);
    expect(p.x).toBeGreaterThan(2 - R - 0.05);
  });
  it('slides along a wall when moving diagonally into it', () => {
    const p = moveWithCollision(blocked, { x: 1.5, y: 2.5 }, 1, 0.4, R);
    expect(p.x).toBeLessThan(2 - R + 1e-6);
    expect(p.y).toBeCloseTo(2.9);
  });
  it('does not tunnel through a 1-tile block at high speed', () => {
    const p = moveWithCollision(blocked, { x: 1.5, y: 2.5 }, 3, 0, R);
    expect(p.x).toBeLessThan(2);
  });
  it('stays inside the room bounds', () => {
    const p = moveWithCollision(blocked, { x: 0.5, y: 0.5 }, -5, -5, R);
    expect(p.x).toBeCloseTo(R, 2);
    expect(p.y).toBeCloseTo(R, 2);
  });
});
