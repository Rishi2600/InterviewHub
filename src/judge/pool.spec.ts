import { Worker } from 'node:worker_threads';
import { WorkerPool } from './pool';
import { pack, unpack } from './sandbox/pack';
import type { RunTask } from './sandbox/run';

// A stand-in for the real worker: echoes stdin, or hangs, crashes or reports
// its environment, depending on the code it is given.
const FAKE_WORKER = `
const { parentPort } = require('node:worker_threads');
parentPort.on('message', (task) => {
  if (task.code === 'hang') for (;;) {}
  if (task.code === 'crash') throw new Error('boom');
  const stdout = task.code === 'env' ? JSON.stringify(process.env) : task.stdin;
  parentPort.postMessage({ verdict: 'ok', stdout, stderr: '', ms: 1 });
});`;

const spawn = () => new Worker(FAKE_WORKER, { eval: true, env: {} });
const task = (code: string, stdin = ''): RunTask => ({
  language: 'javascript',
  code,
  stdin,
  limits: { timeMs: 100, memoryBytes: 1, outputBytes: 1 },
});

describe('WorkerPool', () => {
  let pool: WorkerPool;
  afterEach(() => pool.close());

  it('runs a task on a worker and returns its result', async () => {
    pool = new WorkerPool(1, spawn, 50);
    expect(await pool.run(task('echo', 'hi'))).toMatchObject({
      verdict: 'ok',
      stdout: 'hi',
    });
  });

  it('kills a worker that runs past the limit, then carries on', async () => {
    pool = new WorkerPool(1, spawn, 50);
    const started = Date.now();
    expect(await pool.run(task('hang'))).toMatchObject({ verdict: 'time' });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(await pool.run(task('echo', 'after'))).toMatchObject({
      stdout: 'after',
    });
  });

  it('reports a crashed worker as an error and replaces it', async () => {
    pool = new WorkerPool(1, spawn, 50);
    expect(await pool.run(task('crash'))).toMatchObject({ verdict: 'error' });
    expect(await pool.run(task('echo', 'ok'))).toMatchObject({ stdout: 'ok' });
  });

  it('runs up to its size at once and queues the rest', async () => {
    pool = new WorkerPool(2, spawn, 50);
    const results = await Promise.all(
      ['a', 'b', 'c', 'd'].map((s) => pool.run(task('echo', s))),
    );
    expect(results.map((r) => r.stdout)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gives workers an empty environment', async () => {
    pool = new WorkerPool(1, spawn, 50);
    expect((await pool.run(task('env'))).stdout).toBe('{}');
  });
});

describe('pack', () => {
  it('round-trips files', () => {
    const files = new Map([
      ['python3.15/os.py', new TextEncoder().encode('import sys\n')],
      ['python3.15/empty.py', new Uint8Array()],
    ]);
    const back = unpack(pack(files));
    expect([...back.keys()]).toEqual([...files.keys()]);
    expect(new TextDecoder().decode(back.get('python3.15/os.py'))).toBe(
      'import sys\n',
    );
    expect(back.get('python3.15/empty.py')?.byteLength).toBe(0);
  });
});
