import { judgeTests, pointsFor, Runner } from './judge';

const question = {
  points: 40,
  timeLimitMs: 2_000,
  tests: [
    { input: '2\n1 4\n4 5', output: '1 5', visible: true },
    { input: 'a', output: 'A', visible: false },
    { input: 'b', output: 'B', visible: false },
    { input: 'c', output: 'C', visible: false },
    { input: 'loop', output: 'never', visible: false },
  ],
};

// Upper-cases its input, except that "c" comes out wrong and "loop" runs
// out of time.
const fakeRun: Runner = ({ stdin }) =>
  Promise.resolve(
    stdin === 'loop'
      ? { verdict: 'time', stdout: '', stderr: '', ms: 5_000 }
      : {
          verdict: 'ok',
          stdout: stdin === 'c' ? 'x\n' : `${stdin.toUpperCase()}\n`,
          stderr: '',
          ms: 3,
        },
  );

describe('judgeTests', () => {
  it('runs only the hidden tests and gives one verdict each', async () => {
    const seen: string[] = [];
    const run: Runner = (task) => {
      seen.push(task.stdin);
      return fakeRun(task);
    };
    const judged = await judgeTests(
      { language: 'python', code: 'print()' },
      question,
      run,
    );
    expect(seen).toEqual(['a', 'b', 'c', 'loop']);
    expect(judged.verdicts.map((v) => v.verdict)).toEqual([
      'passed',
      'passed',
      'wrong',
      'time',
    ]);
    expect(judged).toMatchObject({ passed: 2, total: 4, points: 20 });
  });

  it('never reports more time than the limit', async () => {
    const judged = await judgeTests(
      { language: 'javascript', code: '' },
      question,
      fakeRun,
    );
    expect(judged.verdicts[3].ms).toBe(2_000);
  });

  it('runs with the question time limit and the code limits', async () => {
    let limits: unknown;
    await judgeTests({ language: 'javascript', code: '' }, question, (t) => {
      limits = t.limits;
      return fakeRun(t);
    });
    expect(limits).toEqual({
      timeMs: 2_000,
      memoryBytes: 256 * 1024 * 1024,
      outputBytes: 64 * 1024,
    });
  });
});

describe('pointsFor', () => {
  it('splits points evenly across hidden tests, to two places', () => {
    expect(pointsFor(40, 7, 10)).toBe(28);
    expect(pointsFor(10, 1, 3)).toBe(3.33);
    expect(pointsFor(10, 3, 3)).toBe(10);
    expect(pointsFor(10, 0, 0)).toBe(0);
  });
});
