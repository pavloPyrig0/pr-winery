// Overlay HUD: garden name, season, health, tabs, status banner, tooltip.
import type { GardenId, GardenItem, Season } from '../types';
import { itemBadge, itemTitle } from '../github/mapping';
import type { Status } from '../github/store';
import { $, esc, timeOfDay } from './dom';

const SEASON_LABEL: Record<Season, string> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

export interface HudHandlers {
  onTab(g: GardenId): void;
  onRefresh(): void;
  onList(): void;
  onHelp(): void;
  onSettings(): void;
}

export class Hud {
  private tooltip = $('tooltip');

  constructor(h: HudHandlers) {
    for (const id of ['tab-mine', 'tab-review']) {
      $(id).addEventListener('click', (e) => h.onTab((e.currentTarget as HTMLElement).dataset.garden as GardenId));
    }
    $('btn-refresh').addEventListener('click', h.onRefresh);
    $('btn-list').addEventListener('click', h.onList);
    $('btn-help').addEventListener('click', h.onHelp);
    $('btn-settings').addEventListener('click', h.onSettings);
    $('status').addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-open-settings]')) h.onSettings();
    });
  }

  render(s: { garden: GardenId; season: Season; health: number; counts: Record<GardenId, number>; status: Status; mock: boolean }) {
    $('garden-name').textContent = s.garden === 'mine' ? 'My garden' : 'Review garden';
    $('season-label').textContent = SEASON_LABEL[s.season];
    const pct = Math.round(s.health * 100);
    const fill = $('health-fill');
    fill.style.width = `${pct}%`;
    fill.style.backgroundColor = pct >= 70 ? '#013A14' : pct >= 40 ? '#D6A520' : '#BB4E4E';
    $('health').setAttribute('aria-valuenow', String(pct));
    $('health-label').textContent = `${pct}% healthy`;
    for (const g of ['mine', 'review'] as GardenId[]) {
      const tab = $(`tab-${g}`);
      tab.setAttribute('aria-selected', String(g === s.garden));
      $(`count-${g}`).textContent = String(s.counts[g]);
    }
    $('btn-refresh').classList.toggle('spin', s.status.kind === 'loading');

    const el = $('status');
    const st = s.status;
    let html = '';
    let tone = '';
    if (st.kind === 'auth') {
      tone = 'red';
      html = `${esc(st.message)} <button data-open-settings>Settings</button>`;
    } else if (st.kind === 'rate') {
      tone = 'amber';
      html = esc(st.message) + (st.resetAt ? ` · resets at ${timeOfDay(st.resetAt)}` : '');
    } else if (st.kind === 'offline' || st.kind === 'error') {
      tone = 'amber';
      html = esc(st.message);
    } else if (st.kind === 'ok' && st.message !== 'Up to date' && !s.mock) {
      tone = 'blue';
      html = esc(st.message);
    }
    el.hidden = !html;
    el.className = `status${tone ? ` tone-${tone}` : ''}`;
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  showTooltip(item: GardenItem | null, garden: GardenId, x: number, y: number) {
    const t = this.tooltip;
    if (!item) {
      t.hidden = true;
      return;
    }
    const b = itemBadge(item, garden);
    t.innerHTML = `<span class="badge ${b.tone}">${esc(b.label)}</span><div class="t-title">${esc(itemTitle(item))}</div><div class="t-sub">${esc(item.kind === 'bed' ? `${item.pr.repo} #${item.pr.number}` : item.reason)}</div>`;
    t.hidden = false;
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    t.style.left = `${Math.min(window.innerWidth - w - 8, x + 14)}px`;
    t.style.top = `${Math.min(window.innerHeight - h - 8, y + 14)}px`;
  }
}
