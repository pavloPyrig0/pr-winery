// Pure functions that turn GitHub facts into vineyard states. No I/O here.
import type {
  BadgeTone,
  BedItem,
  CellarItem,
  CellarPr,
  CompostItem,
  BedState,
  GardenData,
  GardenId,
  GardenItem,
  MarkerKind,
  PullRequest,
  StaleBranch,
  WeedItem,
} from '../types';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** State for one of my own PRs, checked in priority order. */
export function myPrState(pr: PullRequest, viewer: string): BedState {
  if (pr.isDraft) return 'seedling';
  if (pr.checkState === 'FAILURE' || pr.checkState === 'ERROR') return 'bugs';
  if (hasUnansweredThreads(pr, viewer)) return 'thirsty';
  if (pr.reviewDecision === 'APPROVED') return 'blooming';
  return 'growing';
}

/** Unresolved threads where someone other than me spoke last. */
export function hasUnansweredThreads(pr: PullRequest, viewer: string): boolean {
  const me = viewer.toLowerCase();
  return pr.reviewThreads.some(
    (t) => !t.isResolved && (t.lastCommentAuthor ?? '').toLowerCase() !== me,
  );
}

export function unansweredThreadCount(pr: PullRequest, viewer: string): number {
  const me = viewer.toLowerCase();
  return pr.reviewThreads.filter(
    (t) => !t.isResolved && (t.lastCommentAuthor ?? '').toLowerCase() !== me,
  ).length;
}

/** Time my review has been waiting (falls back to PR creation). */
export function reviewWaitMs(pr: PullRequest, now: number): number {
  const since = pr.review?.requestedAt ?? pr.createdAt;
  return Math.max(0, now - Date.parse(since));
}

/**
 * State for a PR in the review vineyard, or null when the ball is in the
 * author's court (I reviewed, nothing new, and I'm not re-requested). PRs I
 * approved come back as bottles instead (see `toBottle`).
 */
export function reviewState(pr: PullRequest, now: number): BedState | null {
  const r = pr.review;
  const reviewedBefore = !!r?.myLastReviewState && r.myLastReviewState !== 'PENDING';
  if (reviewedBefore && r!.newCommitsSinceReview) return 'thirsty';
  // Approved by me: it's bottled and lives in the cellar, not on the vine.
  if (r && !r.isRequested) return null;
  const wait = reviewWaitMs(pr, now);
  if (wait < DAY) return 'growing';
  if (wait < 3 * DAY) return 'drooping';
  return 'wilting';
}

const STATE_RANK: Record<BedState, number> = {
  wilting: 7,
  bugs: 6,
  thirsty: 5,
  drooping: 4,
  growing: 2,
  seedling: 1,
  blooming: 0,
};

/** Discrete urgency rank: stable between refreshes, used for layout. */
export function stateRank(state: BedState): number {
  return STATE_RANK[state];
}

export function needsCare(state: BedState): boolean {
  return STATE_RANK[state] >= 4;
}

export function marker(state: BedState): MarkerKind {
  switch (state) {
    case 'wilting':
      return 'alert-red';
    case 'drooping':
      return 'alert-amber';
    case 'thirsty':
      return 'drop';
    case 'bugs':
      return 'bug';
    default:
      return null;
  }
}

export function badgeTone(state: BedState): BadgeTone {
  switch (state) {
    case 'wilting':
    case 'bugs':
      return 'red';
    case 'drooping':
      return 'amber';
    case 'thirsty':
      return 'blue';
    case 'seedling':
      return 'grey';
    default:
      return 'green';
  }
}

export function stateLabel(state: BedState, garden: GardenId): string {
  switch (state) {
    case 'seedling':
      return 'Budbreak · draft';
    case 'bugs':
      return 'Pests · CI failing';
    case 'thirsty':
      return garden === 'mine' ? 'Thirsty · comments to answer' : 'Thirsty · re-review';
    case 'blooming':
      return garden === 'mine' ? 'Ripe · approved' : 'Ripe · you approved';
    case 'growing':
      return garden === 'mine' ? 'Ripening · in review' : 'Fresh · new request';
    case 'drooping':
      return 'Drooping · waiting 1–3 days';
    case 'wilting':
      return 'Shrivelling · waiting 3+ days';
  }
}

