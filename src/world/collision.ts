// Circle-vs-tile collision with axis-separated sliding.

export type BlockedFn = (tx: number, ty: number) => boolean;

export interface Vec2 {
  x: number;
  y: number;
}

/** True if a circle at (x, y) with radius r overlaps any blocked tile. */
export function collides(isBlocked: BlockedFn, x: number, y: number, r: number): boolean {
  const minX = Math.floor(x - r);
  const maxX = Math.floor(x + r);
  const minY = Math.floor(y - r);
  const maxY = Math.floor(y + r);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!isBlocked(tx, ty)) continue;
      const cx = Math.max(tx, Math.min(x, tx + 1));
      const cy = Math.max(ty, Math.min(y, ty + 1));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r - 1e-9) return true;
    }
  }
  return false;
}

const MAX_STEP = 0.08;

/**
 * Move a circle by (dx, dy). Each axis is resolved separately, so hitting a
 * wall at an angle slides along it instead of stopping dead. The move is
 * sub-stepped so fast movement can't tunnel through thin obstacles.
 */
export function moveWithCollision(isBlocked: BlockedFn, pos: Vec2, dx: number, dy: number, r: number): Vec2 {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_STEP));
  const sx = dx / steps;
  const sy = dy / steps;
  let x = pos.x;
  let y = pos.y;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) {
      if (!collides(isBlocked, x + sx, y, r)) x += sx;
      else x = slideToContact(isBlocked, x, y, sx, 0, r).x;
    }
    if (sy !== 0) {
      if (!collides(isBlocked, x, y + sy, r)) y += sy;
      else y = slideToContact(isBlocked, x, y, 0, sy, r).y;
    }
  }
  return { x, y };
}

/** Binary-search the furthest free point along a short step. */
function slideToContact(isBlocked: BlockedFn, x: number, y: number, sx: number, sy: number, r: number): Vec2 {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    if (collides(isBlocked, x + sx * mid, y + sy * mid, r)) hi = mid;
    else lo = mid;
  }
  return { x: x + sx * lo, y: y + sy * lo };
}
