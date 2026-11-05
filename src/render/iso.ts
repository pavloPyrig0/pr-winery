// 2:1 isometric projection helpers. World units are tiles; screen units are px.
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

export interface Pt {
  x: number;
  y: number;
}

export function toScreen(x: number, y: number): Pt {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H };
}

export function toWorld(sx: number, sy: number): Pt {
  return { x: (sx / HALF_W + sy / HALF_H) / 2, y: (sy / HALF_H - sx / HALF_W) / 2 };
}

/** Flat array of screen coords for a polygon given in world coords. */
export function polyPoints(pts: [number, number][], lift = 0): number[] {
  const out: number[] = [];
  for (const [x, y] of pts) {
    const s = toScreen(x, y);
    out.push(s.x, s.y - lift);
  }
  return out;
}

/** Painter's order key: larger = closer to the viewer. */
export function depthOf(x: number, y: number): number {
  return x + y;
}

/** Map screen-relative input (right = +1, down = +1) onto world axes. */
export function screenInputToWorld(right: number, down: number): Pt {
  // screen up = world (-1,-1), screen right = world (1,-1)
  return { x: right + down, y: down - right };
}

/** Map a world direction to a screen direction (unnormalised). */
export function worldDirToScreen(dx: number, dy: number): Pt {
  return { x: dx - dy, y: (dx + dy) / 2 };
}
