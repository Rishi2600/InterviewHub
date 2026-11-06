/**
 * Pure scoring and ranking for quiz contests. No database here, so every
 * rule can be tested on its own.
 */

export interface KeyQuestion {
  id: string;
  points: number;
  correctOptionIds: string[];
}

/** All or nothing: every correct option and no wrong one. Works for single
 *  choice too, where the correct set has one option. */
export function isCorrect(picked: string[], correct: string[]): boolean {
  if (picked.length !== correct.length) return false;
  const want = new Set(correct);
  return picked.every((o) => want.has(o));
}

/** Points earned, and which questions were answered and got right. */
export function scoreAnswers(
  answers: { questionId: string; optionIds: string[] }[],
  key: KeyQuestion[],
): { score: number; answered: Set<string>; correct: Set<string> } {
  const byId = new Map(key.map((q) => [q.id, q]));
  const answered = new Set<string>();
  const correct = new Set<string>();
  let score = 0;
  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q || a.optionIds.length === 0) continue;
    answered.add(q.id);
    if (isCorrect(a.optionIds, q.correctOptionIds)) {
      correct.add(q.id);
      score += q.points;
    }
  }
  return { score, answered, correct };
}

/**
 * Time used: from when the entrant could begin (the start, or their join if
 * later) to their submit. Auto-submitted entries count the full time.
 */
export function timeUsedMs(
  contest: { startAt: Date; endAt: Date },
  entry: { joinedAt: Date; submittedAt: Date | null },
): number {
  const from = Math.max(contest.startAt.getTime(), entry.joinedAt.getTime());
  const to = (entry.submittedAt ?? contest.endAt).getTime();
  return Math.max(0, Math.min(to, contest.endAt.getTime()) - from);
}

export interface Scored {
  id: string;
  score: number;
  timeUsedMs: number;
}

export interface Ranked extends Scored {
  rank: number;
  // Share of the other starters this entry beat, from 0 to 1. Ties use
  // their average position.
  percentile: number;
}

/**
 * Higher score first, then less time. Exact ties on both share a rank and
 * the next rank skips (4, 4, 6).
 */
export function rank(entries: Scored[]): Ranked[] {
  const sorted = [...entries].sort(
    (a, b) => b.score - a.score || a.timeUsedMs - b.timeUsedMs,
  );
  const n = sorted.length;
  const out: Ranked[] = [];
  let i = 0;
  while (i < n) {
    // [i, j) is one group of exact ties.
    let j = i + 1;
    while (
      j < n &&
      sorted[j].score === sorted[i].score &&
      sorted[j].timeUsedMs === sorted[i].timeUsedMs
    )
      j++;
    const averagePosition = (i + 1 + j) / 2;
    const percentile = n === 1 ? 1 : (n - averagePosition) / (n - 1);
    for (let k = i; k < j; k++) {
      out.push({ ...sorted[k], rank: i + 1, percentile });
    }
    i = j;
  }
  return out;
}