export function formatAge(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day' : `${d} days`;
}

function reasonFor(pr: PullRequest, state: BedState, garden: GardenId, viewer: string, now: number): string {
  if (garden === 'review') {
    if (state === 'thirsty') return 'New commits since your last review';
    if (state === 'blooming') return 'You approved · waiting for the author to merge';
    return `Review requested ${formatAge(reviewWaitMs(pr, now))} ago`;
  }
  switch (state) {
    case 'seedling':
      return 'Draft · not ready for review yet';
    case 'bugs':
      return 'CI checks are failing';
    case 'thirsty': {
      const n = unansweredThreadCount(pr, viewer);
      return `${n} unresolved thread${n === 1 ? '' : 's'} waiting on you`;
    }
    case 'blooming':
      return 'Approved · ready to merge and barrel';
    default:
      return `Open for ${formatAge(now - Date.parse(pr.createdAt))}`;
  }
}

export function toBed(pr: PullRequest, garden: GardenId, viewer: string, now: number): BedItem | null {
  const state = garden === 'mine' ? myPrState(pr, viewer) : reviewState(pr, now);
  if (!state) return null;
  // Rank dominates; older beds come first within a rank.
  const ageDays = (now - Date.parse(garden === 'review' ? pr.review?.requestedAt ?? pr.createdAt : pr.createdAt)) / DAY;
  return {
    kind: 'bed',
    id: pr.id,
    pr,
    state,
    urgency: stateRank(state) * 1000 + Math.min(999, Math.max(0, ageDays)),
    reason: reasonFor(pr, state, garden, viewer, now),
  };
}

export function toWeed(b: StaleBranch, now: number): WeedItem {
  const days = (now - Date.parse(b.lastCommitAt)) / DAY;
  return {
    kind: 'weed',
    id: `weed:${b.repo}:${b.name}`,
    branch: b,
    urgency: 3000 + Math.min(999, days),
    reason: `Stale branch · no push for ${formatAge(now - Date.parse(b.lastCommitAt))}`,
  };
}

function byNewest(a: string | null, b: string | null): number {
  return Date.parse(b ?? '1970-01-01') - Date.parse(a ?? '1970-01-01');
}

export function toBarrel(pr: CellarPr, now: number): CellarItem {
  return {
    kind: 'barrel',
    id: `barrel:${pr.id}`,
    pr,
    urgency: 0,
    reason: pr.mergedAt ? `Merged ${formatAge(now - Date.parse(pr.mergedAt))} ago · ageing in the cellar` : 'Merged',
  };
}

export function toBottle(pr: CellarPr, now: number): CellarItem {
  const when = pr.approvedAt ? `Approved ${formatAge(now - Date.parse(pr.approvedAt))} ago` : 'Approved by you';
  const tail = pr.state === 'MERGED' ? 'merged and sealed' : pr.state === 'CLOSED' ? 'closed unmerged' : 'waiting for the author to merge';
  return { kind: 'bottle', id: `bottle:${pr.id}`, pr, urgency: 0, reason: `${when} · ${tail}` };
}

/** Barrels or bottles, newest first (stable for layout). */
export function cellarItems(prs: CellarPr[], kind: 'barrel' | 'bottle', now: number): CellarItem[] {
  const key = (p: CellarPr) => (kind === 'barrel' ? p.mergedAt : p.approvedAt);
  return [...prs]
    .sort((a, b) => byNewest(key(a), key(b)) || a.id.localeCompare(b.id))
    .map((p) => (kind === 'barrel' ? toBarrel(p, now) : toBottle(p, now)));
}

