// GraphQL documents and search strings.

export const PR_FIELDS = /* GraphQL */ `
fragment PrFields on PullRequest {
  id
  title
  url
  number
  isDraft
  createdAt
  updatedAt
  reviewDecision
  author { login }
  repository { nameWithOwner }
  commits(last: 1) {
    nodes { commit { committedDate statusCheckRollup { state } } }
  }
  reviewThreads(first: 50) {
    nodes {
      isResolved
      comments(last: 1) { nodes { author { login } } }
    }
  }
}`;

export const REVIEW_FIELDS = /* GraphQL */ `
fragment ReviewFields on PullRequest {
  viewerLatestReview { state submittedAt }
  timelineItems(itemTypes: [REVIEW_REQUESTED_EVENT], last: 20) {
    nodes {
      ... on ReviewRequestedEvent {
        createdAt
        requestedReviewer {
          __typename
          ... on User { login }
          ... on Team { slug }
        }
      }
    }
  }
}`;

export const GARDEN_QUERY = /* GraphQL */ `
query Garden($mine: String!, $requested: String!, $reviewed: String!, $harvest: String!, $compost: String!) {
  viewer { login }
  rateLimit { remaining resetAt cost }
  mine: search(query: $mine, type: ISSUE, first: 50) {
    nodes { ...PrFields }
  }
  requested: search(query: $requested, type: ISSUE, first: 50) {
    nodes { ...PrFields ...ReviewFields }
  }
  reviewed: search(query: $reviewed, type: ISSUE, first: 50) {
    nodes { ...PrFields ...ReviewFields }
  }
  harvest: search(query: $harvest, type: ISSUE, first: 1) { issueCount }
  compost: search(query: $compost, type: ISSUE, first: 1) { issueCount }
}
${PR_FIELDS}
${REVIEW_FIELDS}`;

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function searchStrings(now: number) {
  const day = 86_400_000;
  return {
    mine: 'is:pr is:open author:@me archived:false',
    requested: 'is:pr is:open review-requested:@me archived:false',
    // PRs I already reviewed: needed for "re-review" and "approved, waiting to merge".
    reviewed: 'is:pr is:open reviewed-by:@me -author:@me archived:false',
    harvest: `is:pr author:@me is:merged merged:>=${isoDate(now - 7 * day)}`,
    compost: `is:pr author:@me is:closed is:unmerged closed:>=${isoDate(now - 30 * day)}`,
  };
}

export function searchUrl(q: string): string {
  return `https://github.com/search?type=pullrequests&q=${encodeURIComponent(q)}`;
}

/** One aliased repository() block per repo, using variables (no string injection). */
export function weedsQuery(repoCount: number): string {
  const vars: string[] = [];
  const blocks: string[] = [];
  for (let i = 0; i < repoCount; i++) {
    vars.push(`$o${i}: String!`, `$n${i}: String!`);
    blocks.push(`
  r${i}: repository(owner: $o${i}, name: $n${i}) {
    nameWithOwner
    url
    defaultBranchRef { name }
    refs(refPrefix: "refs/heads/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
      nodes {
        name
        associatedPullRequests(first: 1) { totalCount }
        target { ... on Commit { committedDate author { user { login } } } }
      }
    }
  }`);
  }
  return `query Weeds(${vars.join(', ')}) {${blocks.join('')}\n}`;
}

export function weedsVariables(repos: string[]): Record<string, string> {
  const v: Record<string, string> = {};
  repos.forEach((r, i) => {
    const [o, n] = r.split('/');
    v[`o${i}`] = o;
    v[`n${i}`] = n;
  });
  return v;
}
