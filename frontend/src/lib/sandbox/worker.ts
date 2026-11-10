/// <reference lib="webworker" />
// Runs one program at a time, off the page's thread. The page terminates
// this worker at the time limit, which stops even WebAssembly mid-loop.
import { loadQuickJS, runJavaScript, toJavaScript } from './javascript'
import { loadPython, runPython } from './python'
import type { RunResult, RunTask } from './types'

export type ToWorker = { id: number; task: RunTask }
export type FromWorker =
  | { id: number; type: 'loading' }
  | { id: number; type: 'started' }
  | { id: number; type: 'done'; result: RunResult }

const post = (message: FromWorker) => postMessage(message)

async function run({ language, code, stdin, limits }: RunTask, started: () => void): Promise<RunResult> {
  if (language === 'python') {
    await loadPython()
    started()
    return runPython(code, stdin, limits)
  }
  await loadQuickJS()
  let js: string
  try {
    js = toJavaScript(code, language)
  } catch (err) {
    started()
    return { verdict: 'error', stdout: '', stderr: err instanceof Error ? err.message : String(err), ms: 0 }
  }
  started()
  return runJavaScript(js, stdin, limits)
}

onmessage = (event: MessageEvent<ToWorker>) => {
  const { id, task } = event.data
  post({ id, type: 'loading' })
  run(task, () => post({ id, type: 'started' }))
    .catch(
      (err: unknown): RunResult => ({
        verdict: 'error',
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        ms: 0,
      }),
    )
    .then((result) => post({ id, type: 'done', result }))
}
