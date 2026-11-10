import type { Types } from 'mongoose';
import type { ContestQuestion } from './schemas/contest-question.schema';
import type { CodeSubmission } from './schemas/code-submission.schema';

type QuestionFields = ContestQuestion & { _id: Types.ObjectId };

/**
 * A code question as an entrant sees it. Visible tests become examples;
 * hidden tests and the host's answer never leave the server.
 */
export function toCodeQuestion(q: QuestionFields) {
  const hidden = q.tests.filter((t) => !t.visible).length;
  return {
    _id: q._id,
    kind: 'code' as const,
    title: q.title,
    prompt: q.prompt,
    points: q.points,
    timeLimitMs: q.timeLimitMs,
    starterCode: q.starterCode,
    examples: q.tests
      .filter((t) => t.visible)
      .map((t) => ({ input: t.input, output: t.output })),
    hiddenCount: hidden,
  };
}

type SubmissionFields = Pick<
  CodeSubmission,
  | 'questionId'
  | 'language'
  | 'status'
  | 'verdicts'
  | 'passed'
  | 'total'
  | 'points'
  | 'createdAt'
> & { _id: Types.ObjectId };

/** A submission as its author sees it: one verdict and time per hidden
 *  test, never the test itself. The code is left out; results show it. */
export function toSubmission(s: SubmissionFields) {
  return {
    _id: s._id,
    questionId: s.questionId,
    language: s.language,
    status: s.status,
    verdicts: s.verdicts.map((v) => ({ verdict: v.verdict, ms: v.ms })),
    passed: s.passed,
    total: s.total,
    points: s.points,
    createdAt: s.createdAt,
  };
}

export type SubmissionView = ReturnType<typeof toSubmission>;
