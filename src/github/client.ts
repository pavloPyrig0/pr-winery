// Thin GitHub GraphQL client with friendly error kinds.
import type { GardenData, PullRequest, ReviewInfo, StaleBranch } from '../types';
import { DAY } from './mapping';
import { GARDEN_QUERY, searchStrings, searchUrl, weedsQuery, weedsVariables } from './queries';

export const ENDPOINT = 'https://api.github.com/graphql';

export type ErrorKind = 'auth' | 'rate' | 'offline' | 'network' | 'graphql';

export class GitHubError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly resetAt?: string,
  ) {
    super(message);
  }
}

interface GqlError {
  type?: string;
  message: string;
}

export interface GqlResult<T> {
  data: T;
  warnings: string[];
}

export async function graphql<T>(token: string, query: string, variables: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<GqlResult<T>> {
  let res: Response;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new GitHubError(offline ? 'offline' : 'network', offline ? 'You are offline' : 'Could not reach GitHub');
  }

  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  const resetAt = reset ? new Date(Number(reset) * 1000).toISOString() : undefined;

  if (res.status === 401) throw new GitHubError('auth', 'GitHub rejected the token');
  if (res.status === 403 || res.status === 429) {
    const text = await res.text().catch(() => '');
    if (remaining === '0' || /rate limit/i.test(text) || res.status === 429) {
      throw new GitHubError('rate', 'GitHub rate limit reached', resetAt);
    }
    throw new GitHubError('auth', 'The token is not allowed to read this data');
  }
  if (!res.ok) throw new GitHubError('network', `GitHub returned ${res.status}`);

  const body = (await res.json()) as { data?: T; errors?: GqlError[] };
  const errors = body.errors ?? [];
  if (errors.some((e) => e.type === 'RATE_LIMITED')) throw new GitHubError('rate', 'GitHub rate limit reached', resetAt);
  if (!body.data) throw new GitHubError('graphql', errors[0]?.message ?? 'Unexpected GitHub response');
  const warnings = errors.map((e) =>
    /saml|sso/i.test(e.message)
      ? 'Some organisation data is hidden: authorise the token for SAML SSO in that org.'
      : e.message,
  );
  return { data: body.data, warnings: [...new Set(warnings)] };
}

// ---- Raw response shapes -------------------------------------------------

interface RawPr {
  id: string;
  title: string;
  url: string;
  number: number;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  reviewDecision: PullRequest['reviewDecision'];
  author: { login: string } | null;
  repository: { nameWithOwner: string };
  commits: { nodes: { commit: { committedDate: string; statusCheckRollup: { state: PullRequest['checkState'] } | null } }[] };
  reviewThreads: { nodes: { isResolved: boolean; comments: { nodes: { author: { login: string } | null }[] } }[] };
  viewerLatestReview?: { state: ReviewInfo['myLastReviewState']; submittedAt: string | null } | null;
  timelineItems?: {
    nodes: ({ createdAt: string; requestedReviewer: { __typename: string; login?: string; slug?: string } | null } | null)[];
  };
}

interface RawGarden {
  viewer: { login: string };
  rateLimit: { remaining: number; resetAt: string; cost: number } | null;
  mine: { nodes: (RawPr | null)[] };
  requested: { nodes: (RawPr | null)[] };
  reviewed: { nodes: (RawPr | null)[] };
  harvest: { issueCount: number };
  compost: { issueCount: number };
}

