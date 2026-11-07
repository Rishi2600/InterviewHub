/**
 * The candidate score and badges, as pure functions over a candidate's
 * contest results. No database here, so every rule can be tested against a
 * hand calculation. See docs/CONTEST_DESIGN.md §2.
 */

/** One finished contest from the candidate's side, from its activity event. */
export interface ContestResult {
  contestId: string;
  at: Date;
  rated: boolean;
  rank: number;
  // Share of the other starters beaten, 0 to 1; ties use their average rank.
  percentile: number;
  starters: number;
  // Pressed Submit, rather than left to the clock.
  submitted: boolean;
}

// The 10 most recent rated contests count.
export const SCORE_WINDOW = 10;
// Contests with fewer starters than this count for less.
export const FULL_WEIGHT_STARTERS = 50;
// Two imaginary results at 0.5 pull a new candidate towards 5.0.
export const PRIOR_WEIGHT = 2;
// Provisional until this many rated contests.
export const SETTLED_AFTER = 3;

export interface ScoreBreakdown {
  score: number;
  // Σ w·p and Σ w over the window, for the formula line.
  weightedSum: number;
  weightTotal: number;
  // 0.9 + 0.1 × completion: finishing everything costs nothing.
  multiplier: number;
  submitted: number;
  window: number;
}

/**
 * score = 10 × (Σ w·p + 2 × 0.5) / (Σ w + 2) × (0.9 + 0.1 × completion),
 * over the last 10 rated contests, where w = min(1, starters / 50) and
 * completion is the share of those contests the candidate submitted.
 * `rated` must be oldest first. Null before the first rated contest.
 */
export function computeScore(rated: ContestResult[]): ScoreBreakdown | null {
  const window = rated.slice(-SCORE_WINDOW);
  if (window.length === 0) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of window) {
    const w = Math.min(1, r.starters / FULL_WEIGHT_STARTERS);
    weightedSum += w * r.percentile;
    weightTotal += w;
  }
  const submitted = window.filter((r) => r.submitted).length;
  const multiplier = 0.9 + 0.1 * (submitted / window.length);
  const base =
    (10 * (weightedSum + PRIOR_WEIGHT * 0.5)) / (weightTotal + PRIOR_WEIGHT);
  return {
    score: base * multiplier,
    weightedSum,
    weightTotal,
    multiplier,
    submitted,
    window: window.length,
  };
}

/** The score after each rated contest, for the trend line. */
export function scoreHistory(
  rated: ContestResult[],
): { contestId: string; at: Date; score: number }[] {
  return rated.map((r, i) => ({
    contestId: r.contestId,
    at: r.at,
    score: computeScore(rated.slice(0, i + 1))!.score,
  }));
}

export const BADGE_IDS = [
  'first-rated',
  'winner',
  'podium',
  'top-10',
  'finisher',
  'regular',
  'streak',
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export interface BadgeState {
  id: BadgeId;
  // Times earned; only Winner, Podium and Top 10% go above 1.
  count: number;
  earnedAt: Date | null;
  // Towards `goal` while locked.
  progress: number;
  goal: number;
}

const STREAK_WEEKS = 4;
const FINISHER_GOAL = 10;
const REGULAR_GOAL = 10;

/** Monday-to-Sunday week number in UTC. 1 Jan 1970 was a Thursday. */
export function weekIndex(at: Date): number {
  const day = Math.floor(at.getTime() / 86_400_000);
  return Math.floor((day + 3) / 7);
}

/**
 * Badges from all of a candidate's contest results, oldest first. Winner,
 * Podium and Top 10% count rated contests only, so a two-person contest
 * cannot hand out a free win.
 */
export function computeBadges(results: ContestResult[]): BadgeState[] {
  const rated = results.filter((r) => r.rated);
  const submitted = results.filter((r) => r.submitted);

  const repeatable = (id: BadgeId, hit: (r: ContestResult) => boolean) => {
    const wins = rated.filter(hit);
    return badge(id, wins.length, wins[0]?.at ?? null, wins.length ? 1 : 0, 1);
  };
  const reach = (id: BadgeId, list: ContestResult[], goal: number) =>
    badge(
      id,
      list.length >= goal ? 1 : 0,
      list[goal - 1]?.at ?? null,
      Math.min(goal, list.length),
      goal,
    );

  return [
    reach('first-rated', rated, 1),
    repeatable('winner', (r) => r.rank === 1),
    repeatable('podium', (r) => r.rank <= 3),
    repeatable('top-10', (r) => r.percentile >= 0.9),
    reach('finisher', submitted, FINISHER_GOAL),
    reach('regular', rated, REGULAR_GOAL),
    streakBadge(results),
  ];
}

/** A contest in 4 weeks running. Progress is the best run so far. */
function streakBadge(results: ContestResult[]): BadgeState {
  let best = 0;
  let run = 0;
  let lastWeek: number | null = null;
  let earnedAt: Date | null = null;
  for (const r of results) {
    const week = weekIndex(r.at);
    if (week === lastWeek) continue;
    run = lastWeek !== null && week === lastWeek + 1 ? run + 1 : 1;
    lastWeek = week;
    best = Math.max(best, run);
    if (!earnedAt && run >= STREAK_WEEKS) earnedAt = r.at;
  }
  return badge(
    'streak',
    earnedAt ? 1 : 0,
    earnedAt,
    Math.min(STREAK_WEEKS, best),
    STREAK_WEEKS,
  );
}

function badge(
  id: BadgeId,
  count: number,
  earnedAt: Date | null,
  progress: number,
  goal: number,
): BadgeState {
  return { id, count, earnedAt, progress, goal };
}
