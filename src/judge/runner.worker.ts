import { parentPort } from 'node:worker_threads';
import { getQuickJS } from 'quickjs-emscripten';
import { runProgram, RunTask } from './sandbox/run';
import { loadPython, pythonInstalled } from './sandbox/python';
import { READY } from './pool';
import type { RunResult } from './sandbox/types';

/**
 * One judge worker thread. It is started with an empty environment and only
 * ever receives a program and one input; expected outputs stay in the main
 * thread, which does the comparing. It loads its runtimes first and says so,
 * because the pool only starts the clock after that.
 */
async function warmUp(): Promise<void> {
  await getQuickJS();
  if (pythonInstalled()) await loadPython();
}

function failed(err: unknown): RunResult {
  const missing = !pythonInstalled();
  return {
    verdict: 'error',
    stdout: '',
    stderr: missing
      ? 'Python is not available on this judge.'
      : `The judge could not run this program: ${String(err)}`,
    ms: 0,
  };
}

void warmUp().then(() => {
  parentPort?.postMessage(READY);
  parentPort?.on('message', (task: RunTask) => {
    void runProgram(task)
      .catch(failed)
      .then((result) => parentPort?.postMessage(result));
  });
});