export function normalizePr(raw: RawPr, viewer: string, requested: boolean | null): PullRequest {
  const last = raw.commits.nodes[0]?.commit;
  const pr: PullRequest = {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    number: raw.number,
    repo: raw.repository.nameWithOwner,
    author: raw.author?.login ?? null,
    isDraft: raw.isDraft,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    reviewDecision: raw.reviewDecision ?? null,
    checkState: last?.statusCheckRollup?.state ?? null,
    reviewThreads: raw.reviewThreads.nodes.map((t) => ({
      isResolved: t.isResolved,
      lastCommentAuthor: t.comments.nodes[0]?.author?.login ?? null,
    })),
  };
  if (requested !== null) {
    const me = viewer.toLowerCase();
    const events = (raw.timelineItems?.nodes ?? []).filter((n): n is NonNullable<typeof n> => !!n);
    const mine = events.filter((e) => e.requestedReviewer?.login?.toLowerCase() === me);
    const team = events.filter((e) => e.requestedReviewer?.__typename === 'Team');
    const pickLatest = (list: typeof events) => list.map((e) => e.createdAt).sort().at(-1) ?? null;
    const review = raw.viewerLatestReview ?? null;
    const reviewedAt = review?.submittedAt ?? null;
    pr.review = {
      requestedAt: pickLatest(mine) ?? pickLatest(team),
      isRequested: requested,
      myLastReviewState: review?.state ?? null,
      myLastReviewAt: reviewedAt,
      newCommitsSinceReview: !!(reviewedAt && last && Date.parse(last.committedDate) > Date.parse(reviewedAt)),
    };
  }
  return pr;
}

interface RawRepoRefs {
  nameWithOwner: string;
  url: string;
  defaultBranchRef: { name: string } | null;
  refs: {
    nodes: {
      name: string;
      associatedPullRequests: { totalCount: number };
      target: { committedDate?: string; author?: { user: { login: string } | null } | null } | null;
    }[];
  };
}

export function staleBranches(repo: RawRepoRefs, viewer: string, now: number, staleDays = 14): StaleBranch[] {
  const me = viewer.toLowerCase();
  const out: StaleBranch[] = [];
  for (const ref of repo.refs.nodes) {
    if (ref.name === repo.defaultBranchRef?.name) continue;
    if (ref.associatedPullRequests.totalCount > 0) continue;
    const date = ref.target?.committedDate;
    if (!date || now - Date.parse(date) < staleDays * DAY) continue;
    if (ref.target?.author?.user?.login?.toLowerCase() !== me) continue;
    out.push({
      repo: repo.nameWithOwner,
      name: ref.name,
      url: `${repo.url}/tree/${ref.name.split('/').map(encodeURIComponent).join('/')}`,
      lastCommitAt: date,
    });
  }
  return out;
}

/** Fetch everything both gardens need. */
export async function fetchGarden(token: string, weedRepos: string[], now = Date.now(), fetchImpl: typeof fetch = fetch): Promise<GardenData> {
  const q = searchStrings(now);
  const { data, warnings } = await graphql<RawGarden>(token, GARDEN_QUERY, q, fetchImpl);
  const viewer = data.viewer.login;
  const nodes = (list: (RawPr | null)[]) => list.filter((n): n is RawPr => !!n && !!n.id);

  const mine = nodes(data.mine.nodes).map((n) => normalizePr(n, viewer, null));
  const requested = nodes(data.requested.nodes).map((n) => normalizePr(n, viewer, true));
  const seen = new Set(requested.map((p) => p.id));
  const reviewedOnly = nodes(data.reviewed.nodes)
    .filter((n) => !seen.has(n.id))
    .map((n) => normalizePr(n, viewer, false));

  let weeds: StaleBranch[] = [];
  const allWarnings = [...warnings];
  if (weedRepos.length) {
    try {
      const res = await graphql<Record<string, RawRepoRefs | null>>(token, weedsQuery(weedRepos.length), weedsVariables(weedRepos), fetchImpl);
      for (const repo of Object.values(res.data)) if (repo) weeds.push(...staleBranches(repo, viewer, now));
      allWarnings.push(...res.warnings);
    } catch (e) {
      if (e instanceof GitHubError && (e.kind === 'rate' || e.kind === 'offline')) throw e;
      allWarnings.push('Could not load branches for weeds. Check the repo list in settings.');
      weeds = [];
    }
  }

  return {
    viewer,
    mine,
    review: [...requested, ...reviewedOnly],
    weeds,
    harvestCount: data.harvest.issueCount,
    harvestUrl: searchUrl(q.harvest),
    compostCount: data.compost.issueCount,
    compostUrl: searchUrl(q.compost),
    fetchedAt: new Date(now).toISOString(),
    warnings: [...new Set(allWarnings)],
  };
}
