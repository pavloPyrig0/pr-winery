// Game controller: fixed-timestep simulation, rendering and garden switching.
import { Application } from 'pixi.js';
import type { GardenData, GardenId, GardenItem, Season } from './types';
import { gardenItems, itemUrl } from './github/mapping';
import { Keyboard, type Action } from './input/keyboard';
import { attachMouse } from './input/mouse';
import { Camera, mapBounds, type Viewport } from './render/camera';
import { screenInputToWorld, toScreen, toWorld, worldDirToScreen } from './render/iso';
import { SEASONS } from './render/palette';
import { Scene } from './render/scene';
import { moveWithCollision } from './world/collision';
import { isTileBlocked, layoutGarden, nearestInteractable, type Placed, type World } from './world/layout';
import { findPath, tilesAround, type TilePos } from './world/pathfinding';

export const STEP = 1 / 60;
export const WALK_SPEED = 4; // tiles per second
export const RUN_MULT = 1.6;
export const RADIUS = 0.24;
const TEND_DURATION = 0.85;
const TEND_OPEN_AT = 0.5;
const FADE_MS = 260;

export interface GameHooks {
  /** Something the UI shows has changed. */
  onUiChange(): void;
  onAction(a: Action): void;
  onHover(item: GardenItem | null, clientX: number, clientY: number): void;
  openUrl(url: string): void;
}

interface Gardener {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  faceLeft: boolean;
  back: boolean;
  walk: number;
  dustTimer: number;
  path: TilePos[] | null;
  pathTarget: Placed | null;
  tend: { item: GardenItem; t: number; opened: boolean } | null;
}

export class Game {
  app = new Application();
  keyboard: Keyboard;
  camera = new Camera();
  garden: GardenId = 'mine';
  season: Season;
  data: GardenData | null = null;
  items: GardenItem[] = [];
  world!: World;
  scene: Scene | null = null;
  highlighted: Placed | null = null;
  reducedMotion = false;
  /** When true (overlay open), the world ignores game input. */
  paused = false;
  private g: Gardener;
  private view: Viewport = { width: 800, height: 600 };
  private time = 0;
  private transitioning = false;
  private stateSig = '';
  private lastStateCheck = 0;

  constructor(
    private host: HTMLElement,
    private hooks: GameHooks,
    season: Season,
  ) {
    this.season = season;
    this.keyboard = new Keyboard((a) => hooks.onAction(a));
    this.g = {
      x: 7, y: 12.5, px: 7, py: 12.5, vx: 0, vy: 0, fx: -0.7, fy: -0.7,
      faceLeft: false, back: true, walk: 0, dustTimer: 0, path: null, pathTarget: null, tend: null,
    };
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = mq.matches;
    mq.addEventListener('change', () => (this.reducedMotion = mq.matches));
  }

  async init() {
    await this.app.init({
      resizeTo: window,
      antialias: true,
      autoStart: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      background: SEASONS[this.season].background,
    });
    const canvas = this.app.canvas;
    canvas.id = 'garden-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    this.host.appendChild(canvas);
    attachMouse(canvas, {
      onClick: (x, y) => this.onClick(x, y),
      onHover: (x, y, cx, cy) => this.hooks.onHover(this.hitTest(x, y)?.item ?? null, cx, cy),
      onLeave: () => this.hooks.onHover(null, 0, 0),
      onZoom: (f) => this.camera.setZoom(this.camera.zoom * f),
    });
    this.camera.baseScale = window.innerWidth < 900 ? 1.1 : 1.4;
    this.rebuild(true);
    this.start();
  }

  setViewport(v: Viewport) {
    this.view = v;
  }

  // ---- Data & world ------------------------------------------------------

  setData(data: GardenData | null) {
    this.data = data;
    this.rebuild(false);
  }

  setSeason(s: Season) {
    this.season = s;
    this.app.renderer.background.color = SEASONS[s].background;
    this.rebuild(false);
  }

  private computeItems(): GardenItem[] {
    return this.data ? gardenItems(this.data, this.garden, Date.now()) : [];
  }

  private signature(items: GardenItem[]) {
    return items.map((i) => `${i.id}:${i.kind === 'bed' ? i.state : ''}`).join('|');
  }

  /** Rebuild layout + scene. `respawn` puts the gardener at the arch. */
  rebuild(respawn: boolean) {
    this.items = this.computeItems();
    this.stateSig = this.signature(this.items);
    this.world = layoutGarden(this.items, this.garden);
    const archLabel = this.garden === 'mine' ? 'To the review garden' : 'To my garden';
    const old = this.scene;
    this.scene = new Scene(this.world, { season: this.season, archLabel });
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.scene.root);
    old?.destroy();

