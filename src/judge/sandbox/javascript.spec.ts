import { runJavaScript, toJavaScript } from './javascript';
import { judge, sameOutput } from './compare';

const LIMITS = {
  timeMs: 1_000,
  memoryBytes: 64 * 1024 * 1024,
  outputBytes: 1024,
};
const run = (code: string, stdin = '', limits = LIMITS) =>
  runJavaScript(code, stdin, limits);

describe('runJavaScript', () => {
  it('reads stdin with fs and prints with console.log', async () => {
    const r = await run(
      "const n = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number)\nconsole.log(n.reduce((a, b) => a + b, 0))",
      '2 3 4',
    );
    expect(r).toMatchObject({ verdict: 'ok', stdout: '9\n' });
  });

  it('reads line by line with readline', async () => {
    const r = await run('console.log(readline() + readline())', 'a\nb\n');
    expect(r).toMatchObject({ verdict: 'ok', stdout: 'ab\n' });
  });

  it('runs TypeScript once its types are stripped', async () => {
    const code = toJavaScript(
      'const add = (a: number, b: number): number => a + b\nconsole.log(add(2, 3))',
      'typescript',
    );
    expect(await run(code)).toMatchObject({ verdict: 'ok', stdout: '5\n' });
  });

  it('finishes async code', async () => {
    const r = await run(
      'async function f() { return 7 }\nf().then((v) => console.log(v))',
    );
    expect(r).toMatchObject({ verdict: 'ok', stdout: '7\n' });
  });

  it('reports a thrown error with its message on stderr', async () => {
    const r = await run('throw new TypeError("bad input")');
    expect(r.verdict).toBe('error');
    expect(r.stderr).toContain('TypeError: bad input');
  });

  it('stops an endless loop at the time limit', async () => {
    const r = await run('while (true) {}', '', { ...LIMITS, timeMs: 200 });
    expect(r.verdict).toBe('time');
  });

  it('cannot catch the time limit', async () => {
    const r = await run('for (;;) { try { while (true) {} } catch {} }', '', {
      ...LIMITS,
      timeMs: 200,
    });
    expect(r.verdict).toBe('time');
  });

  it('stops a program that uses too much memory', async () => {
    const r = await run(
      'const a = []; while (true) a.push(new Array(1e5).fill(1))',
      '',
      { ...LIMITS, timeMs: 10_000, memoryBytes: 16 * 1024 * 1024 },
    );
    expect(r.verdict).toBe('memory');
  });

  it('turns deep recursion into an error, not a crash', async () => {
    const r = await run('function f(n) { return f(n + 1) }\nf(0)');
    expect(r.verdict).toBe('error');
    expect(r.stderr).toContain('stack overflow');
  });

  it('cuts output at the cap, even if the program catches errors', async () => {
    const r = await run(
      'for (;;) { try { console.log("x".repeat(100)) } catch {} }',
    );
    expect(r.verdict).toBe('output');
    expect(r.stdout.length).toBeLessThanOrEqual(LIMITS.outputBytes);
  });

  it('has nothing from the host: no process, fetch, timers or modules', async () => {
    const r = await run(
      'console.log(typeof process, typeof fetch, typeof setTimeout, typeof __write, typeof __stdin)\ntry { require("child_process") } catch (e) { console.log(e.message) }',
    );
    expect(r.stdout).toBe(
      "undefined undefined undefined undefined undefined\nCannot find module 'child_process'\n",
    );
  });

  it('shares nothing between runs', async () => {
    await run('globalThis.secret = 42');
    const r = await run('console.log(typeof secret)');
    expect(r.stdout).toBe('undefined\n');
  });
});

describe('judging output', () => {
  it('ignores trailing spaces and blank lines at the end', () => {
    expect(sameOutput('1 6 \n8 10\n\n', '1 6\n8 10')).toBe(true);
    expect(sameOutput('1 6\r\n8 10\r\n', '1 6\n8 10\n')).toBe(true);
  });

  it('notices any other difference', () => {
    expect(sameOutput('1 4\n4 5', '1 5')).toBe(false);
    expect(sameOutput(' 1', '1')).toBe(false);
  });

  it('passes on the run verdict when the program did not finish', () => {
    const base = { stdout: '', stderr: '', ms: 1 };
    expect(judge({ ...base, verdict: 'time' }, '')).toBe('time');
    expect(judge({ ...base, verdict: 'ok', stdout: '5\n' }, '5')).toBe(
      'passed',
    );
    expect(judge({ ...base, verdict: 'ok', stdout: '4' }, '5')).toBe('wrong');
  });
});
