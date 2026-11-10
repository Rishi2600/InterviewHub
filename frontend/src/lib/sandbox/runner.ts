import type { FromWorker } from './worker'
import type { RunResult, RunTask } from './types'

// Past the limit before the worker is terminated from outside.
const KILL_GRACE_MS = 1_000

/** Limits for Run, matching the judge. See the backend's LIMITS.code. */
export const RUN_LIMITS = {
  roomMs: 5_000,
  memoryBytes: 256 * 1024 * 1024,
  outputBytes: 64 * 1024,
}

/**
 * Runs programs in a Web Worker, one at a time. The clock starts once the
 * worker has loaded the language's runtime, so downloading Python never
 * counts against a program; a worker still running at the limit is
 * terminated and replaced.
 */
export class BrowserRunner {
  private worker: Worker | null = null
  private nextId = 0
  private queue: Promise<unknown> = Promise.resolve()

  /** `onStarted` fires once the runtime is loaded and the program starts. */
  run(task: RunTask, onStarted?: () => void): Promise<RunResult> {
    const result = this.queue.then(() => this.runNow(task, onStarted))
    this.queue = result.catch(() => undefined)
    return result
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
  }

  private spawn(): Worker {
    return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  }

  private runNow(task: RunTask, onStarted?: () => void): Promise<RunResult> {
    const worker = (this.worker ??= this.spawn())
    const id = ++this.nextId
    return new Promise((resolve) => {
      let timer: number | undefined
      const finish = (result: RunResult) => {
        window.clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        resolve(result)
      }
      const discard = () => {
        worker.terminate()
        if (this.worker === worker) this.worker = null
      }
      const onMessage = (event: MessageEvent<FromWorker>) => {
        const message = event.data
        if (message.id !== id) return
        if (message.type === 'started') {
          onStarted?.()
          timer = window.setTimeout(() => {
            discard()
            finish({ verdict: 'time', stdout: '', stderr: '', ms: task.limits.timeMs })
          }, task.limits.timeMs + KILL_GRACE_MS)
        }
        if (message.type === 'done') finish(message.result)
      }
      const onError = (event: ErrorEvent) => {
        discard()
        finish({ verdict: 'error', stdout: '', stderr: event.message || 'The run failed.', ms: 0 })
      }
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      worker.postMessage({ id, task })
    })
  }
}
