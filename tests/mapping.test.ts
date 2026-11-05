import { describe, expect, it } from 'vitest';
import { gardenHealth, gardenItems, gardenSummary, marker, myPrState, reviewState, toBed } from '../src/github/mapping';
import type { GardenData, ReviewInfo } from '../src/types';
import { D, H, NOW, makePr } from './fixtures';

const review = (agoMs: number, r: Partial<ReviewInfo> = {}): ReviewInfo => ({
  requestedAt: new Date(NOW - agoMs).toISOString(),
  isRequested: true,
  myLastReviewState: null,
  myLastReviewAt: null,
  newCommitsSinceReview: false,
  ...r,
});

describe('myPrState', () => {
  it('draft wins over everything', () => {
    expect(myPrState(makePr({ isDraft: true, checkState: 'FAILURE', reviewDecision: 'APPROVED' }), 'me')).toBe('seedling');
  });
  it('failing CI is bugs (FAILURE and ERROR)', () => {
    expect(myPrState(makePr({ checkState: 'FAILURE' }), 'me')).toBe('bugs');
    expect(myPrState(makePr({ checkState: 'ERROR', reviewDecision: 'APPROVED' }), 'me')).toBe('bugs');
  });
  it('pending CI is not bugs', () => {
    expect(myPrState(makePr({ checkState: 'PENDING' }), 'me')).toBe('growing');
  });
  it('unresolved thread where someone else spoke last is thirsty', () => {
    const pr = makePr({ reviewThreads: [{ isResolved: false, lastCommentAuthor: 'alice' }], reviewDecision: 'APPROVED' });
    expect(myPrState(pr, 'me')).toBe('thirsty');
  });
  it('threads I answered last, or resolved ones, do not make it thirsty', () => {
    const pr = makePr({
      reviewThreads: [
        { isResolved: false, lastCommentAuthor: 'ME' },
        { isResolved: true, lastCommentAuthor: 'alice' },
      ],
    });
    expect(myPrState(pr, 'me')).toBe('growing');
  });
  it('approved is blooming, otherwise growing', () => {
    expect(myPrState(makePr({ reviewDecision: 'APPROVED' }), 'me')).toBe('blooming');
    expect(myPrState(makePr({ reviewDecision: 'CHANGES_REQUESTED' }), 'me')).toBe('growing');
    expect(myPrState(makePr({ reviewDecision: null, checkState: null }), 'me')).toBe('growing');
  });
});

describe('reviewState', () => {
  it('ages fresh → drooping → wilting by time since request', () => {
    expect(reviewState(makePr({ review: review(2 * H) }), NOW)).toBe('growing');
    expect(reviewState(makePr({ review: review(24 * H - 1) }), NOW)).toBe('growing');
    expect(reviewState(makePr({ review: review(24 * H) }), NOW)).toBe('drooping');
    expect(reviewState(makePr({ review: review(3 * D - 1) }), NOW)).toBe('drooping');
    expect(reviewState(makePr({ review: review(3 * D) }), NOW)).toBe('wilting');
  });
  it('falls back to PR creation time when the request event is unknown', () => {
    const pr = makePr({ createdAt: new Date(NOW - 5 * D).toISOString(), review: review(0, { requestedAt: null }) });
    expect(reviewState(pr, NOW)).toBe('wilting');
  });
  it('reviewed before with new commits is thirsty (re-review)', () => {
    const pr = makePr({ review: review(5 * D, { myLastReviewState: 'CHANGES_REQUESTED', newCommitsSinceReview: true }) });
    expect(reviewState(pr, NOW)).toBe('thirsty');
  });
  it('approved by me and no longer requested is blooming', () => {
    const pr = makePr({ review: review(5 * D, { isRequested: false, myLastReviewState: 'APPROVED' }) });
    expect(reviewState(pr, NOW)).toBe('blooming');
  });
  it('reviewed, nothing new, not re-requested → not in the garden', () => {
    const pr = makePr({ review: review(5 * D, { isRequested: false, myLastReviewState: 'COMMENTED' }) });
    expect(reviewState(pr, NOW)).toBeNull();
  });
  it('re-requested after my review uses the new request time', () => {
    const pr = makePr({ review: review(3 * H, { myLastReviewState: 'COMMENTED' }) });
    expect(reviewState(pr, NOW)).toBe('growing');
  });
});

describe('markers, health and summary', () => {
  it('maps states to markers', () => {
    expect(marker('wilting')).toBe('alert-red');
    expect(marker('drooping')).toBe('alert-amber');
    expect(marker('thirsty')).toBe('drop');
    expect(marker('bugs')).toBe('bug');
    expect(marker('blooming')).toBeNull();
  });

  const data: GardenData = {
    viewer: 'me',
    mine: [makePr({ reviewDecision: 'APPROVED' }), makePr({ checkState: 'FAILURE' })],
    review: [makePr({ review: review(4 * D) }), makePr({ review: review(5 * D) }), makePr({ review: review(H) })],
    weeds: [{ repo: 'o/r', name: 'old', url: 'u', lastCommitAt: new Date(NOW - 20 * D).toISOString() }],
    harvestCount: 2,
    harvestUrl: 'h',
    compostCount: 0,
    compostUrl: 'c',
    fetchedAt: new Date(NOW).toISOString(),
    warnings: [],
  };

  it('my garden includes beds, weeds, basket and compost, most urgent first', () => {
    const items = gardenItems(data, 'mine', NOW);
    expect(items.map((i) => i.kind)).toEqual(['bed', 'weed', 'bed', 'basket', 'compost']);
  });
  it('review garden has only beds', () => {
    const items = gardenItems(data, 'review', NOW);
    expect(items.every((i) => i.kind === 'bed')).toBe(true);
    expect(gardenSummary(items, 'review')).toBe('2 beds are wilting · tend the oldest first');
  });
  it('orders equal states oldest first', () => {
    const items = gardenItems(data, 'review', NOW);
    const a = toBed(data.review[1], 'review', 'me', NOW)!;
    expect(items[0].id).toBe(a.id);
  });
  it('health is 1 for an empty or healthy garden and drops with neglect', () => {
    expect(gardenHealth([])).toBe(1);
    const healthy = gardenItems({ ...data, review: [makePr({ review: review(H) })] }, 'review', NOW);
    expect(gardenHealth(healthy)).toBe(1);
    expect(gardenHealth(gardenItems(data, 'review', NOW))).toBeCloseTo(1 / 3);
  });
});
