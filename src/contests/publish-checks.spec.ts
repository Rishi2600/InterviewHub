import { publishChecks } from './publish-checks';

const NOW = new Date('2026-11-10T12:00:00Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

const ready = {
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
