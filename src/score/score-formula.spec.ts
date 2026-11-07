import {
  computeBadges,
  computeScore,
  ContestResult,
  scoreHistory,
  weekIndex,
} from './score-formula';

let n = 0;
function result(over: Partial<ContestResult> = {}): ContestResult {
  n++;
  return {
    contestId: `c${n}`,
    at: new Date(Date.UTC(2026, 0, 1) + n * 86_400_000),
    rated: true,
    rank: 5,
    percentile: 0.5,
    starters: 50,
    submitted: true,
    ...over,
  };
}
const byId = (badges: ReturnType<typeof computeBadges>, id: string) =>
  badges.find((b) => b.id === id)!;

describe('computeScore', () => {
  it('is null before the first rated contest', () => {
    expect(computeScore([])).toBeNull();
  });

  it('matches a hand calculation with weights and an unfinished contest', () => {
    // w = 1, 0.5, 0.2  →  Σ w·p = 0.8 + 0.3 + 0.2 = 1.3, Σ w = 1.7
    // base = 10 × (1.3 + 1) / (1.7 + 2) = 23 / 3.7
    // 2 of 3 submitted  →  × (0.9 + 0.1 × 2/3) = × 29/30
    // score = 23 / 3.7 × 29 / 30 = 667 / 111 ≈ 6.009
    const s = computeScore([
      result({ starters: 100, percentile: 0.8 }),
      result({ starters: 25, percentile: 0.6 }),
      result({ starters: 10, percentile: 1, submitted: false }),
    ])!;
    expect(s.weightedSum).toBeCloseTo(1.3, 10);
    expect(s.weightTotal).toBeCloseTo(1.7, 10);
    expect(s.multiplier).toBeCloseTo(29 / 30, 10);
    expect(s.score).toBeCloseTo(667 / 111, 10);
    expect(s).toMatchObject({ submitted: 2, window: 3 });
  });

  it('keeps one perfect contest well short of 10', () => {
    // 10 × (1 + 1) / (1 + 2) = 6.67
    expect(computeScore([result({ percentile: 1 })])!.score).toBeCloseTo(
      20 / 3,
      10,
    );
  });

  it('counts only the 10 most recent rated contests', () => {
    const old = [result({ percentile: 0 }), result({ percentile: 0 })];
    const recent = Array.from({ length: 10 }, () => result({ percentile: 1 }));
    // 10 × (10 + 1) / (10 + 2)
    expect(computeScore([...old, ...recent])!.score).toBeCloseTo(110 / 12, 10);
  });

  it('costs 10% when nothing was submitted', () => {
    const all = computeScore([result(), result()])!.score;
    const none = computeScore([
      result({ submitted: false }),
      result({ submitted: false }),
    ])!.score;
    expect(none).toBeCloseTo(all * 0.9, 10);
  });
});

describe('scoreHistory', () => {
  it('gives the score after each rated contest', () => {
    const rated = [result({ percentile: 1 }), result({ percentile: 0 })];
    const h = scoreHistory(rated);
    expect(h.map((p) => p.contestId)).toEqual(rated.map((r) => r.contestId));
    expect(h[0].score).toBeCloseTo(20 / 3, 10);
    expect(h[1].score).toBeCloseTo(5, 10);
  });
});

describe('weekIndex', () => {
  it('starts weeks on Monday, in UTC', () => {
    const sun = weekIndex(new Date('2026-11-01T23:59:59Z'));
    const mon = weekIndex(new Date('2026-11-02T00:00:00Z'));
    const nextSun = weekIndex(new Date('2026-11-08T23:00:00Z'));
    expect(mon).toBe(sun + 1);
    expect(nextSun).toBe(mon);
  });
});

describe('computeBadges', () => {
  it('starts with everything locked', () => {
    const badges = computeBadges([]);
    expect(badges).toHaveLength(7);
    expect(badges.every((b) => b.count === 0 && !b.earnedAt)).toBe(true);
  });

  it('counts wins, podiums and top 10% from rated contests only', () => {
    const results = [
      result({ rated: false, rank: 1, percentile: 1, starters: 4 }),
      result({ rank: 1, percentile: 1 }),
      result({ rank: 3, percentile: 0.95 }),
      result({ rank: 4, percentile: 0.92 }),
    ];
    const b = computeBadges(results);
    expect(byId(b, 'winner')).toMatchObject({
      count: 1,
      earnedAt: results[1].at,
    });
    expect(byId(b, 'podium').count).toBe(2);
    expect(byId(b, 'top-10').count).toBe(3);
    expect(byId(b, 'first-rated').earnedAt).toEqual(results[1].at);
  });

  it('earns Finisher on the 10th submit, rated or not', () => {
    const results = Array.from({ length: 11 }, (_, i) =>
      result({ rated: i % 2 === 0, submitted: i !== 3 }),
    );
    const finisher = byId(computeBadges(results), 'finisher');
    expect(finisher).toMatchObject({ count: 1, progress: 10, goal: 10 });
    expect(finisher.earnedAt).toEqual(results[10].at);
    expect(byId(computeBadges(results.slice(0, 5)), 'finisher')).toMatchObject({
      count: 0,
      progress: 4,
    });
  });

  it('earns Regular after 10 rated contests', () => {
    const results = Array.from({ length: 10 }, () => result());
    expect(byId(computeBadges(results), 'regular').earnedAt).toEqual(
      results[9].at,
    );
  });

  it('earns Streak for a contest in 4 weeks running', () => {
    const on = (d: string) => result({ at: new Date(d) });
    const run = [
      on('2026-10-12T19:00:00Z'),
      on('2026-10-18T19:00:00Z'), // Sunday, same week as the 12th
      on('2026-10-19T19:00:00Z'),
      on('2026-10-28T19:00:00Z'),
      on('2026-11-08T19:00:00Z'), // Sunday of the 4th week
    ];
    expect(byId(computeBadges(run), 'streak')).toMatchObject({
      count: 1,
      earnedAt: run[4].at,
      progress: 4,
    });
    const broken = [run[0], run[2], on('2026-11-09T19:00:00Z')];
    expect(byId(computeBadges(broken), 'streak')).toMatchObject({
      count: 0,
      progress: 2,
    });
  });
});
