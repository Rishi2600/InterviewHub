import { parseQuestionSet, promptHash, writeMessages } from './drill-questions';

const good = (over: Record<string, unknown> = {}) => ({
  prompt: 'Which clause filters groups after aggregation?',
  code: '',
  options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'],
  correct: 1,
  explanation: 'HAVING filters the groups GROUP BY makes; WHERE filters rows.',
  ...over,
});
const batch = (...qs: object[]) => JSON.stringify({ questions: qs });
const noShuffle = (n: number) => n - 1; // j = i: keeps the order

describe('parseQuestionSet', () => {
  it('keeps a sound question and points `correct` at the right option id', () => {
    const [q] = parseQuestionSet(batch(good()), new Set(), noShuffle);
    expect(q.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(q.options.find((o) => o.id === q.correct)?.text).toBe('HAVING');
    expect(q.code).toBeNull();
  });

  it('still points at the right option after a shuffle', () => {
    for (let seed = 0; seed < 20; seed++) {
      const random = (n: number) => (seed * 7 + n) % n;
      const [q] = parseQuestionSet(batch(good()), new Set(), random);
      expect(q.options.find((o) => o.id === q.correct)?.text).toBe('HAVING');
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
    }
  });

  it.each([
    ['three options', { options: ['A', 'B', 'C'] }],
    [
      'repeated options',
      { options: ['WHERE', 'where', 'GROUP BY', 'ORDER BY'] },
    ],
    ['"all of the above"', { options: ['A', 'B', 'C', 'All of the above'] }],
    ['an index out of range', { correct: 4 }],
    ['a non-integer index', { correct: 1.5 }],
    ['no explanation', { explanation: '' }],
    ['a prompt that is too long', { prompt: 'x'.repeat(601) }],
    ['code that is too long', { code: 'x'.repeat(801) }],
  ])('drops a question with %s', (_, over) => {
    expect(parseQuestionSet(batch(good(over)), new Set())).toEqual([]);
  });

  it('drops repeats, within the batch and against the bank', () => {
    const other = good({ prompt: 'What does COUNT(*) count?' });
    const known = new Set([promptHash(other.prompt + '\n')]);
    const out = parseQuestionSet(
      batch(
        good(),
        good({ prompt: '  which CLAUSE filters groups, after aggregation? ' }),
        other,
      ),
      known,
    );
    expect(out).toHaveLength(1);
  });

  it('returns nothing for a reply that is not the expected JSON', () => {
    expect(parseQuestionSet('not json', new Set())).toEqual([]);
    expect(parseQuestionSet('{"items":[]}', new Set())).toEqual([]);
  });
});

describe('writeMessages', () => {
  it('names the shelf and lists questions to avoid', () => {
    const [system] = writeMessages('SQL', 'junior', ['What is a JOIN?']);
    expect(system.content).toContain('SQL, at junior level');
    expect(system.content).toContain('- What is a JOIN?');
  });
});
