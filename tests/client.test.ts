import { describe, expect, it } from 'vitest';
import { fetchGarden, GitHubError, graphql, normalizePr, staleBranches } from '../src/github/client';
import { weedsQuery, weedsVariables } from '../src/github/queries';
import { D, NOW } from './fixtures';

const rawPr = (over: Record<string, unknown> = {}) => ({
  id: 'PR_1',
  title: 'T',
  url: 'https://github.com/o/r/pull/1',
  number: 1,
  isDraft: false,
  createdAt: new Date(NOW - 5 * D).toISOString(),
  updatedAt: new Date(NOW - D).toISOString(),
  reviewDecision: null,
  author: { login: 'bob' },
  repository: { nameWithOwner: 'o/r' },
  commits: { nodes: [{ commit: { committedDate: new Date(NOW - D).toISOString(), statusCheckRollup: { state: 'FAILURE' } } }] },
  reviewThreads: { nodes: [{ isResolved: false, comments: { nodes: [{ author: { login: 'alice' } }] } }] },
  ...over,
});

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status, headers })) as typeof fetch;
}

describe('normalizePr', () => {
  it('maps the fields we need', () => {
    const pr = normalizePr(rawPr() as never, 'me', null);
    expect(pr.repo).toBe('o/r');
    expect(pr.checkState).toBe('FAILURE');
    expect(pr.reviewThreads).toEqual([{ isResolved: false, lastCommentAuthor: 'alice' }]);
    expect(pr.review).toBeUndefined();
  });
  it('derives review facts: my request time and commits after my review', () => {
    const pr = normalizePr(
      rawPr({
        viewerLatestReview: { state: 'CHANGES_REQUESTED', submittedAt: new Date(NOW - 2 * D).toISOString() },
        timelineItems: {
          nodes: [
            { createdAt: new Date(NOW - 4 * D).toISOString(), requestedReviewer: { __typename: 'User', login: 'Me' } },
            { createdAt: new Date(NOW - 3 * D).toISOString(), requestedReviewer: { __typename: 'User', login: 'other' } },
            { createdAt: new Date(NOW - 1 * D).toISOString(), requestedReviewer: { __typename: 'User', login: 'me' } },
          ],
        },
      }) as never,
      'me',
      true,
    );
    expect(pr.review).toMatchObject({
      requestedAt: new Date(NOW - D).toISOString(),
      isRequested: true,
      myLastReviewState: 'CHANGES_REQUESTED',
      newCommitsSinceReview: true,
    });
  });
});

describe('staleBranches', () => {
  const repo = {
    nameWithOwner: 'o/r',
    url: 'https://github.com/o/r',
    defaultBranchRef: { name: 'main' },
    refs: {
      nodes: [
        { name: 'main', associatedPullRequests: { totalCount: 0 }, target: { committedDate: new Date(NOW - 90 * D).toISOString(), author: { user: { login: 'me' } } } },
        { name: 'feat/old', associatedPullRequests: { totalCount: 0 }, target: { committedDate: new Date(NOW - 20 * D).toISOString(), author: { user: { login: 'me' } } } },
        { name: 'feat/fresh', associatedPullRequests: { totalCount: 0 }, target: { committedDate: new Date(NOW - 3 * D).toISOString(), author: { user: { login: 'me' } } } },
        { name: 'feat/has-pr', associatedPullRequests: { totalCount: 1 }, target: { committedDate: new Date(NOW - 30 * D).toISOString(), author: { user: { login: 'me' } } } },
        { name: 'feat/theirs', associatedPullRequests: { totalCount: 0 }, target: { committedDate: new Date(NOW - 30 * D).toISOString(), author: { user: { login: 'bob' } } } },
      ],
    },
  };
  it('keeps only my old branches without PRs, excluding the default branch', () => {
    const out = staleBranches(repo, 'me', NOW);
    expect(out.map((b) => b.name)).toEqual(['feat/old']);
    expect(out[0].url).toBe('https://github.com/o/r/tree/feat/old');
  });
});

