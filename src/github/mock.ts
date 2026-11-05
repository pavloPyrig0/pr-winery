// Mock data for ?mock=1: covers every bed state in both gardens.
import type { GardenData, PullRequest, ReviewInfo } from '../types';
import { DAY, HOUR } from './mapping';

const ME = 'you';

function pr(n: number, repo: string, title: string, p: Partial<PullRequest> & { ageMs: number }): PullRequest {
  const { ageMs, ...rest } = p;
  return {
    id: `mock-${repo}-${n}`,
    title,
    url: `https://github.com/${repo}/pull/${n}`,
    number: n,
    repo,
    author: ME,
    isDraft: false,
    createdAt: new Date(Date.now() - ageMs).toISOString(),
    updatedAt: new Date(Date.now() - ageMs / 3).toISOString(),
    reviewDecision: 'REVIEW_REQUIRED',
    checkState: 'SUCCESS',
    reviewThreads: [],
    ...rest,
  };
}

function review(requestedAgoMs: number, extra: Partial<ReviewInfo> = {}): ReviewInfo {
  return {
    requestedAt: new Date(Date.now() - requestedAgoMs).toISOString(),
    isRequested: true,
    myLastReviewState: null,
    myLastReviewAt: null,
    newCommitsSinceReview: false,
    ...extra,
  };
}

export function mockData(): GardenData {
  const now = Date.now();
  const mine: PullRequest[] = [
    pr(412, 'acme/web', 'Add dark mode toggle to settings page', { ageMs: 2 * DAY, reviewDecision: 'APPROVED' }),
    pr(415, 'acme/web', 'Fix flaky checkout e2e test', { ageMs: 1 * DAY, checkState: 'FAILURE' }),
    pr(418, 'acme/web', 'WIP: migrate router to v7', { ageMs: 5 * HOUR, isDraft: true, checkState: 'PENDING' }),
    pr(88, 'acme/api', 'Paginate /listings endpoint', {
      ageMs: 3 * DAY,
      reviewThreads: [
        { isResolved: false, lastCommentAuthor: 'maria' },
        { isResolved: false, lastCommentAuthor: 'tom' },
        { isResolved: true, lastCommentAuthor: 'maria' },
      ],
    }),
    pr(91, 'acme/api', 'Bump node to 22 in Dockerfile', { ageMs: 6 * HOUR }),
    pr(23, 'acme/design-tokens', 'Add surface-tint colour token', { ageMs: 4 * DAY, reviewDecision: 'APPROVED' }),
  ];
  const reviewPrs: PullRequest[] = [
    pr(1201, 'acme/mobile', 'Push notification opt-in screen', { ageMs: 6 * HOUR, author: 'lina', review: review(5 * HOUR) }),
    pr(1188, 'acme/mobile', 'Refactor image cache', { ageMs: 3 * DAY, author: 'omar', review: review(2 * DAY) }),
    pr(77, 'acme/infra', 'Terraform: split staging VPC', { ageMs: 9 * DAY, author: 'sam', review: review(5 * DAY) }),
    pr(430, 'acme/web', 'Lazy-load map tiles', {
      ageMs: 4 * DAY,
      author: 'maria',
      review: review(4 * DAY, { myLastReviewState: 'CHANGES_REQUESTED', myLastReviewAt: new Date(now - 2 * DAY).toISOString(), newCommitsSinceReview: true }),
    }),
    pr(95, 'acme/api', 'Rate-limit search endpoint', {
      ageMs: 2 * DAY,
      author: 'tom',
      review: review(2 * DAY, { isRequested: false, myLastReviewState: 'APPROVED', myLastReviewAt: new Date(now - DAY).toISOString() }),
    }),
  ];
  return {
    viewer: ME,
    mine,
    review: reviewPrs,
    weeds: [
      { repo: 'acme/web', name: 'spike/old-carousel', url: 'https://github.com/acme/web/tree/spike/old-carousel', lastCommitAt: new Date(now - 40 * DAY).toISOString() },
      { repo: 'acme/api', name: 'fix/legacy-auth', url: 'https://github.com/acme/api/tree/fix/legacy-auth', lastCommitAt: new Date(now - 21 * DAY).toISOString() },
    ],
    harvestCount: 4,
    harvestUrl: 'https://github.com/pulls?q=is%3Apr+author%3A%40me+is%3Amerged',
    compostCount: 1,
    compostUrl: 'https://github.com/pulls?q=is%3Apr+author%3A%40me+is%3Aclosed+is%3Aunmerged',
    fetchedAt: new Date(now).toISOString(),
    warnings: [],
  };
}
