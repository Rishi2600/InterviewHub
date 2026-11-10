import { parentPort } from 'node:worker_threads';
import { getQuickJS } from 'quickjs-emscripten';
import { runProgram, RunTask } from './sandbox/run';
import { loadPython, pythonInstalled } from './sandbox/python';
import { READY } from './pool';

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

void warmUp().then(() => {
  parentPort?.postMessage(READY);
  parentPort?.on('message', (task: RunTask) => {
    void runProgram(task).then((result) => parentPort?.postMessage(result));
  });
});
