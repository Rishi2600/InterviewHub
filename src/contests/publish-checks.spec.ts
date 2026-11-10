import { publishChecks } from './publish-checks';

const NOW = new Date('2026-11-10T12:00:00Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

const ready = {
  format: 'quiz' as const,
  title: 'React Hooks',
  description: 'Twenty questions on hooks.',
  startAt: minutes(15),
  durationMinutes: 45,
};
const question = (over: object = {}) => ({
  kind: 'single' as const,
  prompt: 'What does useState return?',
  options: [
    { id: 'a', text: 'A pair' },
    { id: 'b', text: 'A ref' },
  ],
  correctOptionIds: ['a'],
  title: '',
  tests: [],
  ...over,
});

const failing = (
  contest: Parameters<typeof publishChecks>[0],
  questions: Parameters<typeof publishChecks>[1],
) =>
  publishChecks(contest, questions, NOW)
    .filter((c) => !c.ok)
    .map((c) => (c.detail ? `${c.label}: ${c.detail}` : c.label));

describe('publishChecks', () => {
  it('passes a complete contest starting exactly 15 minutes ahead', () => {
    expect(failing(ready, [question()])).toEqual([]);
  });

  it('flags missing details, a start too soon and a bad length', () => {
    expect(
      failing(
        {
          format: 'quiz',
          title: ' ',
          description: '',
          startAt: minutes(14),
          durationMinutes: 9,
        },
        [question()],
      ),
    ).toEqual([
      'Title',
      'Description',
      'Starts at least 15 minutes from now',
      'Length between 10 minutes and 24 hours',
    ]);
    expect(failing({ ...ready, startAt: null }, [question()])).toEqual([
      'Starts at least 15 minutes from now',
    ]);
    expect(
      failing({ ...ready, durationMinutes: 24 * 60 + 1 }, [question()]),
    ).toHaveLength(1);
  });

  it('needs 1 to 50 questions', () => {
    expect(failing(ready, [])).toEqual(['1 to 50 questions']);
    expect(failing(ready, Array(51).fill(question()))).toEqual([
      '1 to 50 questions',
    ]);
  });

  it('names the questions that fail, numbered from 1', () => {
    const qs = [
      question(),
      question({ correctOptionIds: [] }),
      question({ options: [{ id: 'a', text: 'Only' }] }),
      question({ correctOptionIds: [] }),
      question({ kind: 'single', correctOptionIds: ['a', 'b'] }),
      question({ prompt: '  ' }),
    ];
    expect(failing(ready, qs)).toEqual([
      '2 to 6 options each: Question 3 needs 2 to 6 options',
      'Every question has a correct option: Questions 2 and 4 have no correct option',
      'Single choice questions have one correct option: Question 5 has more than one',
      'Every question and option has text: Question 6 has empty text',
    ]);
  });

  it('allows several correct options on a multiple choice question', () => {
    expect(
      failing(ready, [
        question({ kind: 'multiple', correctOptionIds: ['a', 'b'] }),
      ]),
    ).toEqual([]);
  });
});

describe('publishChecks for a code contest', () => {
  const contest = { ...ready, format: 'code' as const };
  const code = (over: object = {}) => ({
    kind: 'code' as const,
    title: 'Merge intervals',
    prompt: 'Merge every pair that overlaps.',
    options: [],
    correctOptionIds: [],
    tests: [
      { input: '2\n1 4\n4 5', output: '1 5', visible: true },
      { input: '1\n5 5', output: '5 5', visible: false },
    ],
    ...over,
  });

  it('passes a complete code contest', () => {
    expect(failing(contest, [code()])).toEqual([]);
  });

  it('needs a title, a statement, and both a visible and a hidden test', () => {
    expect(
      failing(contest, [
        code({ title: ' ' }),
        code({ tests: [{ input: '1', output: '1', visible: true }] }),
        code({ prompt: '', tests: [] }),
      ]),
    ).toEqual([
      'Every question has a title and a statement: Questions 1 and 3 have no title or statement',
      'Every question has at least 1 visible and 1 hidden test: Questions 2 and 3 need a visible and a hidden test',
    ]);
  });

  it('needs an expected output for every test', () => {
    const tests = [
      { input: '1', output: '1', visible: true },
      { input: '2', output: ' ', visible: false },
    ];
    expect(failing(contest, [code({ tests })])).toEqual([
      'Every test has an expected output: Question 1 has a test with no expected output',
    ]);
  });

  it('allows 1 to 10 questions', () => {
    expect(failing(contest, [])).toContain('1 to 10 questions');
    expect(failing(contest, Array(11).fill(code()))).toContain(
      '1 to 10 questions',
    );
  });
});
