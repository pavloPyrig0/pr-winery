import { describe, expect, it } from 'vitest';
import { toBed } from '../src/github/mapping';
import type { BedItem, GardenItem, WeedItem } from '../src/types';
import { BASE_TEMPLATE, buildTemplate } from '../src/world/template';
import { BASE_SLOTS, findSlots, isTileBlocked, layoutGarden, nearestInteractable, orderBeds } from '../src/world/layout';
import { D, NOW, makePr } from './fixtures';

const bed = (p: Parameters<typeof makePr>[0]): BedItem => toBed(makePr(p), 'mine', 'me', NOW)!;

describe('template', () => {
  it('is a 14×14 grid', () => {
    expect(BASE_TEMPLATE).toHaveLength(14);
    for (const row of BASE_TEMPLATE) expect(row).toHaveLength(14);
  });
  it('has the expected number of 2×2 bed slots', () => {
    expect(findSlots([...BASE_TEMPLATE])).toHaveLength(BASE_SLOTS);
  });
  it('extension blocks add 4 slots each and keep the width', () => {
    const rows = buildTemplate(2);
    expect(rows).toHaveLength(14 + 6);
    expect(rows.every((r) => r.length === 14)).toBe(true);
    expect(findSlots(rows)).toHaveLength(BASE_SLOTS + 8);
  });
});

describe('layoutGarden', () => {
  const items: GardenItem[] = [
    bed({ repo: 'a/one', reviewDecision: 'APPROVED' }),
    bed({ repo: 'b/two', checkState: 'FAILURE' }),
    bed({ repo: 'a/one' }),
    bed({ repo: 'b/two' }),
    bed({ repo: 'c/three', isDraft: true }),
  ];

  it('is deterministic for the same data, regardless of input order', () => {
    const a = layoutGarden(items, 'mine');
    const b = layoutGarden([...items].reverse(), 'mine');
    const pos = (w: ReturnType<typeof layoutGarden>) => w.placed.map((p) => `${p.item.id}@${p.x},${p.y}`).sort();
    expect(pos(a)).toEqual(pos(b));
  });

  it('groups beds by repository and puts the most urgent repo first', () => {
    const order = orderBeds(items.filter((i): i is BedItem => i.kind === 'bed'));
    expect(order.map((b) => b.pr.repo)).toEqual(['b/two', 'b/two', 'a/one', 'a/one', 'c/three']);
    expect(order[0].state).toBe('bugs');
  });

  it('puts the most urgent bed nearest the entry arch', () => {
    const w = layoutGarden(items, 'mine');
    const entry = { x: w.areas[0].arch.x1, y: w.height };
    const dist = (id: string) => {
      const p = w.placed.find((pl) => pl.item.id === id)!;
      return Math.abs(p.x + 1 - entry.x) + Math.abs(p.y + 1 - entry.y);
    };
    const bugs = items.find((i) => i.kind === 'bed' && i.state === 'bugs')!;
    const others = items.filter((i) => i !== bugs).map((i) => dist(i.id));
    expect(dist(bugs.id)).toBeLessThanOrEqual(Math.min(...others));
  });

  it('beds block movement, unused slots become walkable grass', () => {
    const w = layoutGarden(items, 'mine');
    for (const p of w.placed) expect(isTileBlocked(w, p.x, p.y)).toBe(true);
    const occupied = new Set(w.placed.map((p) => `${p.x},${p.y}`));
    const free = findSlots([...BASE_TEMPLATE]).find((s) => !occupied.has(`${s.x},${s.y}`))!;
    expect(w.tiles[free.y * w.width + free.x]).toBe('grass');
    expect(isTileBlocked(w, free.x, free.y)).toBe(false);
  });

  it('extends the map when there are more beds than slots', () => {
    const many: GardenItem[] = Array.from({ length: 20 }, (_, i) => bed({ repo: `r/${i % 3}` }));
    const w = layoutGarden(many, 'mine');
    expect(w.height).toBe(14 + 6);
    expect(w.placed.filter((p) => p.item.kind === 'bed')).toHaveLength(20);
    const keys = w.placed.map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Spawn and arch stay on the bottom edge.
    expect(w.areas[0].arch.y).toBe(w.height - 1);
  });

  it('places weeds on grass without blocking, basket and compost near the arch', () => {
    const weed: WeedItem = {
      kind: 'weed',
      id: 'weed:o/r:old',
      branch: { repo: 'o/r', name: 'old', url: 'u', lastCommitAt: new Date(NOW - 30 * D).toISOString() },
      urgency: 3000,
      reason: '',
    };
    const w = layoutGarden(
      [...items, weed, { kind: 'basket', id: 'basket', url: 'h', count: 1, urgency: 0, reason: '' }, { kind: 'compost', id: 'compost', url: 'c', count: 0, urgency: 0, reason: '' }],
      'mine',
    );
    const pw = w.placed.find((p) => p.item.kind === 'weed')!;
    expect(w.tiles[pw.y * w.width + pw.x]).toBe('grass');
    expect(isTileBlocked(w, pw.x, pw.y)).toBe(false);
    for (const kind of ['basket', 'compost']) {
      const p = w.placed.find((pl) => pl.item.kind === kind)!;
      expect(Math.abs(p.y - w.areas[0].arch.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.x - w.areas[0].arch.x0)).toBeLessThanOrEqual(2);
    }
  });

  it('review garden turns unused basket/compost spots into grass', () => {
    const w = layoutGarden(items, 'review');
    expect(w.tiles.includes('basket')).toBe(false);
    expect(w.tiles.includes('compost')).toBe(false);
  });
});

describe('nearestInteractable', () => {
  const items: GardenItem[] = [bed({ repo: 'a/one' })];
  const w = layoutGarden(items, 'mine');
  const p = w.placed[0];

  it('finds a bed within 1.2 tiles in front of the gardener', () => {
    // Stand just right of the bed, facing it (towards -x).
    const hit = nearestInteractable(w, p.x + 2.6, p.y + 1, { x: -1, y: 0 });
    expect(hit?.item.id).toBe(p.item.id);
  });
  it('ignores beds behind the gardener and out of range', () => {
    expect(nearestInteractable(w, p.x + 2.8, p.y + 1, { x: 1, y: 0 })).toBeNull();
    expect(nearestInteractable(w, p.x + 3.5, p.y + 1, { x: -1, y: 0 })).toBeNull();
  });
});
