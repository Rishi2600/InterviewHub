import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRunner } from '@/lib/sandbox/runner'
import type { RunResult, RunTask } from '@/lib/sandbox/types'

export type RunStatus = 'idle' | 'loading' | 'running' | 'done'

/** Runs code in this browser, in a worker that lives as long as the page. */
export function useRunner() {
  const runner = useRef<BrowserRunner | null>(null)
  const [status, setStatus] = useState<RunStatus>('idle')
  const [result, setResult] = useState<RunResult | null>(null)

  useEffect(() => () => runner.current?.dispose(), [])

  const run = useCallback(async (task: RunTask) => {
    runner.current ??= new BrowserRunner()
    // "Loading" until the language's runtime is ready; Python's first load
    // takes a few seconds.
    setStatus('loading')
    const outcome = await runner.current.run(task, () => setStatus('running'))
    setResult(outcome)
    setStatus('done')
    return outcome
  }, [])

  return { run, status, result, busy: status === 'loading' || status === 'running' }
}
