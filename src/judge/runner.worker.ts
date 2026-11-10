import { parentPort } from 'node:worker_threads';
import { runProgram, RunTask } from './sandbox/run';

/**
 * One judge worker thread. It is started with an empty environment and only
 * ever receives a program and one input; expected outputs stay in the main
 * thread, which does the comparing.
 */
parentPort?.on('message', (task: RunTask) => {
  void runProgram(task).then((result) => parentPort?.postMessage(result));
});
