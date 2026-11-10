import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { WorkerPool } from '../pool';
import { pythonInstalled } from './python';

// CPython is fetched with `npm run runtimes:python`; without it these skip.
const describePython = pythonInstalled() ? describe : describe.skip;

/**
 * The real worker thread, run by ts-node, with an empty environment, as the
 * judge runs it. Python goes through the whole path: pool, worker, WASI.
 * (Jest's own module system can't load the ESM-only WASI shim; plain Node
 * inside the worker can.)
 */
const ROOT = resolve(__dirname, '..', '..', '..');
const WORKER = join(__dirname, '..', 'runner.worker.ts');
const spawn = () =>
  new Worker(
    `require('ts-node').register({ transpileOnly: true, compilerOptions: { rootDir: ${JSON.stringify(ROOT)} } });
     require(${JSON.stringify(WORKER)});`,
    { eval: true, env: {} },
  );

const LIMITS = {
  timeMs: 5_000,
  memoryBytes: 256 * 1024 * 1024,
  outputBytes: 1024,
};

describePython('Python in the sandbox', () => {
  jest.setTimeout(60_000);
  let pool: WorkerPool;
  beforeAll(() => {
    pool = new WorkerPool(2, spawn);
  });
  afterAll(() => pool.close());

  const run = (code: string, stdin = '', limits = LIMITS) =>
    pool.run({ language: 'python', code, stdin, limits });

  it('reads stdin and prints', async () => {
    const r = await run(
      'import sys\nprint(sum(map(int, sys.stdin.read().split())))',
      '2 3 4',
    );
    expect(r).toMatchObject({ verdict: 'ok', stdout: '9\n', stderr: '' });
  });

  it('reads line by line with input()', async () => {
    const r = await run('a = input()\nb = input()\nprint(a + b)', 'x\ny\n');
    expect(r).toMatchObject({ verdict: 'ok', stdout: 'xy\n' });
  });

  it('has the standard library contest programs use', async () => {
    const r = await run(
      'import collections, heapq, bisect, itertools, functools, math, re, random, string, json, decimal, fractions\nprint(math.isqrt(10**20))',
    );
    expect(r).toMatchObject({ verdict: 'ok', stdout: '10000000000\n' });
  });

  it('reports an exception as plain text on stderr', async () => {
    const r = await run('print(1/0)');
    expect(r.verdict).toBe('error');
    expect(r.stderr).toContain('ZeroDivisionError: division by zero');
    expect(r.stderr).not.toContain('\u001b['); // no colour codes
  });

  it('is stopped from outside at the time limit', async () => {
    const started = Date.now();
    const r = await run('while True: pass', '', { ...LIMITS, timeMs: 1_000 });
    expect(r.verdict).toBe('time');
    expect(Date.now() - started).toBeLessThan(5_000);
    // A fresh worker takes over.
    expect((await run('print("next")')).stdout).toBe('next\n');
  });

  it('stops at the memory cap with MemoryError', async () => {
    const r = await run(
      'blocks = []\nwhile True: blocks.append(bytearray(32 * 1024 * 1024))',
    );
    expect(r.verdict).toBe('memory');
  });

  it('cuts output at the cap, even if the program catches everything', async () => {
    const r = await run(
      'while True:\n    try:\n        print("x" * 100)\n    except BaseException:\n        pass',
    );
    expect(r.verdict).toBe('output');
    expect(r.stdout.length).toBeLessThanOrEqual(LIMITS.outputBytes);
  });

  it('stops runaway recursion and carries on', async () => {
    // Python 3.12+ keeps Python frames off the C stack, so with the limit
    // raised this runs until the clock or the memory cap stops it.
    const r = await run(
      'import sys\nsys.setrecursionlimit(10**6)\ndef f(n): return f(n + 1)\nf(0)',
      '',
      { ...LIMITS, timeMs: 1_500 },
    );
    expect(['time', 'memory', 'error']).toContain(r.verdict);
    expect((await run('print("still fine")')).stdout).toBe('still fine\n');
  });

  it('reports the default recursion limit as an error', async () => {
    const r = await run('def f(n): return f(n + 1)\nf(0)');
    expect(r.verdict).toBe('error');
    expect(r.stderr).toContain('RecursionError');
  });

  describe('guardrails', () => {
    it('sees only its own file and the standard library', async () => {
      const r = await run(
        'import os\nprint(sorted(os.listdir("/")))\ntry:\n    open("/etc/passwd")\nexcept OSError as e:\n    print(type(e).__name__)',
      );
      expect(r.stdout).toBe("['lib', 'main.py']\nFileNotFoundError\n");
    });

    it('cannot create, change or delete files', async () => {
      const r = await run(
        [
          'import os',
          'for attempt in (lambda: open("/new.txt", "w"), lambda: open("/main.py", "w"), lambda: os.remove("/main.py"), lambda: os.mkdir("/d")):',
          '    try:',
          '        attempt()',
          '        print("allowed")',
          '    except OSError:',
          '        print("refused")',
        ].join('\n'),
      );
      expect(r.stdout).toBe('refused\nrefused\nrefused\nrefused\n');
    });

    it('has no environment beyond its own two settings', async () => {
      const r = await run('import os\nprint(sorted(os.environ))');
      expect(r.stdout).toBe("['PYTHONHOME', 'PYTHON_COLORS']\n");
    });

    it('has no network', async () => {
      const r = await run(
        'import socket\ntry:\n    socket.create_connection(("1.1.1.1", 80), timeout=1)\n    print("connected")\nexcept Exception as e:\n    print("refused", type(e).__name__)',
      );
      expect(r.stdout).toMatch(/^refused /);
    });

    it('cannot start other programs', async () => {
      const r = await run(
        'import subprocess\ntry:\n    subprocess.run(["ls"])\n    print("ran")\nexcept Exception as e:\n    print("refused", type(e).__name__)',
      );
      expect(r.stdout).toMatch(/^refused /);
    });

    it('has no bridge to the host', async () => {
      const r = await run('import js');
      expect(r.verdict).toBe('error');
      expect(r.stderr).toContain("No module named 'js'");
    });

    it('shares nothing between runs', async () => {
      await run('import builtins\nbuiltins.secret = 42');
      const r = await run(
        'import builtins\nprint(hasattr(builtins, "secret"))',
      );
      expect(r.stdout).toBe('False\n');
    });
  });
});
