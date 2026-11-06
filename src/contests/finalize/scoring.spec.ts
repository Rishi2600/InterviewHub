import { isCorrect, rank, scoreAnswers, timeUsedMs } from './scoring';

const key = [
  { id: 'q1', points: 1, correctOptionIds: ['a'] },
  { id: 'q2', points: 2, correctOptionIds: ['a', 'c'] },
  { id: 'q3', points: 3, correctOptionIds: ['b'] },
];

describe('isCorrect', () => {
  it('needs every correct option and no wrong one, in any order', () => {
    expect(isCorrect(['c', 'a'], ['a', 'c'])).toBe(true);
    expect(isCorrect(['a'], ['a', 'c'])).toBe(false);
    expect(isCorrect(['a', 'b', 'c'], ['a', 'c'])).toBe(false);
    expect(isCorrect(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(isCorrect([], ['a'])).toBe(false);
  });
});

describe('scoreAnswers', () => {
  it('adds the points of fully correct answers only', () => {
    const result = scoreAnswers(
      [
        { questionId: 'q1', optionIds: ['a'] },
        { questionId: 'q2', optionIds: ['a'] },
        { questionId: 'q3', optionIds: ['b'] },
        { questionId: 'gone', optionIds: ['a'] },
        { questionId: 'q1', optionIds: [] },
      ],
      key,
    );
    expect(result.score).toBe(4);
    expect([...result.answered].sort()).toEqual(['q1', 'q2', 'q3']);
    expect([...result.correct].sort()).toEqual(['q1', 'q3']);
  });

  it('scores nothing for no answers', () => {
    expect(scoreAnswers([], key).score).toBe(0);
  });
});

describe('timeUsedMs', () => {
  const contest = {
    startAt: new Date('2026-11-10T12:00:00Z'),
    endAt: new Date('2026-11-10T12:30:00Z'),
  };
  const at = (min: number) =>
    new Date(contest.startAt.getTime() + min * 60_000);

  it('counts from the start, or from a late join', () => {
    expect(
      timeUsedMs(contest, { joinedAt: at(-60), submittedAt: at(10) }),
    ).toBe(10 * 60_000);
    expect(timeUsedMs(contest, { joinedAt: at(5), submittedAt: at(10) })).toBe(
      5 * 60_000,
    );
  });

  it('counts the full time left when submitted by the clock', () => {
    expect(timeUsedMs(contest, { joinedAt: at(-1), submittedAt: null })).toBe(
      30 * 60_000,
    );
    expect(timeUsedMs(contest, { joinedAt: at(20), submittedAt: null })).toBe(
      10 * 60_000,
    );
  });
});

describe('rank', () => {
  it('puts higher scores first, then less time', () => {
    const out = rank([
      { id: 'slow', score: 5, timeUsedMs: 900 },
      { id: 'low', score: 3, timeUsedMs: 100 },
      { id: 'fast', score: 5, timeUsedMs: 500 },
    ]);
    expect(out.map((r) => [r.id, r.rank])).toEqual([
      ['fast', 1],
      ['slow', 2],
      ['low', 3],
    ]);
  });

  it('shares a rank on exact ties and skips the next (4, 4, 6)', () => {
    const out = rank([
      { id: 'a', score: 9, timeUsedMs: 1 },
      { id: 'b', score: 8, timeUsedMs: 1 },
      { id: 'c', score: 7, timeUsedMs: 1 },
      { id: 'd', score: 6, timeUsedMs: 5 },
      { id: 'e', score: 6, timeUsedMs: 5 },
      { id: 'f', score: 6, timeUsedMs: 6 },
    ]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, 4, 4, 6]);
  });

  it('gives percentiles from 1 for the top to 0 for the last, ties averaged', () => {
    const out = rank([
      { id: 'a', score: 3, timeUsedMs: 0 },
      { id: 'b', score: 2, timeUsedMs: 0 },
      { id: 'c', score: 2, timeUsedMs: 0 },
      { id: 'd', score: 1, timeUsedMs: 0 },
      { id: 'e', score: 0, timeUsedMs: 0 },
    ]);
    // Ties at positions 2 and 3 average to 2.5: (5 - 2.5) / 4.
    expect(out.map((r) => r.percentile)).toEqual([1, 0.625, 0.625, 0.25, 0]);
  });

  it('handles a single starter and an empty contest', () => {
    expect(rank([{ id: 'a', score: 0, timeUsedMs: 0 }])[0]).toMatchObject({
      rank: 1,
      percentile: 1,
    });
    expect(rank([])).toEqual([]);
  });
});
