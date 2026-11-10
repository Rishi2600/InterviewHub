import { Model, Types } from 'mongoose';
import { LIMITS } from '../common/validation/limits';
import type {
  CodeSubmission,
  TestResult,
} from '../contests/schemas/code-submission.schema';
import type {
  CodeTest,
  ContestQuestion,
} from '../contests/schemas/contest-question.schema';
import { judge } from './sandbox/compare';
import type { RunTask } from './sandbox/run';
import type { CodeLanguage, RunResult } from './sandbox/types';

// How long a claim lasts: far longer than 20 tests at 5 seconds take. If the
// judge dies holding it, another takes the job once it runs out.
export const LEASE_MS = 3 * 60_000;
// After this many claims a job is given up on, logged and never scored.
export const MAX_ATTEMPTS = 3;

export type Runner = (task: RunTask) => Promise<RunResult>;

export interface Judged {
  verdicts: TestResult[];
  passed: number;
  total: number;
  points: number;
}

/** Points are split evenly across hidden tests, to two decimal places. */
export function pointsFor(points: number, passed: number, total: number) {
  return total === 0 ? 0 : Math.round((points * passed * 100) / total) / 100;
}

/**
 * Runs a program against every hidden test, one at a time, and compares the
 * output here: the expected outputs never go near the sandbox.
 */
export async function judgeTests(
  program: { language: CodeLanguage; code: string },
  question: Pick<ContestQuestion, 'tests' | 'timeLimitMs' | 'points'>,
  run: Runner,
): Promise<Judged> {
  const hidden: CodeTest[] = question.tests.filter((t) => !t.visible);
  const verdicts: TestResult[] = [];
  for (const test of hidden) {
    const result = await run({
      ...program,
      stdin: test.input,
      limits: {
        timeMs: question.timeLimitMs,
        memoryBytes: LIMITS.code.memoryBytes,
        outputBytes: LIMITS.code.outputBytes,
      },
    });
    verdicts.push({
      verdict: judge(result, test.output),
      ms: Math.min(result.ms, question.timeLimitMs),
    });
  }
  const passed = verdicts.filter((v) => v.verdict === 'passed').length;
  return {
    verdicts,
    passed,
    total: hidden.length,
    points: pointsFor(question.points, passed, hidden.length),
  };
}

type Job = CodeSubmission & { _id: Types.ObjectId };

/** One atomic update: the oldest waiting job, or one whose judge died. */
export function claimNext(
  submissions: Model<CodeSubmission>,
  now: Date,
): Promise<Job | null> {
  return submissions
    .findOneAndUpdate(
      {
        $or: [
          { status: 'queued' },
          { status: 'running', leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          status: 'running',
          leaseUntil: new Date(now.getTime() + LEASE_MS),
        },
        $inc: { attempts: 1 },
      },
      { returnDocument: 'after', sort: { createdAt: 1 } },
    )
    .lean<Job>()
    .exec();
}

/**
 * Judges one claimed job and saves the verdicts, but only while this judge
 * still holds the lease. Judging is idempotent, so a retried job gets the
 * same result.
 */
export async function judgeJob(
  job: Job,
  models: {
    submissions: Model<CodeSubmission>;
    questions: Model<ContestQuestion>;
  },
  run: Runner,
  now: () => Date = () => new Date(),
): Promise<'done' | 'failed' | 'lost'> {
  const held = {
    _id: job._id,
    status: 'running' as const,
    leaseUntil: job.leaseUntil,
  };
  const question =
    job.attempts <= MAX_ATTEMPTS
      ? await models.questions.findById(job.questionId).lean().exec()
      : null;
  if (!question) {
    const { modifiedCount } = await models.submissions
      .updateOne(held, {
        $set: { status: 'failed', leaseUntil: null, judgedAt: now() },
        $unset: { pending: 1 },
      })
      .exec();
    return modifiedCount ? 'failed' : 'lost';
  }

  const judged = await judgeTests(job, question, run);
  const { modifiedCount } = await models.submissions
    .updateOne(held, {
      $set: { ...judged, status: 'done', leaseUntil: null, judgedAt: now() },
      $unset: { pending: 1 },
    })
    .exec();
  return modifiedCount ? 'done' : 'lost';
}
