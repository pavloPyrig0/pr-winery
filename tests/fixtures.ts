import type { CellarPr, PullRequest } from '../src/types';

export const NOW = Date.parse('2026-11-05T12:00:00Z');
export const H = 3_600_000;
export const D = 24 * H;

let seq = 0;
export function makePr(p: Partial<PullRequest> = {}): PullRequest {
  seq++;
  return {
    id: `pr-${seq}`,
    title: `PR ${seq}`,
    url: `https://github.com/o/r/pull/${seq}`,
    number: seq,
    repo: 'o/r',
    author: 'me',
    isDraft: false,
    createdAt: new Date(NOW - 2 * D).toISOString(),
    updatedAt: new Date(NOW - D).toISOString(),
    reviewDecision: 'REVIEW_REQUIRED',
    checkState: 'SUCCESS',
    reviewThreads: [],
    ...p,
  };
}

export function makeCellarPr(p: Partial<CellarPr> = {}): CellarPr {
  seq++;
  return {
    id: `cellar-${seq}`,
    title: `Cellar PR ${seq}`,
    url: `https://github.com/o/r/pull/${seq}`,
    number: seq,
    repo: 'o/r',
    author: 'me',
    state: 'MERGED',
    mergedAt: null,
    approvedAt: null,
    ...p,
  };
}
