import { Worker } from 'node:worker_threads';
import type { RunTask } from './sandbox/run';
import type { RunResult } from './sandbox/types';

// Extra time past the limit before the worker is killed from outside. The
// runtime's own clock usually stops the program first.
export const KILL_GRACE_MS = 1_000;
// A worker that can't load its runtimes in this long is given up on.
const STARTUP_MS = 60_000;

/** What a worker posts once its runtimes are loaded. */
export const READY = { ready: true } as const;

interface Slot {
  worker: Worker | null;
  // Resolves true once the worker has loaded its runtimes, false if it died.
  ready: Promise<boolean> | null;
  busy: boolean;
}

interface Waiting {
  task: RunTask;
  resolve: (result: RunResult) => void;
}

const failed = (stderr: string): RunResult => ({
  verdict: 'error',
  stdout: '',
  stderr,
  ms: 0,
});

/**
 * A fixed number of worker threads that run programs one at a time each.
 * The clock that counts is here, outside the program: a worker that has not
 * answered by the time limit plus a grace period is terminated, which stops
 * even WebAssembly mid-loop, and a fresh worker takes its place. The clock
 * starts only once a worker has loaded its runtimes, so loading never counts
 * against a program.
 */
export class WorkerPool {
  private readonly slots: Slot[];
  private readonly queue: Waiting[] = [];

  constructor(
    size: number,
    private readonly spawn: () => Worker,
    private readonly graceMs = KILL_GRACE_MS,
  ) {
    this.slots = Array.from({ length: Math.max(1, size) }, () => ({
      worker: null,
      ready: null,
      busy: false,
    }));
    // Start loading now, so the first runs don't wait for it.
    this.slots.forEach((slot) => this.start(slot));
  }

  run(task: RunTask): Promise<RunResult> {
    return new Promise((resolve) => {
      this.queue.push({ task, resolve });
      this.next();
    });
  }

  async close(): Promise<void> {
    const workers = this.slots.flatMap((s) => (s.worker ? [s.worker] : []));
    this.slots.forEach((s) => this.discard(s));
    await Promise.all(workers.map((w) => w.terminate()));
  }

  private start(slot: Slot): void {
    const worker = this.spawn();
    slot.worker = worker;
    slot.ready = new Promise((resolve) => {
      const done = (ok: boolean) => {
        clearTimeout(timer);
        worker.off('message', onMessage);
        worker.off('error', onFail);
        worker.off('exit', onFail);
        resolve(ok);
      };
      const onMessage = (message: unknown) => {
        if ((message as typeof READY)?.ready) done(true);
      };
      const onFail = () => done(false);
      const timer = setTimeout(onFail, STARTUP_MS);
      worker.on('message', onMessage);
      worker.on('error', onFail);
      worker.on('exit', onFail);
    });
  }

  /** Throws a worker away: it is stuck, broken or gone. */
  private discard(slot: Slot, worker = slot.worker): void {
    if (!worker || slot.worker !== worker) return;
    slot.worker = null;
    slot.ready = null;
    void worker.terminate();
  }

  private next(): void {
    const slot = this.slots.find((s) => !s.busy);
    const waiting = slot && this.queue.shift();
    if (!slot || !waiting) return;
    slot.busy = true;
    void this.dispatch(slot, waiting.task).then((result) => {
      slot.busy = false;
      waiting.resolve(result);
      this.next();
    });
  }

  private async dispatch(slot: Slot, task: RunTask): Promise<RunResult> {
    if (!slot.worker) this.start(slot);
    const worker = slot.worker!;
    if (!(await slot.ready)) {
      this.discard(slot, worker);
      return failed('The judge could not start a worker.');
    }
    return new Promise((resolve) => {
      const finish = (result: RunResult) => {
        clearTimeout(timer);
        worker.off('message', onMessage);
        worker.off('error', onError);
        worker.off('exit', onExit);
        resolve(result);
      };
      const onMessage = (result: RunResult) => finish(result);
      const onError = (err: Error) => {
        this.discard(slot, worker);
        if (/memory/i.test(err.message)) {
          finish({ verdict: 'memory', stdout: '', stderr: '', ms: 0 });
        } else finish(failed('The run failed inside the judge.'));
      };
      const onExit = () => onError(new Error('Worker exited'));
      const timer = setTimeout(() => {
        this.discard(slot, worker);
        finish({
          verdict: 'time',
          stdout: '',
          stderr: '',
          ms: task.limits.timeMs,
        });
      }, task.limits.timeMs + this.graceMs);

      worker.on('message', onMessage);
      worker.on('error', onError);
      worker.on('exit', onExit);
      worker.postMessage(task);
    });
  }
}