describe('graphql errors', () => {
  it('401 is a bad token', async () => {
    await expect(graphql('t', 'q', {}, fakeFetch(401, {}))).rejects.toMatchObject({ kind: 'auth' });
  });
  it('403 with no remaining quota is a rate limit with reset time', async () => {
    const err = await graphql('t', 'q', {}, fakeFetch(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' })).catch((e) => e);
    expect(err).toBeInstanceOf(GitHubError);
    expect(err.kind).toBe('rate');
    expect(err.resetAt).toBe(new Date(1800000000 * 1000).toISOString());
  });
  it('RATE_LIMITED GraphQL error is a rate limit', async () => {
    await expect(graphql('t', 'q', {}, fakeFetch(200, { errors: [{ type: 'RATE_LIMITED', message: 'x' }] }))).rejects.toMatchObject({ kind: 'rate' });
  });
  it('network failure is offline/network', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(graphql('t', 'q', {}, failing)).rejects.toMatchObject({ kind: expect.stringMatching(/offline|network/) });
  });
  it('partial data with SAML errors becomes a friendly warning', async () => {
    const res = await graphql('t', 'q', {}, fakeFetch(200, { data: { ok: 1 }, errors: [{ type: 'FORBIDDEN', message: 'Resource protected by organization SAML enforcement.' }] }));
    expect(res.data).toEqual({ ok: 1 });
    expect(res.warnings[0]).toMatch(/SAML SSO/);
  });
});

const cellarPr = (p: Record<string, unknown>) => ({
  title: 't',
  url: 'u',
  number: 1,
  state: 'MERGED',
  mergedAt: null,
  author: { login: 'other' },
  repository: { nameWithOwner: 'o/r' },
  ...p,
});

describe('fetchGarden', () => {
  it('merges requested and reviewed-by-me PRs without duplicates', async () => {
    const body = {
      data: {
        viewer: { login: 'me' },
        rateLimit: null,
        mine: { nodes: [rawPr({ id: 'MINE' })] },
        requested: { nodes: [rawPr({ id: 'A' }), null] },
        reviewed: { nodes: [rawPr({ id: 'A' }), rawPr({ id: 'B' })] },
        barrels: { nodes: [cellarPr({ id: 'M1', mergedAt: '2026-11-01T10:00:00Z' }), null] },
        approved: {
          nodes: [
            cellarPr({ id: 'OK', viewerLatestReview: { state: 'APPROVED', submittedAt: '2026-11-02T10:00:00Z' } }),
            cellarPr({ id: 'NO', viewerLatestReview: { state: 'CHANGES_REQUESTED', submittedAt: '2026-11-02T10:00:00Z' } }),
          ],
        },
        compost: { issueCount: 1 },
      },
    };
    const g = await fetchGarden('t', [], NOW, fakeFetch(200, body));
    expect(g.mine.map((p) => p.id)).toEqual(['MINE']);
    expect(g.review.map((p) => [p.id, p.review?.isRequested])).toEqual([
      ['A', true],
      ['B', false],
    ]);
    expect(g.barrels.map((b) => [b.id, b.mergedAt])).toEqual([['M1', '2026-11-01T10:00:00Z']]);
    expect(g.barrelsUrl).toContain('merged%3A%3E%3D');
    // Only PRs whose latest review from me is an approval become bottles.
    expect(g.bottles.map((b) => [b.id, b.approvedAt])).toEqual([['OK', '2026-11-02T10:00:00Z']]);
  });
});

describe('weeds query', () => {
  it('uses variables for repo names', () => {
    expect(weedsQuery(2)).toContain('r1: repository(owner: $o1, name: $n1)');
    expect(weedsVariables(['a/b', 'c/d'])).toEqual({ o0: 'a', n0: 'b', o1: 'c', n1: 'd' });
  });
});
