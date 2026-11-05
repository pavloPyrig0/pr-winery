// Right-side panel: info card and the "Needs care" list.
import type { GardenId, GardenItem } from '../types';
import { itemBadge, itemNeedsCare, itemTitle } from '../github/mapping';
import { AREA_LABEL } from '../world/layout';
import type { StatusKind } from '../github/store';
import { $, esc } from './dom';
import { renderItemCard, renderSummaryCard } from './card';

export interface Entry {
  item: GardenItem;
  garden: GardenId;
}

export interface PanelState {
  /** Area the gardener is in, or null on the shared path. */
  area: GardenId | null;
  /** Items from both areas, most urgent first. */
  entries: Entry[];
  highlighted: Entry | null;
  summaries: { label: string | null; text: string }[];
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
      ? renderItemCard(s.highlighted.item, s.highlighted.garden, s.now)
      : renderSummaryCard({
          title: s.area ? AREA_LABEL[s.area] : 'PR Garden',
          summaries: s.summaries,
          status: s.status,
          fetchedAt: s.fetchedAt,
          mock: s.mock,
        });
    if (cardHtml !== this.lastCard) {
      this.card.innerHTML = cardHtml;
      this.lastCard = cardHtml;
    }

    const care = s.entries.filter((e) => itemNeedsCare(e.item));
    const listHtml = care.length
      ? care
          .map(({ item: i, garden }) => {
            const b = itemBadge(i, garden);
            const where = i.kind === 'bed' ? `${i.pr.repo} · ${i.reason}` : i.reason;
            const current = s.highlighted?.item.id === i.id ? 'current' : '';
            return `<li><button class="${current}" data-walk="${esc(i.id)}" aria-label="Walk to ${esc(itemTitle(i))} in ${AREA_LABEL[garden]}: ${esc(b.label)}">
              <span class="dot ${b.tone}" aria-hidden="true"></span>
              <span class="row-title">${esc(itemTitle(i))}</span>
              <span class="row-sub"><span class="area-tag">${AREA_LABEL[garden]}</span> ${esc(where)}</span></button></li>`;
          })
          .join('')
      : `<li class="care-empty">Nothing needs care right now.</li>`;
    if (listHtml !== this.lastList) {
      this.list.innerHTML = listHtml;
      this.lastList = listHtml;
    }
  }
}
