// Info card: the highlighted bed, or a garden summary when nothing is near.
import type { GardenId, GardenItem } from '../types';
import { formatAge, itemBadge, itemTitle, itemUrl, reviewWaitMs } from '../github/mapping';
import { esc, timeOfDay } from './dom';
import type { StatusKind } from '../github/store';

export function itemMeta(item: GardenItem, garden: GardenId, now: number): string[] {
  if (item.kind === 'bed') {
    const pr = item.pr;
    const age =
      garden === 'review'
        ? `requested ${formatAge(reviewWaitMs(pr, now))} ago`
        : `opened ${formatAge(now - Date.parse(pr.createdAt))} ago`;
    const by = garden === 'review' && pr.author ? [`by ${pr.author}`] : [];
    return [`${pr.repo} #${pr.number}`, ...by, age];
  }
  if (item.kind === 'weed') return [item.branch.repo, `last commit ${formatAge(now - Date.parse(item.branch.lastCommitAt))} ago`];
  return [`${item.count} PR${item.count === 1 ? '' : 's'}`];
}

export function renderItemCard(item: GardenItem, garden: GardenId, now: number): string {
  const badge = itemBadge(item, garden);
  return `
    <span class="badge ${badge.tone}">${esc(badge.label)}</span>
    <div class="title">${esc(itemTitle(item))}</div>
    <div class="meta">${itemMeta(item, garden, now).map((m) => `<span>${esc(m)}</span>`).join('')}</div>
    <p class="reason">${esc(item.reason)}</p>
    <button class="btn primary block" data-tend="${esc(item.id)}">Tend <kbd>E</kbd></button>
    <p class="sub" style="margin:8px 0 0">or <a href="${esc(itemUrl(item))}" target="_blank" rel="noopener noreferrer">open on GitHub</a></p>`;
}

export function renderSummaryCard(opts: {
  garden: GardenId;
  summary: string;
  status: StatusKind;
  fetchedAt: string | null;
  mock: boolean;
}): string {
  const name = opts.garden === 'mine' ? 'My garden' : 'Review garden';
  if (opts.status === 'no-token') {
    return `
      <div class="eyebrow">${name}</div>
      <div class="summary">Plant your first seeds</div>
      <p class="sub">Add a read-only GitHub token and your pull requests will grow here as flower beds.</p>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" data-open-settings>Add token</button>
        <a class="btn" href="?mock=1">Try mock data</a>
      </div>`;
  }
  const updated = opts.mock ? 'Mock data' : opts.fetchedAt ? `Updated ${timeOfDay(opts.fetchedAt)}` : '';
  return `
    <div class="eyebrow">${name}</div>
    <div class="summary">${esc(opts.summary)}</div>
    <p class="sub">Walk up to a bed and press <kbd>E</kbd> to tend it.</p>
    ${updated ? `<p class="sub">${esc(updated)}</p>` : ''}`;
}
