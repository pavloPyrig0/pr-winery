// Smooth-follow camera with zoom, clamped to the map's screen bounds.
import type { Container } from 'pixi.js';
import { toScreen } from './iso';

export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 1.5;

export interface Viewport {
  /** Visible area of the canvas not covered by the side panel (CSS px). */
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function mapBounds(width: number, height: number): Bounds {
  const top = toScreen(0, 0);
  const right = toScreen(width, 0);
  const bottom = toScreen(width, height);
  const left = toScreen(0, height);
  // Extra headroom for trees on the top edge and the skirt at the bottom.
  return { minX: left.x - 40, maxX: right.x + 40, minY: top.y - 110, maxY: bottom.y + 50 };
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  /** Scale applied before user zoom, so the garden fills a typical screen. */
  baseScale = 1.4;

  get scale() {
    return this.baseScale * this.zoom;
  }

  setZoom(z: number) {
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  /** Clamp a desired centre so the view stays on the map. */
  clampCentre(cx: number, cy: number, view: Viewport, b: Bounds): { x: number; y: number } {
    const halfW = view.width / 2 / this.scale;
    const halfH = view.height / 2 / this.scale;
    const clampAxis = (v: number, min: number, max: number, half: number) =>
      max - min <= half * 2 ? (min + max) / 2 : Math.min(max - half, Math.max(min + half, v));
    return { x: clampAxis(cx, b.minX, b.maxX, halfW), y: clampAxis(cy, b.minY, b.maxY, halfH) };
  }

  follow(targetX: number, targetY: number, dt: number, view: Viewport, b: Bounds, instant: boolean) {
    const t = this.clampCentre(targetX, targetY, view, b);
    if (instant) {
      this.x = t.x;
      this.y = t.y;
      return;
    }
    const k = 1 - Math.exp(-dt * 6);
    this.x += (t.x - this.x) * k;
    this.y += (t.y - this.y) * k;
    // Re-clamp in case zoom changed underneath us.
    const c = this.clampCentre(this.x, this.y, view, b);
    this.x = c.x;
    this.y = c.y;
  }

  apply(world: Container, view: Viewport) {
    const s = this.scale;
    world.scale.set(s);
    world.position.set(Math.round(view.width / 2 - this.x * s), Math.round(view.height / 2 - this.y * s));
  }

  /** CSS-pixel point on the canvas → world screen-space (pre-projection) point. */
  unproject(px: number, py: number, view: Viewport): { x: number; y: number } {
    const s = this.scale;
    return { x: (px - view.width / 2) / s + this.x, y: (py - view.height / 2) / s + this.y };
  }
}
