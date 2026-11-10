import { Worker } from 'node:worker_threads';
import type { RunTask } from './sandbox/run';
import type { RunResult } from './sandbox/types';

// Extra time past the limit before the worker is killed from outside. The
// runtime's own clock usually stops the program first.
export const KILL_GRACE_MS = 1_000;

interface Slot {
  worker: Worker | null;
  busy: boolean;
}

interface Waiting {
  task: RunTask;
  resolve: (result: RunResult) => void;
}

/**
 * A fixed number of worker threads that run programs one at a time each.
 * The clock that counts is here, outside the program: a worker that has not
 * answered by the time limit plus a grace period is terminated, which stops
 * even WebAssembly mid-loop, and a fresh worker takes its place.
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
      busy: false,
    }));
  }

  run(task: RunTask): Promise<RunResult> {
    return new Promise((resolve) => {
      this.queue.push({ task, resolve });
      this.next();
    });
  }

  async close(): Promise<void> {
    await Promise.all(this.slots.map((s) => s.worker?.terminate()));
    this.slots.forEach((s) => (s.worker = null));
  }

  private next(): void {
    const slot = this.slots.find((s) => !s.busy);
    const waiting = slot && this.queue.shift();
    if (!slot || !waiting) return;
    slot.busy = true;
    void this.dispatch(slot, waiting).then((result) => {
      slot.busy = false;
      waiting.resolve(result);
      this.next();
    });
  }

  private dispatch(slot: Slot, { task }: Waiting): Promise<RunResult> {
    const worker = (slot.worker ??= this.spawn());
    return new Promise((resolve) => {
      const finish = (result: RunResult) => {
        clearTimeout(timer);
        worker.off('message', onMessage);
        worker.off('error', onError);
        worker.off('exit', onExit);
        resolve(result);
      };
      // Throw the worker away: it is stuck, broken or gone.
      const discard = () => {
        if (slot.worker === worker) slot.worker = null;
        void worker.terminate();
      };
      const onMessage = (result: RunResult) => finish(result);
      const onError = (err: Error) => {
        discard();
        const memory = /memory/i.test(err.message);
        finish({
          verdict: memory ? 'memory' : 'error',
          stdout: '',
          stderr: memory ? '' : 'The run failed inside the judge.',
          ms: 0,
        });
      };
      const onExit = () => onError(new Error('Worker exited'));
      const timer = setTimeout(() => {
        discard();
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
