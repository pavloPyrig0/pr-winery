// Right-side panel: info card and the "Needs care" list.
import type { GardenId, GardenItem } from '../types';
import { itemBadge, itemNeedsCare, itemTitle } from '../github/mapping';
import type { StatusKind } from '../github/store';
import { $, esc } from './dom';
import { renderItemCard, renderSummaryCard } from './card';

export interface PanelState {
  garden: GardenId;
  items: GardenItem[];
  highlighted: GardenItem | null;
  summary: string;
  status: StatusKind;
  fetchedAt: string | null;
  mock: boolean;
  now: number;
}

export interface PanelHandlers {
  onTend(id: string): void;
  onWalkTo(id: string): void;
  onOpenSettings(): void;
  onToggle(): void;
}

export class Panel {
  private card = $('card');
  private list = $('care-list');
  private toggle = $('panel-toggle');
  private lastCard = '';
  private lastList = '';

  constructor(h: PanelHandlers) {
    this.card.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const tend = t.closest<HTMLElement>('[data-tend]');
      if (tend) h.onTend(tend.dataset.tend!);
      if (t.closest('[data-open-settings]')) h.onOpenSettings();
    });
    this.list.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-walk]');
      if (row) h.onWalkTo(row.dataset.walk!);
    });
    this.toggle.addEventListener('click', () => h.onToggle());
  }

  setCollapsed(collapsed: boolean) {
    document.body.classList.toggle('panel-collapsed', collapsed);
    this.toggle.setAttribute('aria-expanded', String(!collapsed));
    $('panel-body').inert = collapsed;
  }

  render(s: PanelState) {
    const cardHtml = s.highlighted
      ? renderItemCard(s.highlighted, s.garden, s.now)
      : renderSummaryCard({ garden: s.garden, summary: s.summary, status: s.status, fetchedAt: s.fetchedAt, mock: s.mock });
    if (cardHtml !== this.lastCard) {
      this.card.innerHTML = cardHtml;
      this.lastCard = cardHtml;
    }

    const care = s.items.filter(itemNeedsCare);
    const listHtml = care.length
      ? care
          .map((i) => {
            const b = itemBadge(i, s.garden);
            const sub = i.kind === 'bed' ? `${i.pr.repo} · ${i.reason}` : i.reason;
            const current = s.highlighted?.id === i.id ? ' current' : '';
            return `<li><button class="${current.trim()}" data-walk="${esc(i.id)}" aria-label="Walk to ${esc(itemTitle(i))}: ${esc(b.label)}">
              <span class="dot ${b.tone}" aria-hidden="true"></span>
              <span class="row-title">${esc(itemTitle(i))}</span>
              <span class="row-sub">${esc(sub)}</span></button></li>`;
          })
          .join('')
      : `<li class="care-empty">Nothing needs care right now.</li>`;
    if (listHtml !== this.lastList) {
      this.list.innerHTML = listHtml;
      this.lastList = listHtml;
    }
  }
}
