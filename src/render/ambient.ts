// Ambient life: swaying grass tufts, water ripples, butterflies, flies,
// dust puffs and water droplets. Everything here is cosmetic.
import { Container, Graphics, GraphicsContext } from 'pixi.js';
import type { World } from '../world/layout';
import { tileAt } from '../world/layout';
import { toScreen } from './iso';
import { C, type SeasonPalette } from './palette';
import { mulberry32, range } from './rng';

interface Tuft {
  g: Graphics;
  phase: number;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  life: number;
}

interface Flyer {
  cx: number;
  cy: number;
  phase: number;
  speed: number;
  radius: number;
  color: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  kind: 'dust' | 'drop';
}

export class Ambient {
  /** Ground-level layer (tufts and ripples). */
  readonly ground = new Container();
  /** Above-objects layer (butterflies, flies, particles). */
  readonly air = new Container();

  private tufts: Tuft[] = [];
  private rippleG = new Graphics();
  private airG = new Graphics();
  private ripples: Ripple[] = [];
  private waterTiles: { x: number; y: number }[] = [];
  private butterflies: Flyer[] = [];
  private flies: Flyer[] = [];
  private particles: Particle[] = [];
  private rng = mulberry32(42);
  private rippleTimer = 0;

  constructor(world: World, pal: SeasonPalette, bloomCentres: { x: number; y: number }[], wiltCentres: { x: number; y: number }[]) {
    const tuftCtx = [0, 1, 2].map((v) => {
      const ctx = new GraphicsContext();
      const blades = 4 + v;
      for (let i = 0; i < blades; i++) {
        const a = -Math.PI / 2 + (i - (blades - 1) / 2) * 0.32;
        const len = 6 + ((i * 7 + v * 3) % 4);
        ctx.moveTo(-1.2 + i * 0.6, 0)
          .quadraticCurveTo(Math.cos(a) * len * 0.4, Math.sin(a) * len * 0.6, Math.cos(a) * len, Math.sin(a) * len)
          .lineTo(0.8 + i * 0.6, 0)
          .fill(i % 2 ? pal.tuft : pal.tuftDark);
      }
      return ctx;
    });

    const rng = mulberry32(world.width * 31 + world.height);
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const t = tileAt(world, x, y);
        if (t === 'water') this.waterTiles.push({ x, y });
        if (t !== 'grass' || world.occupancy.has(y * world.width + x)) continue;
        const n = rng() < 0.6 ? 1 + Math.floor(rng() * 2) : 0;
        for (let i = 0; i < n; i++) {
          const s = toScreen(x + range(rng, 0.15, 0.85), y + range(rng, 0.15, 0.85));
          const g = new Graphics(tuftCtx[Math.floor(rng() * 3)]);
          g.position.set(s.x, s.y);
          this.ground.addChild(g);
          this.tufts.push({ g, phase: rng() * Math.PI * 2 });
        }
      }
    }
    this.ground.addChild(this.rippleG);
    this.air.addChild(this.airG);

    const palette = [0xffffff, 0xf9d94a, 0xa7c7f2, 0xf49ac1];
    for (const c of bloomCentres) {
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        this.butterflies.push({
          cx: c.x,
          cy: c.y - 30,
          phase: rng() * 10,
          speed: range(rng, 0.5, 0.9),
          radius: range(rng, 20, 34),
          color: palette[Math.floor(rng() * palette.length)],
        });
      }
    }
    for (const c of wiltCentres) {
      for (let i = 0; i < 4; i++) {
        this.flies.push({ cx: c.x, cy: c.y - 22, phase: rng() * 10, speed: range(rng, 2.5, 4), radius: range(rng, 6, 14), color: 0x2a2a2a });
      }
    }
    // Ripples start already spread out so the pond looks alive immediately.
    for (let i = 0; i < 4; i++) this.spawnRipple(rng() * 2.5);
  }

  private spawnRipple(age = 0) {
    if (!this.waterTiles.length) return;
    const t = this.waterTiles[Math.floor(this.rng() * this.waterTiles.length)];
    const s = toScreen(t.x + range(this.rng, 0.2, 0.8), t.y + range(this.rng, 0.2, 0.8));
    this.ripples.push({ x: s.x, y: s.y, age, life: 2.6 });
  }

  /** Small dust puff at a screen-space point (used when running). */
  dust(x: number, y: number) {
    for (let i = 0; i < 2; i++) {
      this.particles.push({ x: x + range(this.rng, -4, 4), y: y - 1, vx: range(this.rng, -12, 12), vy: range(this.rng, -14, -4), age: 0, life: 0.45, kind: 'dust' });
    }
  }

  /** Water droplets falling from the can. */
  water(x: number, y: number, dir: number) {
    for (let i = 0; i < 2; i++) {
      this.particles.push({ x, y, vx: dir * range(this.rng, 10, 30), vy: range(this.rng, -10, 10), age: 0, life: 0.45, kind: 'drop' });
    }
  }

  update(dt: number, time: number, reducedMotion: boolean) {
    if (!reducedMotion) {
      for (const t of this.tufts) t.g.skew.x = Math.sin(time * 1.8 + t.phase + t.g.x * 0.01) * 0.18;
    }
    this.rippleTimer -= dt;
    if (this.rippleTimer <= 0) {
      this.spawnRipple();
      this.rippleTimer = 0.7;
    }
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < r.life);

    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'drop' ? 220 : -10) * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);

    // Ripples (ground layer).
    const rg = this.rippleG;
    rg.clear();
    for (const r of this.ripples) {
      const k = r.age / r.life;
      const rad = 3 + k * 16;
      rg.ellipse(r.x, r.y, rad, rad * 0.45).stroke({ width: 1.2, color: C.waterLight, alpha: (1 - k) * 0.8 });
    }

    // Air layer.
    const g = this.airG;
    g.clear();
    const motion = reducedMotion ? 0.35 : 1;
    for (const b of this.butterflies) {
      const t = time * b.speed * motion + b.phase;
      const x = b.cx + Math.sin(t) * b.radius + Math.sin(t * 2.3) * 6;
      const y = b.cy + Math.sin(t * 1.7) * b.radius * 0.35 - Math.abs(Math.sin(t * 3)) * 6;
      const flap = reducedMotion ? 0.8 : 0.35 + Math.abs(Math.sin(time * 14 + b.phase)) * 0.65;
      g.ellipse(x - 2.6 * flap, y, 2.8 * flap, 2.2).fill(b.color);
      g.ellipse(x + 2.6 * flap, y, 2.8 * flap, 2.2).fill(b.color);
      g.ellipse(x, y, 0.7, 2).fill(0x3a2a1a);
    }
    for (const f of this.flies) {
      const t = time * f.speed * motion + f.phase;
      const x = f.cx + Math.sin(t) * f.radius + Math.sin(t * 3.1) * 3;
      const y = f.cy + Math.cos(t * 1.3) * f.radius * 0.5;
      g.circle(x, y, 1.2).fill(0x222222);
      g.ellipse(x - 1, y - 1.2, 1.2, 0.6).fill({ color: 0xffffff, alpha: 0.6 });
    }
    for (const p of this.particles) {
      const k = p.age / p.life;
      if (p.kind === 'dust') g.circle(p.x, p.y, 2 + k * 3).fill({ color: 0xd8c8a8, alpha: (1 - k) * 0.7 });
      else g.ellipse(p.x, p.y, 1.3, 2).fill({ color: C.water, alpha: 1 - k * 0.5 });
    }
  }

  destroy() {
    this.ground.destroy({ children: true });
    this.air.destroy({ children: true });
  }
}
