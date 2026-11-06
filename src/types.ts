// Shared domain types. Kept free of rendering and DOM concerns.

export type GardenId = 'mine' | 'review';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type CheckState = 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING' | 'EXPECTED' | null;

export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;

export interface ReviewThread {
  isResolved: boolean;
  /** Login of the author of the last comment in the thread. */
  lastCommentAuthor: string | null;
}

/** Extra facts we only need for PRs in the review garden. */
export interface ReviewInfo {
  /** ISO time my review was (most recently) requested. */
  requestedAt: string | null;
  /** Whether my review is currently requested (vs. only "reviewed by me"). */
  isRequested: boolean;
  /** State of my latest review, if any. */
  myLastReviewState: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING' | null;
  /** ISO time of my latest submitted review. */
  myLastReviewAt: string | null;
  /** Commits were pushed after my latest review. */
  newCommitsSinceReview: boolean;
}

export interface PullRequest {
  id: string;
  title: string;
  url: string;
  number: number;
  repo: string; // owner/name
  author: string | null;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  reviewDecision: ReviewDecision;
  checkState: CheckState;
  reviewThreads: ReviewThread[];
  review?: ReviewInfo;
}

export interface StaleBranch {
  repo: string;
  name: string;
  url: string;
  lastCommitAt: string;
}

/** A PR kept in the cellar: my merged PRs (barrels) or PRs I approved (bottles). */
export interface CellarPr {
  id: string;
  title: string;
  url: string;
  number: number;
  repo: string;
  author: string | null;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  /** When it merged, if it did. */
  mergedAt: string | null;
  /** When I approved it (bottles only). */
  approvedAt: string | null;
}

export interface GardenData {
  viewer: string;
  mine: PullRequest[];
  review: PullRequest[];
  weeds: StaleBranch[];
  /** My PRs merged in the last 30 days: one barrel each. */
  barrels: CellarPr[];
  barrelsUrl: string;
  /** PRs by others that I approved (open, or merged/closed in the last 30 days): one bottle each. */
  bottles: CellarPr[];
  compostCount: number;
  compostUrl: string;
  fetchedAt: string;
  /** Non-fatal warnings, e.g. orgs hidden behind SAML SSO. */
  warnings: string[];
}

export type BedState =
  | 'seedling'
  | 'bugs'
  | 'thirsty'
  | 'blooming'
  | 'growing'
  | 'drooping'
  | 'wilting';

export type BadgeTone = 'red' | 'amber' | 'blue' | 'green' | 'grey';

export type MarkerKind = 'alert-amber' | 'alert-red' | 'drop' | 'bug' | null;

/** A bed = a PR placed in the world with its derived state. */
export interface BedItem {
  kind: 'bed';
  id: string;
  pr: PullRequest;
  state: BedState;
  /** Higher = needs care sooner. */
  urgency: number;
  /** Short reason, e.g. "Review requested 2 days ago". */
  reason: string;
}

export interface WeedItem {
  kind: 'weed';
  id: string;
  branch: StaleBranch;
  urgency: number;
  reason: string;
}

/** A barrel (my merged PR) or a bottle (a PR I approved) stored in the cellar. */
export interface CellarItem {
  kind: 'barrel' | 'bottle';
  id: string;
  pr: CellarPr;
  urgency: number;
  reason: string;
}

export interface CompostItem {
  kind: 'compost';
  id: string;
  url: string;
  count: number;
  urgency: number;
  reason: string;
}

export type GardenItem = BedItem | WeedItem | CellarItem | CompostItem;
