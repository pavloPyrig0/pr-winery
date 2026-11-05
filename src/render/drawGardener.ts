// The gardener: dark green hoodie, watering can, 4-frame walk cycle with
// front and back variants (flipped horizontally for left-facing).
import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { C } from './palette';

export type Facing = 'front' | 'back';

/** Local position of the can's spout tip in the watering pose (unflipped). */
export const SPOUT_TIP = { x: 23, y: -12 };

function buildFrame(facing: Facing, frame: number, watering: boolean): GraphicsContext {
  const g = new GraphicsContext();
  // Stride: frames 1 and 3 are the extended poses.
  const stride = frame === 1 ? 3 : frame === 3 ? -3 : 0;
  const bob = frame === 1 || frame === 3 ? -1 : 0;

  g.ellipse(0, 0, 11, 4).fill({ color: C.shadow, alpha: 0.25 });

  // Legs (back leg first).
  const leg = (x: number, lift: number, shade: number) => {
    g.roundRect(x - 2.2, -12 + bob, 4.4, 12 - lift, 2).fill(shade);
    g.ellipse(x + 0.8, -lift, 3.4, 1.9).fill(0x2a2420);
  };
  leg(-2.5 - stride, stride > 0 ? 1.5 : 0, 0x30343d);
  leg(2.5 + stride, stride < 0 ? 1.5 : 0, C.pants);

  // Back arm (swings opposite to the near leg).
  const armSwing = watering ? 0 : -stride * 0.9;
  g.roundRect(-9 + armSwing, -24 + bob, 4.5, 12, 2.2).fill(C.hoodieDark);

  // Hood behind the head for the front view.
  if (facing === 'front') g.circle(0, -31 + bob, 9.5).fill(C.hoodieDark);

  // Body.
  g.roundRect(-8, -27 + bob, 16, 17, 6).fill(C.hoodie);
  g.roundRect(-8, -13 + bob, 16, 3, 1.5).fill(C.hoodieDark);
  if (facing === 'front') {
    g.roundRect(-4.5, -19 + bob, 9, 5, 2).fill(C.hoodieLight); // pocket
    g.moveTo(-1.5, -26 + bob).lineTo(-1.8, -21 + bob).stroke({ width: 0.8, color: 0xe4e8da });
    g.moveTo(1.5, -26 + bob).lineTo(1.8, -21 + bob).stroke({ width: 0.8, color: 0xe4e8da });
  } else {
    g.roundRect(-6, -26 + bob, 12, 4, 2).fill(C.hoodieLight); // hood fold
  }

  // Head.
  const hy = -32 + bob;
  if (facing === 'front') {
    g.circle(0.5, hy, 7.2).fill(C.skin);
    g.moveTo(-7, hy - 1).quadraticCurveTo(0, hy - 11, 7.5, hy - 2).lineTo(7.5, hy - 4).quadraticCurveTo(1, hy - 6, -7, hy - 1).fill(C.hair);
    g.circle(2.2, hy + 0.5, 0.95).fill(0x2a1d14);
    g.circle(5.2, hy + 0.5, 0.95).fill(0x2a1d14);
    g.circle(1, hy + 3, 1.4).fill({ color: 0xe88f7a, alpha: 0.45 });
    g.circle(6.4, hy + 3, 1.2).fill({ color: 0xe88f7a, alpha: 0.45 });
    g.moveTo(3, hy + 3.6).quadraticCurveTo(4, hy + 4.5, 5, hy + 3.6).stroke({ width: 0.7, color: 0x8a4a3a });
  } else {
    g.circle(0, hy, 7.2).fill(C.hair);
    g.circle(0, hy + 3, 8.4).fill(C.hoodie); // hood up over the back of the head
    g.circle(0, hy + 3, 8.4).stroke({ width: 1, color: C.hoodieDark });
  }

  // Near arm + watering can.
  if (watering) {
    g.roundRect(5, -25 + bob, 10, 4.5, 2.2).fill(C.hoodie);
    // Tilted can.
    g.poly([10, -26, 22, -22, 20, -12, 9, -16]).fill(C.can);
    g.poly([10, -26, 22, -22, 21, -18, 10, -22]).fill({ color: 0xffffff, alpha: 0.25 });
    g.moveTo(21, -16).lineTo(SPOUT_TIP.x + 2, SPOUT_TIP.y + 2).stroke({ width: 2.4, color: C.canDark, cap: 'round' });
    g.circle(SPOUT_TIP.x + 2, SPOUT_TIP.y + 2, 2).fill(C.canDark);
  } else {
    g.roundRect(5 + stride * 0.9, -24 + bob, 4.5, 12, 2.2).fill(C.hoodie);
    const cx = 9 + stride * 0.9;
    const cy = -15 + bob;
    g.moveTo(cx + 1, cy - 2).quadraticCurveTo(cx + 5, cy - 9, cx + 9, cy - 2).stroke({ width: 1.6, color: C.canDark });
    g.roundRect(cx, cy - 1, 10, 9, 2).fill(C.can);
    g.roundRect(cx, cy - 1, 4, 9, 2).fill({ color: 0xffffff, alpha: 0.2 });
    g.moveTo(cx + 10, cy + 5).lineTo(cx + 16, cy - 2).stroke({ width: 2, color: C.canDark, cap: 'round' });
    g.circle(cx + 16, cy - 2, 1.6).fill(C.canDark);
  }
  return g;
}

export interface GardenerArt {
  view: Container;
  setPose(facing: Facing, frame: number, watering: boolean, faceLeft: boolean): void;
}

export function createGardener(): GardenerArt {
  const frames = new Map<string, GraphicsContext>();
  for (const f of ['front', 'back'] as Facing[]) {
    for (let i = 0; i < 4; i++) frames.set(`${f}:${i}:0`, buildFrame(f, i, false));
    frames.set(`${f}:0:1`, buildFrame(f, 0, true));
    frames.set(`${f}:2:1`, buildFrame(f, 2, true));
  }
  const view = new Container();
  const body = new Graphics(frames.get('front:0:0')!);
  view.addChild(body);
  let current = 'front:0:0';
  return {
    view,
    setPose(facing, frame, watering, faceLeft) {
      const key = watering ? `${facing}:${frame % 4 < 2 ? 0 : 2}:1` : `${facing}:${frame % 4}:0`;
      if (key !== current) {
        body.context = frames.get(key)!;
        current = key;
      }
      body.scale.x = faceLeft ? -1 : 1;
    },
  };
}
