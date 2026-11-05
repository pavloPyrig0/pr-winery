// List view (L): the same data as plain links, most urgent first.
import type { GardenData, GardenId } from '../types';
import { gardenItems, itemBadge, itemTitle, itemUrl } from '../github/mapping';
import { $, esc } from './dom';
import { itemMeta } from './card';
import { Overlay } from './overlays';
import { AREA_LABEL } from '../world/layout';

export class ListView extends Overlay {
  constructor(onClose: () => void) {
    super('list-view', onClose);
  }

  render(data: GardenData | null, current: GardenId) {
    const body = $('list-body');
    if (!data) {
      body.innerHTML = '<p class="sub">No data yet. Add a GitHub token in settings, or try mock data.</p>';
      return;
    }
    const now = Date.now();
    const order: GardenId[] = current === 'mine' ? ['mine', 'review'] : ['review', 'mine'];
    body.innerHTML = order
      .map((g) => {
        const items = gardenItems(data, g, now);
        const rows = items
          .map((i) => {
            const b = itemBadge(i, g);
            return `<li><span><span class="badge ${b.tone}">${esc(b.label)}</span></span>
              <span><a href="${esc(itemUrl(i))}" target="_blank" rel="noopener noreferrer">${esc(itemTitle(i))}</a>
              <span class="sub">${esc(itemMeta(i, g, now).join(' · '))} · ${esc(i.reason)}</span></span></li>`;
          })
          .join('');
        const title = AREA_LABEL[g];
        return `<section class="list-section" aria-label="${title}"><h3>${title}</h3><ol>${rows || '<li>Nothing here.</li>'}</ol></section>`;
      })
      .join('');
  }
}