    const g = this.g;
    if (respawn || this.blockedAt(g.x, g.y)) this.spawnAtArch();
    g.path = null;
    g.pathTarget = null;
    this.highlighted = null;
    this.updateProximity(true);
    this.syncGardener(1);
    const s = toScreen(g.x, g.y);
    this.camera.follow(s.x, s.y - 20, 0, this.view, mapBounds(this.world.width, this.world.height), respawn);
    this.hooks.onUiChange();
  }

  private spawnAtArch() {
    const g = this.g;
    g.x = g.px = this.world.spawn.x;
    g.y = g.py = this.world.spawn.y;
    g.vx = g.vy = 0;
    g.fx = -Math.SQRT1_2;
    g.fy = -Math.SQRT1_2;
    g.back = true;
    g.tend = null;
  }

  private blockedAt(x: number, y: number) {
    return isTileBlocked(this.world, Math.floor(x), Math.floor(y));
  }

  private isBlocked = (tx: number, ty: number) => isTileBlocked(this.world, tx, ty);

  // ---- Garden switching --------------------------------------------------

  switchGarden(id: GardenId) {
    if (this.transitioning || id === this.garden) return;
    this.transitioning = true;
    const fade = document.getElementById('fade');
    const ms = this.reducedMotion ? 0 : FADE_MS;
    fade?.classList.add('on');
    window.setTimeout(() => {
      this.garden = id;
      this.rebuild(true);
      fade?.classList.remove('on');
      window.setTimeout(() => (this.transitioning = false), ms);
    }, ms);
  }

  // ---- Commands from UI ----------------------------------------------------

  /** Walk to an item via A*. */
  walkTo(itemId: string) {
    const p = this.world.placed.find((pl) => pl.item.id === itemId);
    if (!p) return;
    this.pathTo(tilesAround(p.x, p.y, p.w, p.h), p);
  }

  tendItem(item: GardenItem) {
    const g = this.g;
    if (g.tend) return;
    const p = this.world.placed.find((pl) => pl.item.id === item.id);
    if (p) {
      const dx = p.x + p.w / 2 - g.x;
      const dy = p.y + p.h / 2 - g.y;
      const len = Math.hypot(dx, dy) || 1;
      g.fx = dx / len;
      g.fy = dy / len;
    }
    g.vx = g.vy = 0;
    g.path = null;
    g.tend = { item, t: 0, opened: false };
  }

  tendHighlighted() {
    if (this.highlighted) this.tendItem(this.highlighted.item);
  }

  // ---- Mouse -------------------------------------------------------------

  private screenToWorld(px: number, py: number) {
    const s = this.camera.unproject(px, py, this.view);
    return toWorld(s.x, s.y);
  }

  hitTest(px: number, py: number): Placed | null {
    if (!this.world) return null;
    // Test the ground point and a little below (beds are raised and plants stick up).
    for (const lift of [0, 14, 30]) {
      const w = this.screenToWorld(px, py + lift * this.camera.scale);
      const hit = this.world.placed.find((p) => w.x >= p.x && w.x < p.x + p.w && w.y >= p.y && w.y < p.y + p.h);
      if (hit) return hit;
    }
    return null;
  }

  private onClick(px: number, py: number) {
    if (this.paused || this.transitioning) return;
    const hit = this.hitTest(px, py);
    if (hit) {
      this.pathTo(tilesAround(hit.x, hit.y, hit.w, hit.h), hit);
      return;
    }
    const w = this.screenToWorld(px, py);
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    if (!this.isBlocked(tx, ty)) this.pathTo([{ x: tx, y: ty }], null);
  }

  private pathTo(goals: TilePos[], target: Placed | null) {
    const g = this.g;
    const start = { x: Math.floor(g.x), y: Math.floor(g.y) };
    const path = findPath(this.isBlocked, this.world.width, this.world.height, start, goals);
    if (!path) return;
    g.path = path;
    g.pathTarget = target;
    g.tend = null;
  }

  // ---- Simulation --------------------------------------------------------

  private handleActions() {
    for (const a of this.keyboard.drain()) {
      if (this.paused || this.transitioning) continue;
      if (a === 'tend') this.tendHighlighted();
    }
  }

  private update(dt: number) {
    this.time += dt;
    this.handleActions();
    const g = this.g;
    g.px = g.x;
    g.py = g.y;

    // Re-check time-based states once a minute (review beds age into wilting).
    if (this.time - this.lastStateCheck > 60) {
      this.lastStateCheck = this.time;
      const items = this.computeItems();
      if (this.signature(items) !== this.stateSig) this.rebuild(false);
      else {
        this.items = items;
        this.hooks.onUiChange();
      }
    }

    if (g.tend) {
      g.tend.t += dt;
      if (Math.floor(g.tend.t * 20) !== Math.floor((g.tend.t - dt) * 20) && this.scene) this.scene.water(g.x, g.y, g.faceLeft);
      if (!g.tend.opened && g.tend.t >= TEND_OPEN_AT) {
        g.tend.opened = true;
        this.hooks.openUrl(itemUrl(g.tend.item));
      }
      if (g.tend.t >= TEND_DURATION) g.tend = null;
      this.updateFacingSprite();
      return;
    }

    const input = this.paused || this.transitioning ? { right: 0, down: 0, run: false } : this.keyboard.axes();
    let dirX = 0;
    let dirY = 0;
    let speed = WALK_SPEED * (input.run ? RUN_MULT : 1);

    if (input.right || input.down) {
      g.path = null;
      g.pathTarget = null;
      const w = screenInputToWorld(input.right, input.down);
      const len = Math.hypot(w.x, w.y);
      dirX = w.x / len;
      dirY = w.y / len;
    } else if (g.path && g.path.length) {
      const next = g.path[0];
      const tx = next.x + 0.5;
      const ty = next.y + 0.5;
      const dx = tx - g.x;
      const dy = ty - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < (g.path.length === 1 ? 0.08 : 0.3)) {
        g.path.shift();
        if (!g.path.length) this.arrive();
      } else {
        dirX = dx / dist;
        dirY = dy / dist;
        speed = WALK_SPEED * (g.path.length > 4 ? 1.25 : 1);
        if (g.path.length === 1) speed = Math.min(speed, dist * 8 + 0.5);
      }
    } else if (g.path) {
      this.arrive();
    }

    // Accelerate towards the target velocity; ease out when released.
    const tvx = dirX * speed;
    const tvy = dirY * speed;
    const k = 1 - Math.exp(-dt * (dirX || dirY ? 14 : 12));
    g.vx += (tvx - g.vx) * k;
    g.vy += (tvy - g.vy) * k;
    if (!dirX && !dirY && Math.hypot(g.vx, g.vy) < 0.05) g.vx = g.vy = 0;

    if (g.vx || g.vy) {
      const before = { x: g.x, y: g.y };
      const after = moveWithCollision(this.isBlocked, before, g.vx * dt, g.vy * dt, RADIUS);
      g.x = after.x;
      g.y = after.y;
      // Keep only the velocity that actually happened (slide along walls).
      g.vx = (after.x - before.x) / dt;
      g.vy = (after.y - before.y) / dt;
      const sp = Math.hypot(g.vx, g.vy);
      if (sp > 0.3) {
        g.fx = g.vx / sp;
        g.fy = g.vy / sp;
      } else if (dirX || dirY) {
        g.fx = dirX;
        g.fy = dirY;
      }
      g.walk += dt * sp * 2.2;
      if (input.run && sp > WALK_SPEED * 1.1) {
        g.dustTimer -= dt;
        if (g.dustTimer <= 0 && this.scene) {
          this.scene.dust(g.x, g.y);
          g.dustTimer = 0.11;
        }
      }
    } else {
      g.walk = 0;
    }
    this.updateFacingSprite();
    this.updateProximity(false);
    this.checkArch();
  }

  private arrive() {
    const g = this.g;
    g.path = null;
    const t = g.pathTarget;
    g.pathTarget = null;
    if (t) {
      const dx = t.x + t.w / 2 - g.x;
      const dy = t.y + t.h / 2 - g.y;
      const len = Math.hypot(dx, dy) || 1;
      g.fx = dx / len;
      g.fy = dy / len;
      this.updateProximity(true);
    }
  }

  private updateFacingSprite() {
    const g = this.g;
    const s = worldDirToScreen(g.fx, g.fy);
    g.back = s.y < -0.05;
    if (Math.abs(s.x) > 0.05) g.faceLeft = s.x < 0;
  }

  private updateProximity(force: boolean) {
    const g = this.g;
    const near = nearestInteractable(this.world, g.x, g.y, { x: g.fx, y: g.fy });
    if (near !== this.highlighted || force) {
      this.highlighted = near;
      this.scene?.setHighlight(near);
      this.hooks.onUiChange();
    }
  }

  private checkArch() {
    if (this.transitioning) return;
    const g = this.g;
    const a = this.world.arch;
    if (g.y > this.world.height - 0.4 && g.x >= a.x0 && g.x <= a.x1 + 1) {
      this.switchGarden(this.garden === 'mine' ? 'review' : 'mine');
    }
  }

  // ---- Rendering ---------------------------------------------------------

  private syncGardener(alpha: number) {
    const g = this.g;
    const x = g.px + (g.x - g.px) * alpha;
    const y = g.py + (g.y - g.py) * alpha;
    const moving = Math.hypot(g.vx, g.vy) > 0.25;
    const frame = g.tend ? Math.floor(g.tend.t * 8) : moving ? Math.floor(g.walk) % 4 : 0;
    this.scene?.setGardener(x, y, g.back ? 'back' : 'front', frame, !!g.tend, g.faceLeft);
    return { x, y };
  }

  private render(alpha: number, dt: number) {
    if (!this.scene) return;
    const p = this.syncGardener(alpha);
    const s = toScreen(p.x, p.y);
    this.camera.follow(s.x, s.y - 20, dt, this.view, mapBounds(this.world.width, this.world.height), this.reducedMotion);
    this.camera.apply(this.scene.root, this.view);
    this.scene.update(dt, this.time, this.reducedMotion);
    this.app.render();
  }

  private start() {
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      acc += dt;
      while (acc >= STEP) {
        this.update(STEP);
        acc -= STEP;
      }
      this.render(acc / STEP, dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ---- Queries for UI ----------------------------------------------------

  countFor(id: GardenId): number {
    if (!this.data) return 0;
    return gardenItems(this.data, id, Date.now()).filter((i) => i.kind === 'bed').length;
  }
}
