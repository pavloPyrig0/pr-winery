// Builds and updates the Pixi display tree for one garden.
// All drawing goes through src/render/* so it can be swapped for sprites later.
import { Container, Graphics, Text } from 'pixi.js';
import type { GardenItem, Season } from '../types';
import { marker } from '../github/mapping';
import type { Placed, World } from '../world/layout';
import { Ambient } from './ambient';
import { CURB_H, drawBed } from './drawBed';
import { drawGround } from './drawGround';
import { createGardener, SPOUT_TIP, type Facing, type GardenerArt } from './drawGardener';
import { drawArch, drawFence, drawBarrel, drawBottle, drawBench, drawBoat, drawBush, drawCompost, drawMarker, drawTree, drawWeed } from './drawProps';
import { depthOf, polyPoints, toScreen } from './iso';
import { SEASONS } from './palette';

interface MarkerSprite {
  view: Container;
  baseY: number;
  phase: number;
}

function dashedPoly(g: Graphics, pts: number[], dash: number, gap: number, offset: number) {
  const n = pts.length / 2;
  const period = dash + gap;
  let dist = offset;
  for (let i = 0; i < n; i++) {
    const x0 = pts[i * 2];
    const y0 = pts[i * 2 + 1];
    const x1 = pts[((i + 1) % n) * 2];
    const y1 = pts[((i + 1) % n) * 2 + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const at = (t: number) => [x0 + ((x1 - x0) * t) / len, y0 + ((y1 - y0) * t) / len] as const;
    let t = 0;
    while (t < len) {
      const phase = (dist + t) % period;
      if (phase < dash) {
        const end = Math.min(len, t + dash - phase);
        const [ax, ay] = at(t);
        const [bx, by] = at(end);
        g.moveTo(ax, ay).lineTo(bx, by);
        t = end;
      } else t += period - phase;
    }
    dist += len;
  }
}

export interface SceneOptions {
  season: Season;
}

export class Scene {
  readonly root = new Container();
  private objects = new Container();
  private markers = new Container();
  private hints = new Container();
  private ambient: Ambient;
  private gardener: GardenerArt;
  private highlight = new Graphics();
  private keyHint: Container;
  private markerSprites: MarkerSprite[] = [];
  private highlighted: Placed | null = null;
  private dashOffset = 0;
  private views = new Map<string, Container>();

  constructor(private world: World, opts: SceneOptions) {
    const pal = SEASONS[opts.season];
    this.root.label = 'world';
    this.root.addChild(drawGround(world, pal));

    const bloom: { x: number; y: number }[] = [];
    const wilt: { x: number; y: number }[] = [];
    for (const p of world.placed) {
      if (p.item.kind !== 'bed') continue;
      const s = toScreen(p.x + 1, p.y + 1);
      if (p.item.state === 'blooming') bloom.push(s);
      if (p.item.state === 'wilting') wilt.push(s);
    }
    this.ambient = new Ambient(world, pal, bloom, wilt);
    this.root.addChild(this.ambient.ground);

    this.objects.sortableChildren = true;
    this.root.addChild(this.objects);
    this.root.addChild(this.ambient.air);
    this.root.addChild(this.markers);
    this.root.addChild(this.hints);

    // Decor from the template.
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const t = world.tiles[y * world.width + x];
        let view: Container | null = null;
        const seed = `${t}:${x}:${y}`;
        if (t === 'tree') view = drawTree(seed, pal);
        else if (t === 'bush') view = drawBush(seed, pal);
        else if (t === 'bench') view = drawBench();
        else if (t === 'boat') view = drawBoat();
        if (t === 'fence') this.addObject(drawFence(), x + 0.5, y + 0.95);
        else if (view) this.addObject(view, x + 0.5, y + 0.5);
      }
    }
    // One vine-covered arch per area, with the area's name on the sign.
    for (const area of world.areas) {
      this.addObject(drawArch(area.label, pal), area.arch.x1, area.arch.y + 0.5);
    }

    // Interactables.
    let bedIndex = 0;
    for (const p of world.placed) {
      const view = this.drawItem(p.item, bedIndex);
      if (p.item.kind === 'bed') bedIndex++;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      this.addObject(view, cx, cy);
      this.views.set(p.item.id, view);
      if (p.item.kind === 'bed') {
        const m = marker(p.item.state);
        if (m) {
          const mv = drawMarker(m);
          const s = toScreen(cx, cy);
          mv.position.set(s.x, s.y - 62);
          this.markers.addChild(mv);
          this.markerSprites.push({ view: mv, baseY: s.y - 62, phase: (cx * 1.3 + cy) % 6 });
        }
      }
    }

    this.highlight.zIndex = -1;
    this.objects.addChild(this.highlight);

    this.gardener = createGardener();
    this.objects.addChild(this.gardener.view);

    this.keyHint = this.buildKeyHint();
    this.keyHint.visible = false;
    this.hints.addChild(this.keyHint);
  }

  private drawItem(item: GardenItem, bedIndex: number): Container {
    switch (item.kind) {
      case 'bed':
        return drawBed(item.id, item.state, bedIndex);
      case 'weed':
        return drawWeed(item.id);
      case 'barrel':
        return drawBarrel(item.id);
      case 'bottle':
        return drawBottle(item.id, item.pr.state);
      case 'compost':
        return drawCompost();
    }
  }

  private addObject(view: Container, wx: number, wy: number) {
    const s = toScreen(wx, wy);
    view.position.set(s.x, s.y);
    view.zIndex = depthOf(wx, wy);
    this.objects.addChild(view);
  }

  private buildKeyHint(): Container {
    const c = new Container();
    const text = new Text({
      text: 'E · Open',
      style: { fontFamily: 'Roboto, sans-serif', fontSize: 11, fontWeight: '700', fill: 0xffffff },
      resolution: 3,
    });
    text.anchor.set(0.5);
    const bg = new Graphics();
    const w = text.width + 16;
    bg.roundRect(-w / 2, -10, w, 20, 8).fill({ color: 0x4a1024, alpha: 0.92 });
    bg.roundRect(-w / 2, -10, w, 20, 8).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
    bg.moveTo(-5, 10).lineTo(0, 15).lineTo(5, 10).fill({ color: 0x4a1024, alpha: 0.92 });
    c.addChild(bg, text);
    return c;
  }

  setGardener(x: number, y: number, facing: Facing, frame: number, watering: boolean, faceLeft: boolean) {
    const s = toScreen(x, y);
    this.gardener.view.position.set(s.x, s.y);
    this.gardener.view.zIndex = depthOf(x, y);
    this.gardener.setPose(facing, frame, watering, faceLeft);
  }

  /** Screen-space spout tip, for spawning droplets. */
  spoutTip(x: number, y: number, faceLeft: boolean): { x: number; y: number } {
    const s = toScreen(x, y);
    return { x: s.x + (faceLeft ? -SPOUT_TIP.x : SPOUT_TIP.x), y: s.y + SPOUT_TIP.y };
  }

  setHighlight(p: Placed | null) {
    this.highlighted = p;
    this.keyHint.visible = !!p;
    if (!p) {
      this.highlight.clear();
      return;
    }
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const s = toScreen(cx, cy);
    this.highlight.zIndex = depthOf(cx, cy) + 0.001;
    const lift = p.item.kind === 'bed' ? 72 : p.item.kind === 'weed' ? 34 : 52;
    this.keyHint.position.set(s.x, s.y - lift - (p.item.kind === 'bed' && this.hasMarker(p) ? 30 : 0));
    this.redrawHighlight();
  }

  private hasMarker(p: Placed) {
    return p.item.kind === 'bed' && marker(p.item.state) !== null;
  }

  private redrawHighlight() {
    const p = this.highlighted;
    const g = this.highlight;
    g.clear();
    if (!p) return;
    const lift = p.item.kind === 'bed' ? CURB_H : 0;
    const pad = 0.08;
    const pts = polyPoints(
      [
        [p.x - pad, p.y - pad],
        [p.x + p.w + pad, p.y - pad],
        [p.x + p.w + pad, p.y + p.h + pad],
        [p.x - pad, p.y + p.h + pad],
      ],
      lift,
    );
    dashedPoly(g, pts, 7, 5, this.dashOffset);
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.95, cap: 'round' });
  }

  update(dt: number, time: number, reducedMotion: boolean) {
    this.ambient.update(dt, time, reducedMotion);
    for (const m of this.markerSprites) {
      m.view.y = reducedMotion ? m.baseY : m.baseY + Math.sin(time * 2.4 + m.phase) * 3;
    }
    if (this.highlighted && !reducedMotion) {
      this.dashOffset = (this.dashOffset + dt * 14) % 12;
      this.redrawHighlight();
    }
    if (this.keyHint.visible && !reducedMotion) {
      this.keyHint.scale.set(1 + Math.sin(time * 4) * 0.03);
    }
  }

  dust(x: number, y: number) {
    const s = toScreen(x, y);
    this.ambient.dust(s.x, s.y);
  }

  water(x: number, y: number, faceLeft: boolean) {
    const tip = this.spoutTip(x, y, faceLeft);
    this.ambient.water(tip.x, tip.y, faceLeft ? -1 : 1);
  }

  get worldData() {
    return this.world;
  }

  destroy() {
    this.ambient.destroy();
    this.root.destroy({ children: true });
  }
}
