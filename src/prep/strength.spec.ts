import {
  Evidence,
  fromCoach,
  fromDrill,
  fromInterview,
  fromReview,
  strengths,
  suggestions,
} from './strength';

const NOW = new Date('2026-11-13T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

/** An interview whose areas average `avg` (all areas the same score). */
const interview = (topic: string, avg: number, ago = 0) =>
  fromInterview({
    topic,
    level: 'junior',
    startedAt: daysAgo(ago),
    endedAt: daysAgo(ago),
    feedback: {
      areas: [
        { name: 'Knowledge', score: avg },
        { name: 'Edge cases', score: avg },
      ],
      questions: [],
    },
  })!;
const drill = (topic: string, right: number, ago = 0) =>
  fromDrill({
    topic,
    level: 'mid',
    answered: 10,
    right,
    total: 10,
    startedAt: daysAgo(ago),
    endedAt: daysAgo(ago),
  })!;
const sql = (evidence: Evidence[]) =>
  strengths(evidence, NOW).find((t) => t.topic === 'SQL')!;
const round = (n: number | null) =>
  n === null ? null : Math.round(n * 1000) / 1000;

// The worked examples in docs/PREP_DESIGN.md §5.7.
describe('topic strength', () => {
  it('one practice interview averaging 2.2 makes a topic weak', () => {
    const t = sql([interview('SQL', 2.2)]);
    expect(round(t.strength)).toBe(0.45);
    expect(t.weak).toBe(true);
  });

  it('one practice interview averaging 3.0 does not', () => {
    expect(round(sql([interview('SQL', 3)]).strength)).toBe(0.55);
  });

  it('one bad drill is not enough, three are', () => {
    const one = sql([drill('SQL', 4)]);
    expect(round(one.strength)).toBe(0.533);
    expect(one.weak).toBe(false);
    const three = sql([drill('SQL', 4), drill('SQL', 4), drill('SQL', 4)]);
    expect(round(three.strength)).toBe(0.48);
    expect(three.weak).toBe(true);
  });

  it('an interviewer review counts 1.5, split across its topics', () => {
    const areas = [{ name: 'Problem solving', score: 2.5 }];
    const one = fromReview({ topics: ['SQL'], areas, at: NOW });
    expect(round(sql(one).strength)).toBe(0.465);
    const two = fromReview({ topics: ['SQL', 'React'], areas, at: NOW });
    expect(two.map((e) => e.weight)).toEqual([0.75, 0.75]);
  });

  it('good drills afterwards lift a weak topic', () => {
    const t = sql([interview('SQL', 2.2), drill('SQL', 9), drill('SQL', 9)]);
    expect(round(t.strength)).toBe(0.6);
    expect(t.weak).toBe(false);
  });

  it('old results fade, and stop counting after 90 days', () => {
    const faded = sql([interview('SQL', 2.2, 60)]);
    expect(round(faded.evidence)).toBe(0.25);
    expect(faded.strength).toBeNull();
    expect(sql([interview('SQL', 1, 91)]).evidence).toBe(0);
  });

  it('names the result that pulled it down most, and the area to focus on', () => {
    const t = sql([drill('SQL', 8, 1), interview('SQL', 2.2, 2)]);
    expect(t.reason?.text).toBe(
      '2.2/5 on Knowledge in your SQL practice interview',
    );
    expect(t.focus).toBe('Knowledge');
    // The newest result's level.
    expect(t.level).toBe('mid');
  });

  it('weighs a short coach session less', () => {
    const coach = (questions: number) =>
      fromCoach({
        topic: 'SQL',
        level: 'junior',
        startedAt: NOW,
        endedAt: NOW,
        feedback: {
          areas: [{ name: 'Knowledge', score: 2 }],
          questions: Array(questions).fill({}),
        },
      })!;
    expect(coach(5).weight).toBeCloseTo(0.6);
    expect(coach(2).weight).toBeCloseTo(0.24);
  });
});

describe('suggestions', () => {
  it('lists the 3 weakest, weakest first, leaving out pinned topics', () => {
    const all = strengths(
      [
        interview('SQL', 1.5),
        interview('React', 2),
        interview('Python', 1),
        interview('Node.js', 2.2),
        interview('JavaScript', 4),
      ],
      NOW,
    );
    expect(suggestions(all, []).map((t) => t.topic)).toEqual([
      'Python',
      'SQL',
      'React',
    ]);
    expect(suggestions(all, ['Python']).map((t) => t.topic)).toEqual([
      'SQL',
      'React',
      'Node.js',
    ]);
  });
});