/** All interactable items for a garden, most urgent first. */
export function gardenItems(data: GardenData, garden: GardenId, now: number): GardenItem[] {
  const prs = garden === 'mine' ? data.mine : data.review;
  const items: GardenItem[] = [];
  for (const pr of prs) {
    const bed = toBed(pr, garden, data.viewer, now);
    if (bed) items.push(bed);
  }
  if (garden === 'mine') {
    for (const w of data.weeds) items.push(toWeed(w, now));
    items.push(...cellarItems(data.barrels ?? [], 'barrel', now));
    const compost: CompostItem = {
      kind: 'compost',
      id: 'compost',
      url: data.compostUrl,
      count: data.compostCount,
      urgency: 0,
      reason: `${data.compostCount} closed without merging (30 days)`,
    };
    items.push(compost);
  } else {
    items.push(...cellarItems(data.bottles ?? [], 'bottle', now));
  }
  return sortByUrgency(items);
}

export function sortByUrgency<T extends { urgency: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.urgency - a.urgency || a.id.localeCompare(b.id));
}

export function itemUrl(item: GardenItem): string {
  if (item.kind === 'bed') return item.pr.url;
  if (item.kind === 'weed') return item.branch.url;
  if (item.kind === 'compost') return item.url;
  return item.pr.url;
}

export function itemTitle(item: GardenItem): string {
  if (item.kind === 'bed') return item.pr.title;
  if (item.kind === 'weed') return item.branch.name;
  if (item.kind === 'compost') return 'Pomace heap';
  return item.pr.title;
}

export function itemBadge(item: GardenItem, garden: GardenId): { tone: BadgeTone; label: string } {
  if (item.kind === 'bed') return { tone: badgeTone(item.state), label: stateLabel(item.state, garden) };
  if (item.kind === 'weed') return { tone: 'amber', label: 'Weed · stale branch' };
  if (item.kind === 'barrel') return { tone: 'green', label: 'Barrel · merged' };
  if (item.kind === 'bottle') {
    return item.pr.state === 'OPEN' ? { tone: 'blue', label: 'Bottle · you approved' } : { tone: 'green', label: 'Bottle · approved, sealed' };
  }
  return { tone: 'grey', label: 'Pomace · closed' };
}

export function itemNeedsCare(item: GardenItem): boolean {
  if (item.kind === 'bed') return needsCare(item.state);
  return item.kind === 'weed';
}

/** 0..1, where 1 is a perfectly tended garden. */
export function gardenHealth(items: GardenItem[]): number {
  const scored = items.filter((i) => i.kind === 'bed' || i.kind === 'weed');
  if (scored.length === 0) return 1;
  const penalty: Record<BedState, number> = {
    wilting: 1,
    bugs: 0.9,
    drooping: 0.6,
    thirsty: 0.5,
    seedling: 0.1,
    growing: 0,
    blooming: 0,
  };
  let total = 0;
  for (const i of scored) total += i.kind === 'bed' ? penalty[i.state] : 0.3;
  return Math.max(0, 1 - total / scored.length);
}

/** One-line advice shown when nothing is highlighted. */
export function gardenSummary(items: GardenItem[], garden: GardenId): string {
  const beds = items.filter((i): i is BedItem => i.kind === 'bed');
  if (beds.length === 0) {
    return garden === 'mine' ? 'No open PRs · the vines are resting' : 'No reviews waiting · pour yourself a glass';
  }
  const count = (s: BedState) => beds.filter((b) => b.state === s).length;
  const plural = (n: number, w: string) => `${n} vine${n === 1 ? ' is' : 's are'} ${w}`;
  if (count('wilting')) return `${plural(count('wilting'), 'shrivelling')} · tend the oldest first`;
  if (count('bugs')) return `${plural(count('bugs'), 'pest-ridden')} · fix the failing checks`;
  if (count('thirsty'))
    return garden === 'mine'
      ? `${plural(count('thirsty'), 'thirsty')} · answer open threads`
      : `${plural(count('thirsty'), 'thirsty')} · new commits to re-review`;
  if (count('drooping')) return `${plural(count('drooping'), 'drooping')} · review them today`;
  const weeds = items.filter((i) => i.kind === 'weed').length;
  if (weeds) return `${weeds} weed${weeds === 1 ? '' : 's'} · clean up stale branches`;
  return `All ${beds.length} vine${beds.length === 1 ? '' : 's'} look healthy`;
}
