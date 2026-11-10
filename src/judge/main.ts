import { cpus } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Worker } from 'node:worker_threads';
import mongoose from 'mongoose';
import pino from 'pino';
import {
  CodeSubmission,
  CodeSubmissionSchema,
} from '../contests/schemas/code-submission.schema';
import {
  ContestQuestion,
  ContestQuestionSchema,
} from '../contests/schemas/contest-question.schema';
import { claimNext, judgeJob } from './judge';
import { WorkerPool } from './pool';
import { pythonInstalled } from './sandbox/python';

/**
 * The judge: a process of its own, separate from the API. It has no open
 * port and loads none of the API's settings; it only needs a Mongo login
 * that can read questions and read and update submissions. It claims queued
 * submissions and runs each hidden test in a pool of worker threads. See
 * docs/learning/sandbox/WASM_SANDBOX.md.
 *
 *   JUDGE_MONGODB_URI   required
 *   JUDGE_WORKERS       worker threads; default: CPU cores - 1
 *   JUDGE_POLL_MS       how often to look for work when idle; default 500
 */
const log = pino({ name: 'judge', level: process.env.LOG_LEVEL ?? 'info' });

async function main(): Promise<void> {
  const uri = process.env.JUDGE_MONGODB_URI;
  if (!uri) {
    log.fatal('JUDGE_MONGODB_URI is not set');
    process.exit(1);
  }
  const size =
    Number(process.env.JUDGE_WORKERS) || Math.max(1, cpus().length - 1);
  const pollMs = Number(process.env.JUDGE_POLL_MS) || 500;
  if (!pythonInstalled()) {
    log.warn('Python is not installed; run `npm run runtimes:python`');
  }

  await mongoose.connect(uri);
  const models = {
    submissions: mongoose.model(CodeSubmission.name, CodeSubmissionSchema),
    questions: mongoose.model(ContestQuestion.name, ContestQuestionSchema),
  };
  const pool = new WorkerPool(
    size,
    () =>
      new Worker(join(__dirname, 'runner.worker.js'), {
        // Nothing of the judge's environment reaches the programs' threads.
        env: {},
        resourceLimits: { maxOldGenerationSizeMb: 512 },
      }),
  );

  let stopping = false;
  let active = 0;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  log.info({ workers: size }, 'Judge started');

  while (!stopping) {
    if (active >= size) {
      await sleep(50);
      continue;
    }
    const job = await claimNext(models.submissions, new Date()).catch(
      (err: unknown) => {
        log.error({ err }, 'Could not claim a job');
        return null;
      },
    );
    if (!job) {
      await sleep(pollMs);
      continue;
    }
    active++;
    const started = Date.now();
    void judgeJob(job, models, (task) => pool.run(task))
      .then((outcome) =>
        log.info(
          {
            submissionId: job._id.toString(),
            language: job.language,
            attempt: job.attempts,
            outcome,
            ms: Date.now() - started,
          },
          'Judged',
        ),
      )
      .catch((err: unknown) =>
        // The lease runs out and the job is claimed again.
        log.error(
          { err, submissionId: job._id.toString() },
          'Judging failed; it will be retried',
        ),
      )
      .finally(() => active--);
  }

  // Let running jobs finish, then close.
  while (active > 0) await sleep(100);
  await pool.close();
  await mongoose.disconnect();
  log.info('Judge stopped');
}

main().catch((err: unknown) => {
  log.fatal({ err }, 'Judge crashed');
  process.exit(1);
});
